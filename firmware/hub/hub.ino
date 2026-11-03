// Wearly hub firmware (ESP32-WROOM DevKit).
//
// - Joins Wi-Fi. It's the only Wearly device on Wi-Fi.
// - Hangers send their state over ESP-NOW. The hub keeps a list of hanger number -> MAC
//   address, and posts state changes to POST /api/hub/events with how old each one is.
// - About once a second it asks GET /api/hub/commands for lights, sends each one to its
//   hanger over ESP-NOW, and acks (POST /api/hub/commands/ack) only what a hanger received.
//   Anything not acked comes back on the next poll.
// - When a hanger restarts, the hub sends it its last lasting light again.
// - Serial Monitor (115200 baud, New Line): "5 1 0" sends a fake event for hanger 5
//   (hanger, on_rail, garment_on); "list" shows the hangers the hub has heard from.
//
// Contract: docs/api.md, "Hub API". Board: ESP32 Dev Module. Library: ArduinoJson 7.
// Before uploading: copy secrets.example.h to secrets.h and fill it in.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>
#include <ArduinoJson.h>
#include "protocol.h"
#include "secrets.h"

// ---------- settings ----------

const unsigned long POLL_EVERY_MS = 1000;   // how often to ask for light commands
const unsigned long POLL_RETRY_MS = 5000;   // wait after a failed poll
const unsigned long BACKOFF_MAX_MS = 30000; // longest wait between event retries
const unsigned long WIFI_RETRY_MS = 10000;  // how often to retry Wi-Fi while it's down
const int QUEUE_SIZE = 100;                 // the API takes 1-100 events per call
const int MAX_HANGER = 64;                  // highest hanger number the hub keeps track of

// ---------- types ----------

// An event waiting to be posted. The hub has no clock, so it remembers when the event
// arrived (millis) and sends age_ms; the server works out the real time from that.
struct PendingEvent {
  int hanger;
  bool onRail;
  bool garmentOn;
  unsigned long receivedAt;
};

// A message from a hanger, handed from the radio callback to loop()
struct RadioItem {
  uint8_t mac[6];
  StateMsg msg;
  unsigned long receivedAt;
};

// What the hub knows about one hanger number
struct HangerSlot {
  bool heard;             // we have its MAC address
  uint8_t mac[6];
  bool hasLasting;        // we know which lasting light it should show
  uint8_t lastingLight;   // LIGHT_PURPLE, LIGHT_AMBER or LIGHT_OFF
  long warnedCommand;     // last command id we printed "not reachable" for
  unsigned long lastHeard;
};

// ---------- state ----------

PendingEvent eventQueue[QUEUE_SIZE];
int queued = 0;
HangerSlot slots[MAX_HANGER + 1];  // index = hanger number

WiFiClient plainClient;      // for http:// (pnpm dev on your laptop)
WiFiClientSecure tlsClient;  // for https:// (the deployed app)
HTTPClient http;

unsigned long nextPoll = 0;
unsigned long nextEventTry = 0;
unsigned long eventBackoffMs = 1000;
unsigned long lastWifiAttempt = 0;
bool wifiUp = false;
bool authFailed = false;  // a 401 means the secret is wrong: stop calling until fixed
String serialLine;

QueueHandle_t radioQueue;  // radio callback -> loop()
volatile bool sendDone = false, sendOk = false;

// Functions defined further down
bool wifiReady();
void startRadio();
void handleRadio();
bool addPeer(const uint8_t *mac);
bool sendLight(uint16_t hanger, uint8_t light);
int lightCode(const char *color);
void queueEvent(int hanger, bool onRail, bool garmentOn, unsigned long receivedAt);
void readSerial();
void handleLine(const String &line);
void listHangers();
bool beginRequest(const char *path);
void sendEvents();
void pollCommands();
void sendAck(JsonDocument &ack);
void printError(const char *what, int code);

// ---------- radio callbacks (they run in the Wi-Fi task, so keep them short) ----------

void onRadioReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len != sizeof(StateMsg)) return;
  RadioItem item;
  memcpy(item.mac, info->src_addr, 6);
  memcpy(&item.msg, data, sizeof(StateMsg));
  item.receivedAt = millis();
  xQueueSend(radioQueue, &item, 0);  // never wait inside the callback
}

