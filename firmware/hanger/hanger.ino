// Wearly hanger firmware (ESP32-C3 Super Mini).
//
// - Reads the reed switch (on_rail) and the micro switch (garment_on). A change only
//   counts once it has held for 200 ms, so a jiggle isn't an event.
// - Sends its full state to the hub over ESP-NOW: on every change, once at startup,
//   and as a heartbeat every 60 s. A change that doesn't get through is retried every 2 s.
// - Shows the light the hub sends: purple (steady), amber (breathing), white (two blinks,
//   then back to the previous light) or off.
// - Serial Monitor commands (115200 baud, New Line): purple, amber, white, off, state,
//   number <n>, channel, rescan, help.
//
// Board: ESP32C3 Dev Module, Tools > USB CDC On Boot: Enabled. Library: Adafruit NeoPixel.
// Before uploading: copy config.example.h to config.h and fill it in.

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>
#include <Preferences.h>
#include <Adafruit_NeoPixel.h>
#include "protocol.h"
#include "config.h"

// ---------- settings ----------

// Pins. Keep sensors off GPIO 2, 8 and 9: the C3 checks them at boot.
const int PIN_REED = 3;     // reed switch between GPIO 3 and GND: LOW = on the rail
const int PIN_GARMENT = 4;  // micro switch NO to GPIO 4, COM to GND: LOW = garment on
const int PIN_LED = 5;      // WS2812B DIN

// Only if the micro switch can't feel your lightest shirt: use the TCRT5000 IR module
// instead (D0 to GPIO 6, VCC to 3V3, GND to GND) and set this to true.
const bool USE_IR_SENSOR = false;
const int PIN_IR = 6;       // TCRT5000 D0: LOW = something close

const unsigned long DEBOUNCE_MS = 200;
const unsigned long HEARTBEAT_MS = 60000;   // "still here" message to the hub
const unsigned long RETRY_MS = 2000;        // retry a state the hub didn't receive
const unsigned long RESCAN_MS = 30000;      // at most this often, look for the hub's channel again
const uint8_t BRIGHTNESS = 40;              // out of 255; low saves battery

// ---------- state ----------

const uint8_t hubMac[6] = HUB_MAC;
Adafruit_NeoPixel pixel(1, PIN_LED, NEO_GRB + NEO_KHZ800);
Preferences prefs;
uint16_t myNumber = DEFAULT_HANGER_NUMBER;

// Sensors: the reported state, plus the raw reading and when it last changed
bool onRail = false, garmentOn = false;
bool rawRail = false, rawGarment = false;
unsigned long railChangedAt = 0, garmentChangedAt = 0;

// Lights: purple, amber and off are lasting; white is momentary
uint8_t lasting = LIGHT_OFF;
unsigned long whiteStart = 0, whiteUntil = 0;  // white plays while millis() < whiteUntil
uint32_t shownColor = 0xFFFFFFFF;              // what the LED shows now (forces the first update)

// Radio
uint8_t radioChannel = 0;
bool radioReady = false;
bool statePending = false;          // a state message still has to reach the hub
uint8_t pendingKind = KIND_CHANGE;
bool warnedNoAnswer = false;
unsigned long nextRetry = 0, lastHeartbeat = 0, lastRescan = 0;
int failedSends = 0;

// Set by the radio callbacks, which run in the Wi-Fi task; read in loop()
volatile bool sendDone = false, sendOk = false;
volatile bool lightArrived = false;
volatile uint8_t arrivedLight = LIGHT_OFF;
volatile uint16_t arrivedFor = 0;

String serialLine;

// Functions defined further down
void readSensors();
bool readGarmentPin();
void printState();
void queueState(uint8_t kind);
void radioJobs();
bool sendState(uint8_t kind);
void startRadio();
uint8_t findHubChannel();
void setRadioChannel(uint8_t ch);
void handleArrivedLight();
void showLight(uint8_t code);
const char* lightName(uint8_t code);
void readSerial();
void handleCommand(String cmd);
void updateLight();
void setColor(uint8_t r, uint8_t g, uint8_t b);

// ---------- radio callbacks ----------

// A message arrived. Only lights from our hub are kept; loop() applies them.
void onRadioReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len != sizeof(LightMsg) || memcmp(info->src_addr, hubMac, 6) != 0) return;
  LightMsg msg;
  memcpy(&msg, data, sizeof(msg));
  if (msg.type != MSG_LIGHT || msg.protocol != WEARLY_PROTOCOL) return;
  arrivedFor = msg.hanger;
  arrivedLight = msg.light;
  lightArrived = true;
}

