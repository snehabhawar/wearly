#include <WiFi.h>

const int LED = 2;  // onboard LED on most ESP32-WROOM DevKits

void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(LED, OUTPUT);
  WiFi.mode(WIFI_STA);
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
}

void loop() {
  digitalWrite(LED, LOW);  delay(500);
  digitalWrite(LED, HIGH); delay(500);
  Serial.println("alive");
}

