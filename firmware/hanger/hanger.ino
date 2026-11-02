#include <WiFi.h>

const int LED = 8;  // C3 Super Mini onboard LED, on when LOW

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