// (The ESP32 core changed this callback's first argument in ESP-IDF 5.5.)
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 5, 0)
void onRadioSent(const esp_now_send_info_t *info, esp_now_send_status_t status) {
#else
void onRadioSent(const uint8_t *mac, esp_now_send_status_t status) {
#endif
  sendOk = status == ESP_NOW_SEND_SUCCESS;
  sendDone = true;
}

// ---------- setup and loop ----------

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("Wearly hub starting");

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.print("Hub MAC: ");
  Serial.println(WiFi.macAddress());

  Serial.printf("Joining Wi-Fi \"%s\"", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  lastWifiAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - lastWifiAttempt < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Not on Wi-Fi yet. Check WIFI_SSID and WIFI_PASS, and that the network is 2.4 GHz. Still trying...");
  }

  startRadio();

  tlsClient.setInsecure();       // demo only: skips the certificate check for https
  http.setReuse(true);           // keep one connection open instead of a new one every second
  http.setConnectTimeout(3000);
  http.setTimeout(10000);        // the dev server can be slow the first time it builds a route

  Serial.println("Fake hanger event: <hanger> <on_rail 0/1> <garment_on 0/1>, e.g. 5 1 0. Type list to see hangers.");
}

void loop() {
  readSerial();
  handleRadio();  // runs even without Wi-Fi: events wait in the queue with their age
  if (!wifiReady() || authFailed) {
    delay(10);
    return;
  }

  unsigned long now = millis();
  if (queued > 0 && (long)(now - nextEventTry) >= 0) sendEvents();
  if ((long)(now - nextPoll) >= 0) pollCommands();
}

// ---------- Wi-Fi ----------

bool wifiReady() {
  bool up = WiFi.status() == WL_CONNECTED;
  if (up && !wifiUp) {
    // Hangers find this channel by scanning for WIFI_SSID (see the hanger's config.h)
    Serial.printf("Wi-Fi connected: IP %s, channel %d\n", WiFi.localIP().toString().c_str(), WiFi.channel());
    Serial.printf("Calling the API at %s\n", API_BASE);
  } else if (!up && wifiUp) {
    Serial.println("Wi-Fi lost, reconnecting... (events wait in the queue)");
  }
  wifiUp = up;

  if (!up && millis() - lastWifiAttempt > WIFI_RETRY_MS) {
    lastWifiAttempt = millis();
    WiFi.reconnect();
  }
  return up;
}

// ---------- ESP-NOW ----------

void startRadio() {
  radioQueue = xQueueCreate(32, sizeof(RadioItem));
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW didn't start. Press EN to restart the hub.");
    return;
  }
  esp_now_register_recv_cb(onRadioReceive);
  esp_now_register_send_cb(onRadioSent);
  Serial.println("Radio ready: listening for hangers");
}

// Handles every hanger message the callback queued since the last loop
void handleRadio() {
  RadioItem item;
  while (xQueueReceive(radioQueue, &item, 0) == pdTRUE) {
    const StateMsg &m = item.msg;
    if (m.type != MSG_STATE || m.protocol != WEARLY_PROTOCOL) {
      Serial.println("RADIO   ignored a message from another firmware version (check protocol.h)");
      continue;
    }
    if (m.hanger < 1 || m.hanger > MAX_HANGER) {
      Serial.printf("RADIO   ignored hanger number %d (use 1-%d)\n", m.hanger, MAX_HANGER);
      continue;
    }

    // Learn or refresh this hanger's MAC. If the board was renumbered, forget its old number.
    HangerSlot &slot = slots[m.hanger];
    bool newMac = !slot.heard || memcmp(slot.mac, item.mac, 6) != 0;
    if (newMac) {
      for (int n = 1; n <= MAX_HANGER; n++) {
        if (n != m.hanger && slots[n].heard && memcmp(slots[n].mac, item.mac, 6) == 0) slots[n].heard = false;
      }
      memcpy(slot.mac, item.mac, 6);
      slot.heard = addPeer(item.mac);
      Serial.printf("RADIO   hanger %d is %02X:%02X:%02X:%02X:%02X:%02X\n", m.hanger,
                    item.mac[0], item.mac[1], item.mac[2], item.mac[3], item.mac[4], item.mac[5]);
    }
    slot.lastHeard = item.receivedAt;

    if (m.kind == KIND_HEARTBEAT) continue;  // only refreshes the list; nothing to post

    Serial.printf("RADIO   hanger %d %s: on_rail=%d garment_on=%d\n", m.hanger,
                  m.kind == KIND_BOOT ? "started" : "changed", m.onRail, m.garmentOn);
    queueEvent(m.hanger, m.onRail == 1, m.garmentOn == 1, item.receivedAt);

    // A restarted hanger is dark: give it back its last lasting light
    if (m.kind == KIND_BOOT && slot.hasLasting && slot.lastingLight != LIGHT_OFF) {
      bool ok = sendLight(m.hanger, slot.lastingLight);
      Serial.printf("LIGHT   hanger %d restarted, re-sent its light: %s\n", m.hanger, ok ? "delivered" : "not delivered");
    }
  }
}

