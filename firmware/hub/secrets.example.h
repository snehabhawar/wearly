// Copy to secrets.h (git ignores it) and fill in.
#pragma once

// 2.4 GHz only: the ESP32 can't join 5 GHz networks
#define WIFI_SSID "your-wifi"
#define WIFI_PASSWORD "your-password"

// The PC running `pnpm dev`, by its LAN IP (find it with `ipconfig`), no trailing slash
#define API_BASE "http://192.168.1.10:3000"

// The seeded dev hub (supabase/seed.sql)
#define HUB_SECRET "dev-hub-secret"
