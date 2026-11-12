// Copy this file to secrets.h in the same folder and fill it in.
// secrets.h holds passwords, so it must never be committed (it's in .gitignore).
#pragma once

// The ESP32 only joins 2.4 GHz networks. Your laptop must be on the same one.
#define WIFI_SSID "your-network-name"
#define WIFI_PASS "your-wifi-password"

// Where the Wearly server runs, with no slash at the end.
// pnpm dev on your laptop: http://<laptop's IPv4 address from ipconfig>:3000
// Deployed app (later):    https://<your-app>.vercel.app
#define API_BASE "http://192.168.1.23:3000"

// The seeded dev hub's secret (supabase/seed.sql).
// The deployed database needs its own hub row and its own secret.
#define HUB_SECRET "dev-hub-secret"
