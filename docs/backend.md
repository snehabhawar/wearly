# Backend

The backend is Supabase (Postgres, Auth, Storage, Realtime, pg_cron) plus Next.js route handlers on Vercel. The domain logic (wear engine, planner, deck, AI clients) lives in `lib/` as plain TypeScript with no Next.js imports.

> Status: specification. Nothing is implemented yet. Endpoint shapes are in [api.md](api.md).

## MVP scope

The MVP covers the demo script and nothing more. Everything marked *after MVP* below stays as the long-term spec.

**In the MVP**
- Tables: `closets` (with `owner_id`), `devices`, `hangers`, `garments`, `hanger_assignments`, `sensor_events`, `absences`, `wears`, `plans`, `plan_items`, `swipe_decisions`, `commands`; views `garment_stats`, `closet_summary`
- RLS by closet owner (`owner_id = auth.uid()`)
- Hub ingest in `lib/hub/`, and the wear engine with `real` and `demo` profiles
- A sweep that runs on ingest and on the hub's command polls, with no cron
- A rule-based planner using Open-Meteo, hard-coded calendar events and wear history
- Swipe deck, decisions, rehoming and impact counter
- Demo garment photos and pre-generated try-on images as static files in `public/demo/`
- Seed data and 3 months of fake history

**After MVP**
- Shared closets (`closet_members`), `profiles`, `outfits`, `calendar_events`, `ai_jobs`
- Storage buckets and the photo pipeline
- Live FASHN try-on
- Outfit inference
- pg_cron sweep and morning lights
- Replay script
- Planner learning
- 30-day challenge resurfacing

## Principles

- **The raw event log is the source of truth.** `sensor_events` is append-only. Everything derived from it (absences, wears, outfits) can be rebuilt by replaying it through the wear engine, so thresholds can be retuned on real data.
- **Garments and hangers are separate.** A hanger is hardware; a garment is clothing. `hanger_assignments` links them over time. This covers NFC re-pairing, a shirt put back on the wrong hanger, and freeing a hanger after a garment is rehomed.
- **No photo required.** A garment row can exist with only a hanger number. Photos, names and tags fill in later.
- **The database stamps time.** The hub has no clock; `occurred_at = received_at - age_ms`.
- **Everything is scoped to a closet.** RLS checks closet membership on every table.

## Data model

Migrations live in `supabase/migrations/`. Types are generated into `lib/supabase/types.ts` with `pnpm db:types`.

### Core

| Table | Key columns | Notes |
| --- | --- | --- |
| `closets` | `id`, `owner_id`, `name`, `timezone`, `wear_profile` (`real` \| `demo`), `latitude`, `longitude`, `last_swept_at` | One per user. `timezone` decides local dates; the coordinates feed the forecast; `last_swept_at` throttles the closet-wide sweep |
| `closet_members` | `closet_id`, `user_id`, `role` (`owner` \| `member`) | *After MVP:* shared closets. RLS then switches from `owner_id` to membership |
| `profiles` | `user_id`, `display_name`, `model_photo_path` | *After MVP:* model photo for live FASHN try-on |
| `devices` | `id`, `closet_id`, `kind` (`hub`), `name`, `secret_hash`, `last_seen_at` | Hub auth. Secrets stored hashed |
| `hangers` | `id`, `closet_id`, `number`, `on_rail`, `garment_on`, `led_color`, `led_pattern`, `state_changed_at` | `unique (closet_id, number)`. Current state only; history is in `sensor_events` |
| `garments` | `id`, `closet_id`, `name`, `category`, `color`, `seasons text[]`, `formality smallint (1–5)`, `price_cents`, `photo_path`, `cutout_path`, `tags_source` (`ai` \| `user`), `status` (`active` \| `let_go` \| `rehomed` \| `missing`) | All descriptive fields nullable. In the MVP, `photo_path` points to `public/demo/` and tags are hand-written in the seed |
| `hanger_assignments` | `id`, `hanger_id`, `garment_id`, `started_at`, `ended_at` | Partial unique indexes: one open assignment per hanger and per garment |

### Sensing and wears

