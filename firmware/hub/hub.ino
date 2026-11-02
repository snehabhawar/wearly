// Wearly hub, Step 2 of the Hardware Build Guide: the hub alone talks to the API.
// No hangers yet: type "5 1 0" in the Serial Monitor (hanger, on_rail, garment_on)
// to send a fake hanger event. Light commands are printed and acked.
// Contract: docs/api.md (hub API). Needs secrets.h, see secrets.example.h.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "secrets.h"

const int LED = 2;  // onboard LED on most ESP32-WROOM DevKits: on while Wi-Fi is connected
const unsigned long POLL_MS = 1000;           // docs/api.md: poll about once a second
const unsigned long AUTH_BACKOFF_MS = 10000;  // a wrong secret won't fix itself; don't hammer the server

WiFiClient net;
HTTPClient http;
const unsigned long STATUS_MS = 5000;  // how often to explain a missing Wi-Fi connection
unsigned long nextPollAt = 0;
unsigned long nextStatusAt = 0;
bool wasConnected = false;
String line;

// One HTTP call to the API with the hub's bearer secret. Returns the status (< 0 = network error).
int request(const char* method, const char* path, const String& body, String& response) {
  http.begin(net, String(API_BASE) + path);
  http.setTimeout(5000);
  http.addHeader("Authorization", "Bearer " HUB_SECRET);
  if (body.length() > 0) http.addHeader("Content-Type", "application/json");
  int status = http.sendRequest(method, body);
  response = status > 0 ? http.getString() : http.errorToString(status);
  http.end();
  return status;
}

void postEvent(int hanger, bool onRail, bool garmentOn) {
  JsonDocument doc;
  JsonObject event = doc["events"].to<JsonArray>().add<JsonObject>();
  event["hanger"] = hanger;
  event["on_rail"] = onRail;
  event["garment_on"] = garmentOn;
  event["age_ms"] = 0;
  String body;
  serializeJson(doc, body);

  String response;
  int status = request("POST", "/api/hub/events", body, response);
  Serial.printf("event hanger %d on_rail=%d garment_on=%d -> %d %s\n", hanger, onRail, garmentOn, status, response.c_str());
}

void pollCommands() {
  String response;
  int status = request("GET", "/api/hub/commands", "", response);
  if (status == 401) {
    Serial.println("poll -> 401: check HUB_SECRET in secrets.h");
    nextPollAt = millis() + AUTH_BACKOFF_MS;
    return;
  }
  if (status != 200) {
    Serial.printf("poll -> %d %s\n", status, response.c_str());
    return;
  }

  JsonDocument doc;
  if (deserializeJson(doc, response)) {
    Serial.printf("poll -> bad JSON: %s\n", response.c_str());
    return;
  }
  JsonArray commands = doc["commands"];
  if (commands.size() == 0) return;

  // Step 2 has no hangers, so every command is acked once printed.
  // Step 4 acks only commands a hanger actually received.
  JsonDocument ack;
  JsonArray ids = ack["ids"].to<JsonArray>();
  for (JsonObject command : commands) {
    Serial.printf("command %ld: hanger %d -> %s / %s\n", command["id"].as<long>(), command["hanger"].as<int>(),
                  command["color"].as<const char*>(), command["pattern"].as<const char*>());
    ids.add(command["id"]);
  }
  String body;
  serializeJson(ack, body);
  status = request("POST", "/api/hub/commands/ack", body, response);
  Serial.printf("ack %s -> %d\n", body.c_str(), status);
}

// "5 1 0" = hanger 5, on the rail, no garment
void handleLine(const String& text) {
  int hanger, onRail, garmentOn;
  if (sscanf(text.c_str(), "%d %d %d", &hanger, &onRail, &garmentOn) == 3 && hanger >= 1) {
    postEvent(hanger, onRail != 0, garmentOn != 0);
  } else {
    Serial.println("usage: <hanger> <on_rail 0|1> <garment_on 0|1>, e.g. 5 1 0");
  }
}

void readSerial(bool connected) {
  while (Serial.available()) {
    char c = Serial.read();
    if (c != '\n' && c != '\r') {
      line += c;
      continue;
    }
    if (line.length() > 0) {
      if (connected) handleLine(line);
      else Serial.println("not connected to Wi-Fi yet");
    }
    line = "";
  }
}

const char* wifiStatusText(wl_status_t status) {
  switch (status) {
    case WL_NO_SSID_AVAIL: return "network not found: check WIFI_SSID, and that it is 2.4 GHz";
    case WL_CONNECT_FAILED: return "connection failed: check WIFI_PASSWORD";
    case WL_CONNECTION_LOST: return "connection lost";
    case WL_DISCONNECTED: return "disconnected, still trying";
    case WL_IDLE_STATUS: return "idle, still trying";
    default: return "other";
  }
}

// Lists the 2.4 GHz networks the hub can see, so a wrong or unseen SSID is obvious
void printNetworks() {
  int count = WiFi.scanNetworks();
  Serial.printf("Networks the hub can see (%d):\n", count);
  for (int i = 0; i < count; i++) {
    Serial.printf("  \"%s\"  signal %d dBm  channel %d\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i), WiFi.channel(i));
  }
  WiFi.scanDelete();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(LED, OUTPUT);
  WiFi.mode(WIFI_STA);
  printNetworks();
  Serial.printf("Connecting to \"%s\", API at %s\n", WIFI_SSID, API_BASE);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);  // the ESP32 reconnects on its own after a drop
  http.setReuse(true);                   // keep the connection open between polls
}

void loop() {
  bool connected = WiFi.status() == WL_CONNECTED;
  if (connected != wasConnected) {
    if (connected) {
      // The MAC reads as zeros until Wi-Fi has started, so print it here
      Serial.printf("Wi-Fi connected, IP %s, hub MAC %s\n", WiFi.localIP().toString().c_str(), WiFi.macAddress().c_str());
    } else {
      Serial.println("Wi-Fi lost, reconnecting...");
    }
    digitalWrite(LED, connected ? HIGH : LOW);
    wasConnected = connected;
  }
  if (!connected && (long)(millis() - nextStatusAt) >= 0) {
    nextStatusAt = millis() + STATUS_MS;
    Serial.printf("Wi-Fi: %s\n", wifiStatusText(WiFi.status()));
  }

  readSerial(connected);

  if (connected && (long)(millis() - nextPollAt) >= 0) {
    nextPollAt = millis() + POLL_MS;
    pollCommands();
  }
}
