# API

Two audiences use this API:

- **The hub** (the simulator now, the ESP32 later) sends sensor events and fetches light commands. This is the contract between the firmware and the app. Change it only with both sides agreeing.
- **The app** (phone and desktop) calls endpoints for actions with side effects. Plain reads go straight to Supabase with RLS; see [Reads vs. writes](#reads-vs-writes).

All endpoints are Next.js route handlers under `app/api/`. Request and response bodies are JSON, validated with Zod schemas from `lib/api/`. **Those schemas are the contract between frontend and backend:** route handlers parse requests with them, and the UI imports their types. Change a schema and this doc in the same PR, reviewed by both sides.

Conventions for values: dates are `YYYY-MM-DD` in the closet's timezone, timestamps are ISO 8601 with offset, money is in cents, row ids are uuids, and hangers are addressed by **number** in URLs and hub payloads.

> Status: specification. Nothing is implemented yet.

## MVP scope

| In the MVP | After MVP |
| --- | --- |
| `POST /api/hub/events`, `GET /api/hub/commands`, `POST /api/hub/commands/ack` | `POST /api/hangers/{number}/assign` |
| `POST /api/hangers/{number}/find` | `PATCH /api/garments/{id}`, `POST /api/garments/{id}/photo` |
| `POST /api/plans/generate`, `POST /api/plans/{id}/lights` | `POST /api/wears`, `POST /api/outfits/{id}/confirm` |
| `GET /api/swipe/deck`, `POST /api/swipe/decisions` | `PATCH /api/plan-items/{id}` |
| `POST /api/sim/events`, `POST /api/sim/reset` (dev only) | `POST /api/tryon`, `GET /api/tryon/{job_id}` |
| | `POST /api/webhooks/fashn`, `POST /api/cron/*` |

The hub contract is complete in the MVP, so firmware can build against it now.

## Conventions

### Auth

| Caller | How it authenticates | DB access |
| --- | --- | --- |
| Hub | `Authorization: Bearer <device secret>`, checked against `devices.secret_hash` | Service role, scoped in code to the device's closet |
| App | Supabase session (cookie on web, `Authorization: Bearer <access token>` from a Capacitor shell) | User's JWT, so RLS applies |
| FASHN webhook *(after MVP)* | Signature or shared secret (`FASHN_WEBHOOK_SECRET`) | Service role |
| Cron *(after MVP)* | `Authorization: Bearer <CRON_SECRET>` | Service role |

### Errors

Every non-2xx response has the same shape:

```json
{ "error": { "code": "invalid_body", "message": "hanger must be a positive integer", "details": {} } }
```

| Status | `code` examples |
| --- | --- |
| 400 | `invalid_body`, `invalid_query` |
| 401 | `unauthorized` (missing or bad secret or session) |
| 403 | `forbidden` (not a member of that closet) |
| 404 | `not_found` (unknown hanger number, garment, job) |
| 409 | `conflict` (hanger already assigned, duplicate decision) |
| 429 | `rate_limited` |
| 500 | `internal_error` (unexpected server failure) |
| 502 | `upstream_error` (FASHN or Anthropic failed) |

### Hanger identity

The hub and the app refer to hangers by their **number** (`1..n`, engraved on the pod), not by UUID. Numbers are unique per closet.

### Light vocabulary

Matches the light language in the product plan. Only these values are valid.

| `color` | `pattern` | Meaning |
| --- | --- | --- |
| `purple` | `steady` | In today's planned outfit |
| `amber` | `breathe` | Waiting a long time, or marked to let go |
| `white` | `blink2` | Find it, or paired after an NFC tap |
| `off` | `off` | Default |

---

## Hub API (firmware contract)

### `POST /api/hub/events`

Send one or more hanger state changes. The hub sends the **full current state** of the hanger (both sensors), not a diff, so a lost message is fixed by the next one.

The hub has no reliable clock. The server timestamps events, and `age_ms` tells it how long ago each event happened. That covers events buffered while Wi-Fi was down.

```http
POST /api/hub/events
Authorization: Bearer <device secret>
Content-Type: application/json
```

```json
{
  "events": [
    { "hanger": 7, "on_rail": true, "garment_on": false, "age_ms": 0, "seq": 1042 }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `events` | array, 1–100 | Oldest first |
| `hanger` | int ≥ 1 | Hanger number |
| `on_rail` | bool | Reed or hall sensor: hanger is on the rod |
| `garment_on` | bool | Load switch: a garment is on the hanger |
| `age_ms` | int ≥ 0, optional | How long ago it happened; default 0. `occurred_at = now() - age_ms` |
| `seq` | int, optional | Per-hanger counter from the hanger; used to drop duplicates after retries |

Response `200`:

```json
{ "accepted": 1, "duplicates": 0, "unknown_hangers": [] }
```

- Unknown hanger numbers are reported in `unknown_hangers`, not rejected. The app can then offer to register them.
- Each call also updates `devices.last_seen_at`. That's the hub's heartbeat.
- The hub should retry with backoff on network errors and 5xx, and **not** retry on 4xx.

### `GET /api/hub/commands`

Poll for pending light commands, about once a second. The server returns at most one command per hanger: the newest one that hasn't been acknowledged or expired.

The poll also triggers the closet's wear sweep, throttled on the server; see [backend.md](backend.md#sweep). The hub doesn't need to do anything for this.

```http
GET /api/hub/commands
Authorization: Bearer <device secret>
```

Response `200`:

```json
{
  "commands": [
    { "id": 881, "hanger": 3, "color": "purple", "pattern": "steady" },
    { "id": 882, "hanger": 18, "color": "amber", "pattern": "breathe" }
  ]
}
```

### `POST /api/hub/commands/ack`

Tell the server which commands were forwarded to hangers. Unacknowledged commands are returned again on the next poll, so a reboot or a dropped ESP-NOW packet doesn't lose them.

```json
{ "ids": [881, 882] }
```

Response `204`.

### Firmware notes

- ESP-NOW and Wi-Fi share one radio. Hangers must send on the hub's Wi-Fi channel; a mismatch fails silently.
- For the demo, `WiFiClientSecure::setInsecure()` is acceptable. Pin the certificate before any real deployment.
- Debounce sensor changes on the hanger (about 200 ms) so a jiggle isn't an event.

---

## App API

### Reads vs. writes

- **Reads** (closet grid, garment stats, plans, deck candidates) use supabase-js directly against tables and views, under RLS. They need no endpoint and work the same in a Capacitor shell.
- **Writes that are more than a row update** go through these endpoints: anything that queues a light command, calls an external service, or touches several tables.

All app endpoints act on the caller's closet. A user with several closets passes `closet_id`; otherwise the default closet is used.

### Hangers

| Method & path | Body | Does |
| --- | --- | --- |
| `POST /api/hangers/{number}/find` | – | Queues `white/blink2` on that hanger. `202 { command_id }` |
| `POST /api/hangers/{number}/assign` *(after MVP)* | `{ "garment_id": "uuid" }` or `{ "new_garment": { ... } }` | Re-pairs a hanger after an NFC tap. Ends the old assignment, starts a new one, blinks white |

### Garments (after MVP)

| Method & path | Body | Does |
| --- | --- | --- |
| `PATCH /api/garments/{id}` | `{ name?, category?, color?, seasons?, formality?, price_cents? }` | Edit details; sets `tags_source = 'user'` for changed tags |
| `POST /api/garments/{id}/photo` | `multipart/form-data` with `photo` | Stores the original, then starts background-removal and tagging jobs. `202 { jobs: [...] }` |
| `POST /api/wears` | `{ garment_id, worn_on }` | Manual wear (folded clothes, corrections) |
| `POST /api/outfits/{id}/confirm` | `{ correct: boolean, garment_ids?: [] }` | Confirms or corrects an inferred outfit |

### Plan

| Method & path | Body | Does |
| --- | --- | --- |
| `POST /api/plans/generate` | `{ week_start: "2026-10-26", replace?: boolean }` | Runs the planner with forecast, events, laundry and history. `week_start` is a Monday. `200 { plan_id }` |
| `POST /api/plans/{id}/lights` | `{ day: "2026-10-26" }` | Pushes `purple/steady` for that day's hangers and turns other purple hangers off. `202 { command_ids: number[], hangers: number[] }`. In the MVP, the Plan screen's "Light up tomorrow" button calls it; after MVP, a morning cron does too |
| `PATCH /api/plan-items/{id}` *(after MVP)* | `{ garment_id }` or `{ status: "skipped" }` | Swap a piece or skip a day. Recorded as planner feedback |

`generate` only returns the plan id. The UI reads the plan from `plans` and `plan_items` with supabase-js, so a plan has one shape. `plans.forecast` is `jsonb`; its shape is the `Forecast` schema in `lib/api/plans.ts`: per day `{ day, high_c, low_c, rain, condition: "clear" | "cloudy" | "rain" | "snow", summary }`.

### Swipe

| Method & path | Body | Does |
| --- | --- | --- |
| `GET /api/swipe/deck` | – | Returns ordered candidates and queues `amber/breathe` for the top card's hanger. `200 { cards: SwipeCard[], lit_hanger: number \| null }` |
| `POST /api/swipe/decisions` | `{ garment_id, decision: "keep" \| "let_go" \| "style", route?: "donate" \| "resell" \| "swap" }` | Records the decision. `route` is required for `let_go` and ignored otherwise. `keep` starts a 30-day challenge and boosts the item in next week's plan. `let_go` sets the garment to `let_go` and keeps the hanger amber until the garment leaves. `200 { garment_status, challenge_until: string \| null, listing: Listing \| null }`; `listing` is set for `resell` |

The deck is an endpoint, not a plain read, because it calls the seasonal-idle logic and lights the hanger.

- **`SwipeCard`:** `garment_id`, `hanger_number` (nullable), `name` (nullable: no photo or tags yet), `photo_path` (nullable), `category` (nullable), `idle_days_in_season`, `browsed_count`, `wears_90d`, `waiting_since` (`YYYY-MM-DD`: last wear, or when the garment was added; for copy like "waiting since March"), `price_cents` (nullable).
- **`Listing`:** `{ title, body, price_min_cents, price_max_cents }`.

### Try-on (FASHN, after MVP)

In the MVP, Style it shows pre-generated static images and calls no endpoint.

| Method & path | Body | Does |
| --- | --- | --- |
| `POST /api/tryon` | `{ garment_ids: ["uuid", ...] }` | Creates (or reuses from cache) a try-on job on the user's model photo. `202 { job_id, status }` |
| `GET /api/tryon/{job_id}` | – | `{ status: "queued" \| "running" \| "done" \| "failed", image_url? }`. `image_url` is a signed Supabase Storage URL |

The client can poll this endpoint, or subscribe to the `ai_jobs` row through Realtime.

---

## Webhooks and cron (after MVP)

In the MVP, the sweep runs on ingest and on command polls, and purple lights are pushed from the Plan screen, so neither cron job is needed.

| Method & path | Caller | Does |
| --- | --- | --- |
| `POST /api/webhooks/fashn` | FASHN | Marks the job done or failed, copies output images into Storage (FASHN output URLs are temporary), chains the next step for multi-garment outfits |
| `POST /api/cron/sweep` | pg_cron (via pg_net) | Classifies long-open absences (worn while still out, missing after 14 days), infers outfits, expires stale commands |
| `POST /api/cron/morning-lights` | pg_cron | Pushes today's purple commands for each closet at its local morning |

---

## Dev-only

Disabled when `NODE_ENV=production`.

| Method & path | Does |
| --- | --- |
| `POST /api/sim/events` | Same body as `POST /api/hub/events`; the server adds `HUB_DEV_SECRET` and forwards to the hub ingest, so the `/sim` page never holds the secret |
| `POST /api/sim/reset` | Resets hangers to "in closet" with lights off, drops open absences (and their provisional wears) and pending commands for the dev closet. `200 { hangers }` |
| `POST /api/sim/poll` | One hub poll cycle: runs the sweep, returns the pending commands and acks them all, as the firmware would. `200 { commands, sweep }` |
| `GET /api/sim/state` | The dev closet's wear profile and hangers: sensors, light and current garment. `200 { profile, hangers }` |
| `POST /api/sim/lights` | `{ hangers: number[], light }`: queues that light on those hangers (Find it, lights off). `202 { command_ids }` |

`POST /api/sim/events` also returns `absences`: each touched hanger's latest absence with its classification, for the simulator's event log.

The simulator needs no special endpoint to fake long durations. To simulate "out for 8 hours," it sends the `garment_on: false` event with `age_ms: 28800000` and then the `garment_on: true` event with `age_ms: 0`, all through the normal hub API.