| Table | Key columns | Notes |
| --- | --- | --- |
| `sensor_events` | `id bigint identity`, `closet_id`, `device_id`, `hanger_id`, `on_rail`, `garment_on`, `seq`, `occurred_at`, `received_at` | Append-only. `unique (hanger_id, seq)` where `seq` is not null, for dedupe |
| `absences` | `id`, `hanger_id`, `garment_id`, `left_at`, `returned_at`, `classification`, `outfit_id` | One row per "garment away" session. `classification`: `open`, `browsed`, `tried_on`, `worn`, `worn_washed`, `missing` |
| `wears` | `id`, `garment_id`, `worn_on date`, `source` (`sensor` \| `manual` \| `confirmed`), `absence_id`, `outfit_id` | What every stat counts. MVP only writes `sensor` wears; `outfit_id` stays null |
| `outfits` | `id`, `closet_id`, `worn_on`, `inferred bool`, `confirmed_at` | *After MVP:* grouped wears |
| `outfit_items` | `outfit_id`, `garment_id` | *After MVP* |

### Planning, decisions, lights, AI

| Table | Key columns | Notes |
| --- | --- | --- |
| `calendar_events` | `closet_id`, `starts_at`, `title`, `dress_code` | *After MVP.* The MVP uses a hard-coded event list in `lib/planner/demo-events.ts`; Google Calendar sync comes later |
| `plans` | `id`, `closet_id`, `week_start`, `generated_at`, `forecast jsonb` | One per closet per week |
| `plan_items` | `id`, `plan_id`, `day`, `slot` (`top` \| `bottom` \| `outer` \| `one_piece`), `garment_id`, `hanger_id`, `reason`, `status` (`planned` \| `worn` \| `swapped` \| `skipped`) | `hanger_id` without a photographed garment = mystery pick |
| `swipe_decisions` | `id`, `garment_id`, `decision` (`keep` \| `let_go` \| `style`), `route` (`donate` \| `resell` \| `swap`), `challenge_until`, `decided_at` | |
| `commands` | `id bigint identity`, `closet_id`, `hanger_id`, `color`, `pattern`, `reason`, `created_at`, `expires_at` (not null, default 5 minutes), `acked_at` | Light command queue for the hub. Plan lights set their own expiry (end of that local day). On ack, a trigger copies `color`/`pattern` into `hangers.led_color`/`led_pattern`, except momentary `white/blink2` |
| `ai_jobs` | `id`, `closet_id`, `kind` (`tryon` \| `tagging` \| `bg_remove`), `provider`, `provider_job_id`, `status`, `input jsonb`, `output jsonb`, `output_path`, `cache_key`, `error`, `created_at`, `finished_at` | *After MVP:* one table for all external AI calls |

### Views

- **`garment_stats`:** per garment: `wears_90d`, `wears_ytd`, `last_worn_on`, `browsed_count` (browsed + tried-on absences that never became a wear), `cost_per_wear` (`price_cents / wears_ytd`), `idle_days_in_season`.
- **`closet_summary`:** per closet: hanger count, photographed count, % of active garments worn in the last 90 days, rehomed this year.

### Row-level security

- Helper: `owns_closet(closet_id uuid) returns boolean`, which is `security definer` and checks `closets.owner_id = auth.uid()`. *After MVP*, its body switches to checking `closet_members`, and policies stay unchanged.
- Every table with `closet_id` gets select, insert, update and delete policies using that helper. Child tables (`absences`, `wears`, `plan_items`, …) check through their parent.
- `sensor_events`, `absences` and `commands` are **read-only** for users. Only the service role writes them (hub ingest, wear engine, cron).
- `devices.secret_hash` is never selectable by users.

### Realtime

Enabled on `hangers`, `absences`, `wears` and `commands` (plus `ai_jobs` after MVP). The app subscribes filtered by `closet_id`.

### Storage buckets

*After MVP.* The MVP serves demo photos and try-on images as static files from `public/demo/`.

| Bucket | Contents | Access |
| --- | --- | --- |
| `garments` | Originals and background-removed cutouts: `{closet_id}/{garment_id}/original.jpg`, `cutout.png` | Private, signed URLs |
| `profiles` | Model photos for try-on | Private, owner only |
| `tryon` | FASHN results copied out of FASHN's temporary URLs | Private, signed URLs |

## Wear engine (`lib/wear-engine/`)

A pure function from events to state changes. It's called by the hub ingest route, the sweep cron and the replay script, and it's unit-tested with Vitest.