// The radio reports whether the hub received what we sent.
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
  delay(1000);  // give the Serial Monitor a moment to connect

  pinMode(PIN_REED, INPUT_PULLUP);
  pinMode(PIN_GARMENT, INPUT_PULLUP);
  pinMode(PIN_IR, INPUT);

  pixel.begin();
  pixel.setBrightness(BRIGHTNESS);
  setColor(0, 0, 0);

  // The hanger number lives in flash, so renumbering needs no new upload
  prefs.begin("wearly", false);
  myNumber = prefs.getUShort("number", DEFAULT_HANGER_NUMBER);

  rawRail = onRail = digitalRead(PIN_REED) == LOW;
  rawGarment = garmentOn = readGarmentPin();

  Serial.println();
  Serial.printf("Wearly hanger %d. Type help for commands.\n", myNumber);
  Serial.printf("This hanger's MAC: %s\n", WiFi.macAddress().c_str());
  printState();

  startRadio();
  queueState(KIND_BOOT);  // tells the hub we're here, so it re-sends our light
  lastHeartbeat = millis();
}

void loop() {
  readSensors();
  readSerial();
  handleArrivedLight();
  radioJobs();
  updateLight();
  delay(5);
}

// ---------- sensors ----------

bool readGarmentPin() {
  return digitalRead(USE_IR_SENSOR ? PIN_IR : PIN_GARMENT) == LOW;
}

void readSensors() {
  unsigned long now = millis();
  bool rail = digitalRead(PIN_REED) == LOW;
  bool garment = readGarmentPin();

  // Restart the 200 ms clock every time the raw reading flips
  if (rail != rawRail) {
    rawRail = rail;
    railChangedAt = now;
  }
  if (garment != rawGarment) {
    rawGarment = garment;
    garmentChangedAt = now;
  }

  // Accept a new value only once it has held for 200 ms
  bool changed = false;
  if (rawRail != onRail && now - railChangedAt >= DEBOUNCE_MS) {
    onRail = rawRail;
    changed = true;
  }
  if (rawGarment != garmentOn && now - garmentChangedAt >= DEBOUNCE_MS) {
    garmentOn = rawGarment;
    changed = true;
  }
  if (changed) {
    printState();
    queueState(KIND_CHANGE);
  }
}

void printState() {
  Serial.printf("on_rail=%d garment_on=%d\n", onRail ? 1 : 0, garmentOn ? 1 : 0);
}

// ---------- sending to the hub ----------

// Marks the current state as "to send". The message always carries the latest state,
// so if several changes happen while the hub is unreachable, the newest one wins.
void queueState(uint8_t kind) {
  if (!statePending || kind == KIND_BOOT) pendingKind = kind;  // a pending boot stays a boot
  statePending = true;
  nextRetry = 0;  // try right away
}

void radioJobs() {
  unsigned long now = millis();

  if (statePending && (long)(now - nextRetry) >= 0) {
    if (sendState(pendingKind)) {
      statePending = false;
      warnedNoAnswer = false;
      Serial.println("  -> hub got it");
    } else {
      nextRetry = now + RETRY_MS;
      if (!warnedNoAnswer) {
        Serial.println("  -> hub didn't answer; retrying every 2 s");
        warnedNoAnswer = true;
      }
    }
  }

  if (now - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = now;
    sendState(KIND_HEARTBEAT);
  }

  // Several failures in a row: the hub may be on a new channel, so look again
  if (failedSends >= 3 && now - lastRescan >= RESCAN_MS) {
    lastRescan = now;
    failedSends = 0;
    setRadioChannel(findHubChannel());
  }
}

// Sends our full state to the hub. Tries up to 3 times; true if the hub received it.
bool sendState(uint8_t kind) {
  if (!radioReady) return false;
  StateMsg msg;
  msg.type = MSG_STATE;
  msg.protocol = WEARLY_PROTOCOL;
  msg.hanger = myNumber;
  msg.onRail = onRail ? 1 : 0;
  msg.garmentOn = garmentOn ? 1 : 0;
  msg.kind = kind;

  for (int attempt = 0; attempt < 3; attempt++) {
    sendDone = false;
    if (esp_now_send(hubMac, (const uint8_t *)&msg, sizeof(msg)) == ESP_OK) {
      unsigned long start = millis();
      while (!sendDone && millis() - start < 100) delay(1);
      if (sendDone && sendOk) {
        failedSends = 0;
        return true;
      }
    }
    delay(20);
  }
  failedSends++;
  return false;
}

// ---------- radio setup ----------

void startRadio() {
  WiFi.mode(WIFI_STA);  // the radio on, but the hanger never joins a network
  WiFi.disconnect();
  setRadioChannel(findHubChannel());

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW didn't start. Press RESET to try again.");
    return;
  }
  esp_now_register_recv_cb(onRadioReceive);
  esp_now_register_send_cb(onRadioSent);

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, hubMac, 6);
  peer.channel = 0;  // 0 = whatever channel the radio is on now
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("Couldn't add the hub. Check HUB_MAC in config.h.");
    return;
  }
  radioReady = true;
  Serial.printf("Radio ready: talking to hub %02X:%02X:%02X:%02X:%02X:%02X on channel %d\n",
                hubMac[0], hubMac[1], hubMac[2], hubMac[3], hubMac[4], hubMac[5], radioChannel);
}