bool addPeer(const uint8_t *mac) {
  if (esp_now_is_peer_exist(mac)) return true;
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, mac, 6);
  peer.channel = 0;  // 0 = the channel the hub's Wi-Fi is on
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  bool ok = esp_now_add_peer(&peer) == ESP_OK;
  if (!ok) Serial.println("RADIO   couldn't add that hanger as a peer");
  return ok;
}

// Sends a light to a hanger we've heard from. True only if the hanger received it.
bool sendLight(uint16_t hanger, uint8_t light) {
  if (hanger < 1 || hanger > MAX_HANGER || !slots[hanger].heard) return false;
  LightMsg msg;
  msg.type = MSG_LIGHT;
  msg.protocol = WEARLY_PROTOCOL;
  msg.hanger = hanger;
  msg.light = light;

  for (int attempt = 0; attempt < 2; attempt++) {
    sendDone = false;
    if (esp_now_send(slots[hanger].mac, (const uint8_t *)&msg, sizeof(msg)) == ESP_OK) {
      unsigned long start = millis();
      while (!sendDone && millis() - start < 100) delay(1);
      if (sendDone && sendOk) return true;
    }
    delay(20);
  }
  return false;
}

// API color -> radio light code (each color has one fixed pattern)
int lightCode(const char *color) {
  if (color == nullptr) return -1;
  if (strcmp(color, "purple") == 0) return LIGHT_PURPLE;
  if (strcmp(color, "amber") == 0) return LIGHT_AMBER;
  if (strcmp(color, "white") == 0) return LIGHT_WHITE;
  if (strcmp(color, "off") == 0) return LIGHT_OFF;
  return -1;
}

// ---------- events waiting to be posted ----------

void queueEvent(int hanger, bool onRail, bool garmentOn, unsigned long receivedAt) {
  if (queued == QUEUE_SIZE) {
    // Full (Wi-Fi down for a long time): drop the oldest to make room
    memmove(eventQueue, eventQueue + 1, sizeof(PendingEvent) * (QUEUE_SIZE - 1));
    queued--;
    Serial.println("Queue full: dropped the oldest event");
  }
  eventQueue[queued++] = { hanger, onRail, garmentOn, receivedAt };
}

// ---------- Serial Monitor: fake hangers and the hanger list ----------

void readSerial() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (serialLine.length() > 0) handleLine(serialLine);
      serialLine = "";
    } else {
      serialLine += ch;
    }
  }
}

void handleLine(const String &line) {
  if (line == "list") {
    listHangers();
    return;
  }
  int hanger, onRail, garmentOn;
  if (sscanf(line.c_str(), "%d %d %d", &hanger, &onRail, &garmentOn) != 3 || hanger < 1) {
    Serial.println("Type <hanger> <on_rail 0/1> <garment_on 0/1>, e.g. 5 1 0, or list");
    return;
  }
  queueEvent(hanger, onRail == 1, garmentOn == 1, millis());
  Serial.printf("QUEUED  fake hanger %d  on_rail=%d garment_on=%d\n", hanger, onRail == 1, garmentOn == 1);
}

void listHangers() {
  int count = 0;
  for (int n = 1; n <= MAX_HANGER; n++) {
    if (!slots[n].heard) continue;
    count++;
    Serial.printf("hanger %d  %02X:%02X:%02X:%02X:%02X:%02X  heard %lu s ago\n", n,
                  slots[n].mac[0], slots[n].mac[1], slots[n].mac[2], slots[n].mac[3], slots[n].mac[4],
                  slots[n].mac[5], (millis() - slots[n].lastHeard) / 1000);
  }
  if (count == 0) Serial.println("No hangers heard yet (they check in at startup and every 60 s)");
}

// ---------- the three API calls ----------

// Starts a request to API_BASE + path with the hub's secret.
bool beginRequest(const char *path) {
  String url = String(API_BASE) + path;
  bool ok = url.startsWith("https") ? http.begin(tlsClient, url) : http.begin(plainClient, url);
  if (!ok) {
    Serial.printf("Could not start a request to %s. Check API_BASE in secrets.h\n", url.c_str());
    return false;
  }
  http.addHeader("Authorization", String("Bearer ") + HUB_SECRET);
  return true;
}