### Hanger states

From the product plan's two-sensor table:

| `on_rail` | `garment_on` | Meaning | "Away"? |
| --- | --- | --- | --- |
| true | true | In the closet | no |
| true | false | Garment taken off the hanger (most common) | **yes** |
| false | true | Taken out on its hanger | **yes** |
| false | false | Empty hanger moved | ignore; leave any open absence as is |

- **not away → away:** open an absence (`left_at = occurred_at`, `classification = 'open'`).
- **away → not away:** close it (`returned_at`) and classify by duration.

### Classification thresholds

Stored as config profiles; each closet picks one with `wear_profile`.

| Classification | `real` | `demo` | Effect |
| --- | --- | --- | --- |
| `browsed` | < 20 min | < 5 s | Counts as "considered," not a wear |
| `tried_on` | 20 min – 3 h | 5–12 s | Soft signal; not a wear unless confirmed |
| `worn` | 3 h – 36 h | 12–20 s | One wear, on the local date of `left_at` |
| `worn_washed` | 36 h – 14 d | 20–60 s | One wear; resets "wears since wash" |
| `missing` | > 14 d (still open) | > 60 s | Garment status `missing`; app asks once: packed, lent or gone? |

The thresholds are starting guesses. Keep them in one file and tune them from real hanger data.

### Outfit inference (after MVP)

When absences close as `worn`, group those whose `left_at` falls within **30 minutes** of each other on the same local morning into one `outfit` (`inferred = true`). The app then asks "Looks like you wore X and Y on Tuesday" for confirmation.

### Sweep

**MVP:** the sweep runs for a hanger on every ingest. It also runs for the whole closet on the hub's `GET /api/hub/commands` polls, throttled to every poll in `demo` and every 5 minutes in `real` (tracked in `closets.last_swept_at`). The hub polls every second, so no cron is needed. It handles:

