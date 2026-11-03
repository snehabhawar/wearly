// Wearly radio messages between the hangers and the hub (ESP-NOW).
// The same file sits in firmware/hub/ and firmware/hanger/. Keep both copies identical:
// if they differ, the hub and the hangers stop understanding each other.
#pragma once
#include <stdint.h>

const uint8_t WEARLY_PROTOCOL = 1;  // change this if the messages below ever change

enum MsgType : uint8_t { MSG_STATE = 1, MSG_LIGHT = 2 };

// Why a hanger sent its state
enum StateKind : uint8_t {
  KIND_CHANGE = 0,     // a sensor changed: the hub posts it to the API
  KIND_BOOT = 1,       // the hanger just started: the hub posts it and re-sends the hanger's light
  KIND_HEARTBEAT = 2,  // "still here", every 60 s: the hub only refreshes its hanger list
};

// Each color has one fixed pattern: purple/steady, amber/breathe, white/blink2, off/off
enum LightCode : uint8_t { LIGHT_OFF = 0, LIGHT_PURPLE = 1, LIGHT_AMBER = 2, LIGHT_WHITE = 3 };

// Hanger -> hub: the hanger's full state (not just what changed)
struct __attribute__((packed)) StateMsg {
  uint8_t type;       // MSG_STATE
  uint8_t protocol;   // WEARLY_PROTOCOL
  uint16_t hanger;    // hanger number, 1..n
  uint8_t onRail;     // 1 = on the rod
  uint8_t garmentOn;  // 1 = a garment is on the hanger
  uint8_t kind;       // StateKind
};

// Hub -> hanger: show a light
struct __attribute__((packed)) LightMsg {
  uint8_t type;       // MSG_LIGHT
  uint8_t protocol;   // WEARLY_PROTOCOL
  uint16_t hanger;    // the hanger it's for; any other hanger ignores it
  uint8_t light;      // LightCode
};