// POST /api/hub/events with everything in the queue, oldest first.
void sendEvents() {
  JsonDocument doc;
  JsonArray events = doc["events"].to<JsonArray>();
  unsigned long now = millis();
  for (int i = 0; i < queued; i++) {
    JsonObject e = events.add<JsonObject>();
    e["hanger"] = eventQueue[i].hanger;
    e["on_rail"] = eventQueue[i].onRail;
    e["garment_on"] = eventQueue[i].garmentOn;
    e["age_ms"] = now - eventQueue[i].receivedAt;
    // No "seq": the server keeps every (hanger, seq) pair, so a counter that restarts
    // at 1 after a reboot would get every event dropped as a duplicate.
  }
  String body;
  serializeJson(doc, body);

  if (!beginRequest("/api/hub/events")) return;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);

  if (code == 200) {
    JsonDocument res;
    deserializeJson(res, http.getString());
    Serial.printf("EVENTS  sent %d: accepted %d, duplicates %d", queued,
                  res["accepted"].as<int>(), res["duplicates"].as<int>());
    JsonArray unknown = res["unknown_hangers"].as<JsonArray>();
    if (unknown.size() > 0) {
      Serial.print(", unknown hangers ");
      serializeJson(unknown, Serial);
      Serial.print(" (use numbers 1-24)");
    }
    Serial.println();
    queued = 0;
    eventBackoffMs = 1000;
  } else if (code >= 400 && code < 500) {
    // Our mistake (bad body or secret): sending the same thing again won't help
    printError("Events", code);
    Serial.printf("        dropped %d event(s)\n", queued);
    queued = 0;
  } else {
    // Network error or server error: keep the events and try again later
    printError("Events", code);
    Serial.printf("        keeping %d event(s), retrying in %lu s\n", queued, eventBackoffMs / 1000);
    nextEventTry = millis() + eventBackoffMs;
    eventBackoffMs = eventBackoffMs * 2 > BACKOFF_MAX_MS ? BACKOFF_MAX_MS : eventBackoffMs * 2;
  }
  http.end();
}

// GET /api/hub/commands, send each light to its hanger, then ack what got through.
void pollCommands() {
  if (!beginRequest("/api/hub/commands")) {
    nextPoll = millis() + POLL_RETRY_MS;
    return;
  }
  int code = http.GET();
  if (code != 200) {
    printError("Poll", code);
    http.end();
    nextPoll = millis() + POLL_RETRY_MS;
    return;
  }
  String body = http.getString();
  http.end();
  nextPoll = millis() + POLL_EVERY_MS;

  JsonDocument doc;
  if (deserializeJson(doc, body)) {
    Serial.println("Poll: could not read the server's reply");
    return;
  }
  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.size() == 0) return;

  JsonDocument ack;
  JsonArray ids = ack["ids"].to<JsonArray>();
  for (JsonObject c : commands) {
    long id = c["id"].as<long>();
    int hanger = c["hanger"].as<int>();
    const char *color = c["color"].as<const char *>();
    int light = lightCode(color);
    if (light < 0) {
      Serial.printf("LIGHT   command %ld has an unknown color, skipped\n", id);
      continue;
    }

    bool known = hanger >= 1 && hanger <= MAX_HANGER && slots[hanger].heard;
    if (known && sendLight(hanger, light)) {
      Serial.printf("LIGHT   hanger %d -> %s (command %ld) delivered\n", hanger, color, id);
      if (light != LIGHT_WHITE) {  // white is momentary; remember only lasting lights
        slots[hanger].hasLasting = true;
        slots[hanger].lastingLight = light;
      }
      ids.add(id);
    } else if (hanger >= 1 && hanger <= MAX_HANGER && slots[hanger].warnedCommand != id) {
      // Not acked, so the server sends it again on the next poll. Print it once only.
      slots[hanger].warnedCommand = id;
      Serial.printf("LIGHT   hanger %d -> %s (command %ld): %s, will retry\n", hanger, color, id,
                    known ? "hanger didn't answer" : "hanger not heard yet");
    }
  }
  if (ids.size() > 0) sendAck(ack);
}

// POST /api/hub/commands/ack with { "ids": [...] }. The server answers 204.
void sendAck(JsonDocument &ack) {
  String body;
  serializeJson(ack, body);
  if (!beginRequest("/api/hub/commands/ack")) return;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  if (code != 204) {
    printError("Ack", code);
    Serial.println("        those commands will come back on the next poll");
  }
  http.end();
}

void printError(const char *what, int code) {
  if (code < 0) {
    // No HTTP answer at all: wrong address, server not running, or a firewall
    Serial.printf("%s: no answer from %s (%s)\n", what, API_BASE, http.errorToString(code).c_str());
    return;
  }
  Serial.printf("%s: HTTP %d %s\n", what, code, http.getString().c_str());
  if (code == 401) {
    authFailed = true;
    Serial.println("Wrong or missing HUB_SECRET in secrets.h. Fix it and upload again. API calls stopped.");
  }
}
