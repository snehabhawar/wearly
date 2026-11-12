// Copy this file to config.h in the same folder and fill it in.
// Every hanger can use the same config.h: the hanger number is set over Serial.
#pragma once

// The hub's MAC address, from the hub's Serial Monitor ("Hub MAC: 34:85:18:AB:CD:EF").
// Write each pair with 0x in front: 34:85:18:AB:CD:EF becomes the line below.
#define HUB_MAC {0x34, 0x85, 0x18, 0xAB, 0xCD, 0xEF}

// The Wi-Fi network the HUB joins (the same name as WIFI_SSID in the hub's secrets.h).
// The hanger never joins it; it only looks up which channel it's on. No password needed.
#define HUB_WIFI_SSID "your-network-name"

// Used only if that network can't be found when the hanger starts.
// The hub prints its channel at startup ("Wi-Fi connected: ..., channel 6").
#define FALLBACK_CHANNEL 1

// The hanger number the first time a board starts. After that, type "number 8" in the
// Serial Monitor to change it; the board saves it and keeps it after a restart.
#define DEFAULT_HANGER_NUMBER 1