// ESP-NOW only works if the hanger uses the same channel as the hub's Wi-Fi network.
// A mismatch fails silently, so the hanger looks the channel up by network name.
uint8_t findHubChannel() {
  Serial.printf("Looking for Wi-Fi \"%s\" to find the hub's channel...\n", HUB_WIFI_SSID);
  int found = WiFi.scanNetworks();
  int best = -1;
  int bestRssi = -1000;
  for (int i = 0; i < found; i++) {
    if (WiFi.SSID(i) == HUB_WIFI_SSID && WiFi.RSSI(i) > bestRssi) {
      best = i;
      bestRssi = WiFi.RSSI(i);
    }
  }
  uint8_t ch = best >= 0 ? (uint8_t)WiFi.channel(best) : (uint8_t)FALLBACK_CHANNEL;
  WiFi.scanDelete();
  if (best >= 0) {
    Serial.printf("Found it on channel %d\n", ch);
  } else {
    Serial.printf("Not found. Using FALLBACK_CHANNEL %d from config.h\n", ch);
  }
  return ch;
}

void setRadioChannel(uint8_t ch) {
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);
  radioChannel = ch;
}

// ---------- lights ----------

void handleArrivedLight() {
  if (!lightArrived) return;
  lightArrived = false;
  uint16_t forHanger = arrivedFor;
  uint8_t code = arrivedLight;
  if (forHanger != myNumber) {
    Serial.printf("Light for hanger %d ignored (this is hanger %d)\n", forHanger, myNumber);
    return;
  }
  Serial.printf("Light from hub: %s\n", lightName(code));
  showLight(code);
}

void showLight(uint8_t code) {
  if (code == LIGHT_WHITE) {
    whiteStart = millis();
    whiteUntil = whiteStart + 600;  // two blinks, then back to the lasting light
  } else if (code == LIGHT_PURPLE || code == LIGHT_AMBER || code == LIGHT_OFF) {
    lasting = code;
  }
}

const char* lightName(uint8_t code) {
  switch (code) {
    case LIGHT_PURPLE: return "purple";
    case LIGHT_AMBER: return "amber";
    case LIGHT_WHITE: return "white";
    case LIGHT_OFF: return "off";
    default: return "unknown";
  }
}

// Called every loop, so the sensors keep working while the LED blinks or breathes.
void updateLight() {
  unsigned long now = millis();

  if ((long)(whiteUntil - now) > 0) {
    // Two short white blinks: on 150 ms, off 150 ms, on 150 ms, off 150 ms
    unsigned long t = now - whiteStart;
    bool on = t < 150 || (t >= 300 && t < 450);
    uint8_t v = on ? 255 : 0;
    setColor(v, v, v);
    return;
  }

  if (lasting == LIGHT_PURPLE) {
    setColor(128, 0, 255);
  } else if (lasting == LIGHT_AMBER) {
    float phase = (now % 3000) / 3000.0f;           // one breath every 3 seconds
    float k = 0.5f - 0.5f * cosf(phase * 2 * PI);    // 0 -> 1 -> 0
    setColor((uint8_t)(255 * k), (uint8_t)(120 * k), 0);
  } else {
    setColor(0, 0, 0);
  }
}

// Only talks to the LED when the color actually changes
void setColor(uint8_t r, uint8_t g, uint8_t b) {
  uint32_t c = pixel.Color(r, g, b);
  if (c == shownColor) return;
  pixel.setPixelColor(0, c);
  pixel.show();
  shownColor = c;
}

// ---------- Serial Monitor commands ----------

void readSerial() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (serialLine.length() > 0) handleCommand(serialLine);
      serialLine = "";
    } else {
      serialLine += ch;
    }
  }
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toLowerCase();

  if (cmd == "purple") {
    showLight(LIGHT_PURPLE);
  } else if (cmd == "amber") {
    showLight(LIGHT_AMBER);
  } else if (cmd == "white") {
    showLight(LIGHT_WHITE);
  } else if (cmd == "off") {
    showLight(LIGHT_OFF);
  } else if (cmd == "state") {
    Serial.printf("hanger %d: ", myNumber);
    printState();
  } else if (cmd.startsWith("number")) {
    int n = cmd.substring(6).toInt();
    if (n < 1 || n > 999) {
      Serial.println("Usage: number 8");
      return;
    }
    myNumber = n;
    prefs.putUShort("number", myNumber);
    lasting = LIGHT_OFF;    // the hub re-sends this number's light, if it has one
    queueState(KIND_BOOT);  // tell the hub about the new number right away
    Serial.printf("This is now hanger %d (saved)\n", myNumber);
  } else if (cmd == "channel") {
    Serial.printf("Radio channel %d, hub %s\n", radioChannel, radioReady ? "set up" : "NOT set up");
  } else if (cmd == "rescan") {
    setRadioChannel(findHubChannel());
  } else {
    Serial.println("Commands: purple, amber, white, off (test the light), state,");
    Serial.println("          number <n> (set this hanger's number), channel, rescan");
  }
}
