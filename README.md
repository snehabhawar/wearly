# Wearly

Smart hangers that notice what you actually wear. Wearly hangers sense when a garment leaves and comes back; a small hub relays those events to the cloud; the app turns them into wear insights, a weekly outfit plan, and a Keep-or-Let-go deck. The closet itself talks back through three small lights on each hanger: blue, yellow and white.

This repo holds the **web app, API and backend**. The hardware isn't built yet, so everything runs against a **virtual hub simulator** that speaks the same API the real ESP32 hub will use. When the hardware arrives, the hub points at the same endpoints and nothing else changes.

> **Status:** the **MVP** screens are built on `dev` (homepage, Today, Closet, Plan, Swipe, Style it, `/sim`); next are deploying, a phone test, the real hub and rehearsal. See [Roadmap](#roadmap).

## UI mockup

[Wearly App Mockup](https://claude.ai/artifact/E8aWsZqMko2VrhDzJ8jNUa): phone screens, desktop screens, homepage and hub simulator (private; ask Tam for access). The MVP builds the phone and desktop screens, the simulator and a short homepage. The mockup is the visual spec; screen content follows `supabase/seed.sql`.

## Engineering docs

| Doc | What's in it |
| --- | --- |
| [docs/frontend.md](docs/frontend.md) | Routes, layouts, design tokens, components, data fetching, PWA |
| [docs/backend.md](docs/backend.md) | Data model, RLS, wear engine, planner, swipe deck, AI jobs |
| [docs/api.md](docs/api.md) | Hub contract (for firmware), app endpoints, error format |
| [docs/working-together.md](docs/working-together.md) | Frontend/backend contract, folder ownership, Git workflow, and the task split |

Each doc starts with an **MVP scope** section. Anything marked *after MVP* is the long-term spec: don't build it until the MVP is done.

## How it fits together

```
 Virtual hub (/sim)  ─┐  POST /api/hub/events        ┌──────────────────────────────┐
 later: ESP32 hub    ─┴─────────────────────────────►│ Next.js on Vercel            │
                       ◄─────────────────────────────│  • Hub API + app API         │
                         GET  /api/hub/commands      │  • Wear engine (lib/)        │
                         POST /api/hub/commands/ack  │  • Planner, swipe deck       │
 Phone (PWA)  ◄──────── Realtime ─────────────────── └──────────────┬───────────────┘
        │  reads: supabase-js + RLS                                  │
        └─ writes with side effects: /api/*  ──────────────►  Supabase (Postgres, Auth,
                                                              Storage, Realtime)
                                                                         Open-Meteo
```

1. A hanger changes state (garment lifted, hanger taken off the rail).
2. The hub posts the event to `/api/hub/events`.
3. The server stores the raw event, runs the **wear engine**, and opens or closes an *absence* (browsed, tried on, worn, missing).
4. The app updates live through Supabase Realtime.
5. App actions (Find it, tomorrow's plan, swipe deck) queue **light commands**. The hub polls `/api/hub/commands`, lights the hangers, and confirms each command with `/api/hub/commands/ack`. Unconfirmed commands are sent again on the next poll.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript, pnpm |
| UI | Tailwind CSS, shadcn/ui, Motion (swipe deck, light animations) |
| Data | Supabase: Postgres + RLS, Auth, Storage, Realtime |
| Client data | supabase-js, TanStack Query |
| Validation | Zod (hub payloads, API bodies) |
| Weather | Open-Meteo (free, no key) |
| Tests | Vitest (wear engine, planner) |
| Hosting | Vercel + Supabase Cloud |
| Phone app | PWA |
| *After MVP* | FASHN live try-on, Claude (`claude-haiku-5-5`) photo tagging, pg_cron, Playwright, Capacitor if we need store apps |

### Two rules that keep the Capacitor option open

1. **Server logic lives behind `/api/*` routes**, never in server components or server actions that a static export can't run.
2. **`lib/` has no Next.js imports.** The wear engine and planner are plain TypeScript, so tests, scripts and a future mobile shell can reuse them.

## Repo layout

Items marked † come after MVP.

```
app/
  (marketing)/page.tsx        homepage (short MVP version)
  (app)/today | closet | closet/[garmentId] | plan | swipe | style/[garmentId]
  h/[hanger]/                 † NFC landing page
  sim/                        virtual hub simulator (dev only: 404 in production)
  login/
  api/
    hub/events, hub/commands, hub/commands/ack
    hangers/[number]/find, plans/, swipe/
    sim/                      dev-only helpers for /sim
    garments/, wears/, outfits/, plan-items/, tryon/, webhooks/, cron/   †
components/                   UI components (see docs/frontend.md)
lib/
  wear-engine/                pure TS + tests
  hub/                        hub ingest, light commands, the sweep
  planner/  swipe/  weather/
  queries/                    TanStack Query hooks (reads under RLS)
  api/                        Zod schemas shared by routes and callers
  supabase/                   clients and generated types
  demo/                       Style it looks for the demo garments
  fashn/  tagging/            †
public/demo/                  demo garment photos and pre-generated try-on images
supabase/
  migrations/
  seed.sql
scripts/
  seed-history.ts             3 months of fake wear history
  prepare-photos.ts           photos/raw/NN.jpg -> public/demo/garments/NN.webp (rembg, local)
  generate-tryon.ts           Style it images via FASHN (dev-time, dry run by default)
  replay.ts                   † rebuild wears from raw events after tuning thresholds
firmware/                     hanger + hub Arduino code
docs/
```

## Getting started

### Prerequisites

- Node 20+ and pnpm (`npm i -g pnpm`)
- A Supabase Cloud project for development (no Docker). Run `pnpm exec supabase login` once.
- Optional, for demo photos: Python with `pip install "rembg[cpu]"`

### Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client reads under RLS (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: hub ingest, light commands, `seed:history`. Never expose to the client |
| `NEXT_PUBLIC_APP_URL` | Absolute app URL |
| `HUB_DEV_SECRET` | Secret of the seeded dev hub; the simulator sends it |
| `WEAR_PROFILE` | `real` or `demo` (default for new closets; demo uses seconds) |
| `FASHN_API_KEY` | Dev-time only: `pnpm tryon:generate`. The app makes no AI calls in the MVP |

After MVP: `CRON_SECRET`, `FASHN_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`.

### Run it

```bash
pnpm install
pnpm db:link         # once: link the CLI to your Supabase project
pnpm db:reset        # WIPES the linked DB, then migrations + seed
pnpm seed:history    # 3 months of fake wears
pnpm dev             # http://localhost:3000
```

Then sign in with the seeded demo account (`demo@wearly.app`, see `supabase/seed.sql`) and open:

- `/sim` to fire hanger events by clicking virtual hangers
- `/closet` to watch them arrive live
- `/` for the homepage

Other scripts: `pnpm test` (Vitest), `pnpm lint`, `pnpm build`, `pnpm db:push` (new migrations), `pnpm db:types` (regenerate `lib/supabase/types.ts`), `pnpm photos:prepare`, `pnpm tryon:generate`.

> Free Supabase projects pause after 7 days of low activity. Open the dashboard the day before a demo.

### Deploying (Vercel)

- Add the variables from the table above in the Vercel project (Production), with `NEXT_PUBLIC_APP_URL` set to the deployed URL. `FASHN_API_KEY` isn't needed.
- `/sim` and `/api/sim/*` are off in production (`NODE_ENV`), so a deployed demo needs the real hub, or run the simulator from a local `pnpm dev` against the same Supabase project.
- The seeded hub secret (`dev-hub-secret`) and the demo password are in this repo. Anyone who knows them can send hub events or sign in to the demo closet, so change both in the database before sharing the URL publicly, and run `pnpm db:reset` + `pnpm seed:history` before a demo.

## Roadmap

### MVP (about 3 weeks)

The goal is the [demo script](#demo-script-what-the-mvp-must-support), on a phone, looking finished.

**Milestone 1: foundation and hub (week 1)**
- [x] Scaffold Next.js, Tailwind, shadcn/ui, theme tokens, PWA manifest, `.env.example`
- [x] Supabase migrations for the MVP tables, owner-based RLS, generated types
- [x] One seeded demo account (email + password)
- [x] Hub API (`events`, `commands`, `ack`) and wear engine with Vitest tests (`real` and `demo` profiles)
- [x] `/sim` page
- [x] Seed data: 24 hangers, demo garments with photos in `public/demo/` (hanger 15 to retake), hand-written tags, 3 months of history
- [ ] **Checkpoint:** hand the hub contract to the firmware team

**Milestone 2: core screens (week 2)**, phone and desktop layouts
- [x] Closet: live wear grid, item detail, Find it
- [x] Swipe: seasonal deck, yellow light, keep / let go (donate, resell, swap), rehomed, impact counter
- [x] Plan: rule-based planner with Open-Meteo and hard-coded events, week view, "Light up tomorrow" (blue)

**Milestone 3: demo-ready (week 3)**
- [x] Today screen
- [x] Style it, showing pre-generated try-on images
- [x] Short homepage: hero, how it works, the lights, link into the app
- [ ] Deploy to Vercel, test on a phone over a hotspot
- [ ] Connect the real hub when it's ready, then rehearse the demo script

### After MVP

Not started until the MVP is done. Roughly in priority order:

1. **Photos:** upload from the phone, background removal, AI tagging with Claude (photo upload + FASHN background removal in progress on branch `feat/camera`)
2. **NFC:** `/h/[hanger]` sticker pages, re-pairing a hanger, "tap, snap, done"
3. **Live FASHN try-on:** model photo, job pipeline, webhook, caching
4. **Full homepage** with waitlist
5. **Smarter wear tracking:** outfit inference + "Looks like you wore…" confirm, manual wear logging, scheduled sweep (pg_cron), replay script
6. **Smarter planning:** swap pieces, plan vs. actual, learning from skips, Google Calendar
7. **Swipe extras:** 30-day challenge resurfacing, listing drafts from photos
8. **Accounts:** shared closets, push notifications, Capacitor store apps

## Demo script (what the MVP must support)

1. Lift a shirt and put it straight back: the app shows **browsed**.
2. Take a second shirt and leave it out (demo mode): a **wear** is logged live.
3. Open Plan and tap "Light up tomorrow": tomorrow's hangers glow **blue**.
4. Open Swipe: the burgundy blouse (hanger 18, browsed often, never worn) **breathes yellow**. Tap Style it, flip through its looks, and keep it: its light goes off and it joins next week's plan. On the next card, swipe left, pick donate, pull it off the rail, and the impact counter goes up.