- Open absences past the `worn` threshold: write a provisional wear now, so it shows up the same day.
- Open absences past the `missing` threshold: mark them missing and delete their provisional wear (missing isn't a wear).
- Let-go garments that have left: mark them rehomed (see [Swipe deck](#swipe-deck)). Ending the assignment also closes the garment's open absence at that moment, so the next garment hung on the hanger starts clean.

`replayHanger()` in `lib/wear-engine/replay.ts` applies the same rules to a hanger's whole event history; the seed history script uses it, and so will the replay script.
- Expiring commands older than `expires_at`.

*After MVP:* outfit grouping joins the sweep, and a pg_cron job (`/api/cron/sweep`) covers times when the hub is offline. Vercel's free plan only runs cron jobs daily, which is why scheduling would live in pg_cron.

### Replay (after MVP)

`scripts/replay.ts` clears derived tables for a closet and replays `sensor_events` through the engine. Use it after changing thresholds.

## Planner (`lib/planner/`)

Rule-based, pure TS with tests. Called from `POST /api/plans/generate` (and a Sunday cron after MVP).

**Inputs:** a 7-day forecast (Open-Meteo, using the closet's coordinates), calendar events with dress codes (hard-coded in `lib/planner/demo-events.ts` for the MVP), wear history from `garment_stats`, garments currently out or in the laundry (open absences and recent `worn_washed`), and active keep challenges. Past `plan_items` feedback is added after MVP.

**Rules, in order:**

1. One outfit per day: `top + bottom` or `one_piece`, plus `outer` when the high is under about 16 °C or rain is forecast.
2. Exclude garments that are out, in the laundry, or `let_go` / `rehomed`.
3. Match the dress level: the event's dress code against `formality` (±1).
4. Respect the weather: season tags and temperature band.
5. No repeated piece within 3 days.
6. Score to favor under-worn items (`idle_days_in_season`, low `wears_90d`), with a boost for active keep challenges.
7. Hangers without a photo can be used as **mystery picks** for slots where the category is unknown.
8. Write a short `reason` for each day, in the app's warm, non-judgmental tone.

**Learning (after MVP):** swaps and skips lower a garment's score for similar contexts; plan vs. actual comes from comparing `plan_items` with `wears`.

## Swipe deck

**Candidates:** active garments whose `idle_days_in_season ≥ 180`. Idle days only count days inside the garment's seasons, so a winter coat isn't flagged in July.

**Order:** the strongest "considered but not worn" signal first (`browsed_count` high, wears low), then by idle time.

**Decisions:**

- **Keep:** set `challenge_until = now + 30 days` and boost the garment in next week's plan. *After MVP:* if it's still unworn when the challenge ends, it comes back to the deck with a note.
- **Let go:** set garment status `let_go` and keep the hanger `amber/breathe`. When the garment leaves and stays away past the `browsed` threshold (5 s in `demo`, 20 min in `real`), set status `rehomed`, end the assignment, turn the light off, and increment the impact counter. The short threshold keeps demo step 4 snappy; it can be tuned after MVP.
- **Resell:** return listing text built from the garment's tags (title, category, suggested price range) for the share sheet. No marketplace APIs; AI-drafted listings come after MVP.
- **Style:** open Style it. In the MVP, it shows pre-generated images.

**Photos:** in the MVP, a candidate with no photo shows its hanger number. The "tap the hanger, snap a photo" prompt comes after MVP.

## AI jobs (after MVP)

**MVP:** no external AI calls. Style it reads pre-generated try-on images from `public/demo/tryon/`, mapped to garment IDs in `lib/demo/tryon.ts`. Generate them once by hand with FASHN's web app or API before the demo.

After MVP, all external AI calls go through `ai_jobs`, so they're observable, cacheable and retryable.

### FASHN try-on (`lib/fashn/`)

1. `POST /api/tryon` builds a `cache_key` from the model photo hash and the sorted garment IDs. A finished job with the same key is returned immediately.
2. Otherwise it submits to FASHN with the model photo and the first garment's cutout (signed URLs), and stores `provider_job_id`.
3. Results come back through the FASHN webhook, or through polling FASHN's status endpoint as a fallback.
4. FASHN output URLs are temporary, so results are copied into the `tryon` bucket.
5. Multi-garment outfits are chained: try on the top, then use that result as the model image for the bottom or outer layer.
6. For the live demo, pre-generate the demo outfits so nothing waits on the API.

Check FASHN's current docs for model names, input fields and the webhook format before implementing.

### Photo pipeline (`lib/tagging/`)

1. The original is uploaded to `garments/{closet}/{garment}/original.jpg`.
2. **Background removal** produces `cutout.png`, which is used everywhere the garment is shown and as the FASHN input. Use FASHN's background-removal endpoint if it fits, otherwise any remover.
3. **Tagging:** Claude (`claude-haiku-5-5`) gets the image and returns JSON validated by Zod: `{ category, color, seasons[], formality, name_suggestion }`. Results are only written to fields where `tags_source` isn't `user`.

## Hub ingest flow (`POST /api/hub/events`)

1. Verify the bearer secret against `devices.secret_hash` to get the device and closet.
2. Validate the body with Zod.
3. For each event: resolve `hanger_id` by number, insert into `sensor_events` (skipping duplicate `seq`), update `hangers` current state (unless a newer state is already there), and run the wear engine's `stepHanger` for that hanger: open an absence, or close it, classify it and write or drop its wear.
4. Update `devices.last_seen_at`.
5. Realtime pushes the `hangers`, `absences` and `wears` changes to the app.

The logic lives in `lib/hub/` (plain TypeScript on the service-role client) and `lib/wear-engine/step.ts`, which applies the same rules as `replayHanger`. There is no single transaction: the unique indexes on open absences (one per hanger), `wears.absence_id` and `sensor_events (hanger_id, seq)` turn a race between two near-simultaneous requests into a skipped duplicate instead of a double write.

## Seed data

- `supabase/seed.sql`: a demo user (email + password), a closet (`wear_profile = demo`, with coordinates), one hub device with `HUB_DEV_SECRET`, 24 hangers, and 18 garments with hand-written tags and photos in `public/demo/`. Hangers 19–24 have no photo. The garments don't follow the mockup's layout: the mockup is the visual spec, and screen content follows this seed.
- `scripts/seed-history.ts`: generates about 3 months of plausible `sensor_events` and replays them, so stats look real. It includes:
  - a few clearly forgotten items (hangers 8, 12, 18 and 24),
  - one item that's often browsed but never worn (hanger 18),
  - three rehomed garments.
