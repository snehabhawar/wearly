# Wearly

Smart hangers that notice what you actually wear. Wearly hangers sense when a garment leaves and comes back; a small hub relays those events to the cloud; the app turns them into wear insights, a weekly outfit plan, and a Keep-or-Let-go deck. The closet itself talks back through a light on each hanger.

This repo holds the **web app, API and backend**. The hardware isn't built yet, so everything runs against a **virtual hub simulator** that speaks the same API the real ESP32 hub will use. When the hardware arrives, the hub points at the same endpoints and nothing else changes.

> **Status:** planning complete, building the **MVP**. See [Roadmap](#roadmap).

## UI mockup

[Wearly App Mockup](https://claude.ai/artifact/E8aWsZqMko2VrhDzJ8jNUa): phone screens, desktop screens, homepage and hub simulator (private; ask Tam for access). The MVP builds the phone screens, the simulator and a short homepage; the desktop screens come after MVP.

## Engineering docs

| Doc | What's in it |
| --- | --- |
| [docs/frontend.md](docs/frontend.md) | Routes, layouts, design tokens, components, data fetching, PWA |
| [docs/backend.md](docs/backend.md) | Data model, RLS, wear engine, planner, swipe deck, AI jobs |
| [docs/api.md](docs/api.md) | Hub contract (for firmware), app endpoints, error format |

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

## Repo layout (planned)

Items marked † come after MVP.

```
app/
  (marketing)/page.tsx        homepage (short version in MVP)
  (app)/today | closet | closet/[garmentId] | plan | swipe | style/[garmentId]
  h/[hanger]/                 † NFC landing page
  sim/                        virtual hub simulator (dev only)
  login/
  api/
    hub/events, hub/commands, hub/commands/ack
    hangers/[number]/find, plans/, swipe/
    sim/                      dev-only helpers for /sim
    garments/, wears/, outfits/, plan-items/, tryon/, webhooks/, cron/   †
components/                   UI components (see docs/frontend.md)
lib/
  wear-engine/                pure TS + tests
  planner/                    pure TS + tests
  weather/
  supabase/                   clients and generated types
  api/                        Zod schemas shared by routes and callers
  fashn/  tagging/            †
public/demo/                  demo garment photos and pre-generated try-on images
supabase/
  migrations/
  seed.sql
scripts/
  seed-history.ts             3 months of fake wear history
  replay.ts                   † rebuild wears from raw events after tuning thresholds
firmware/                     later: hanger + hub Arduino code
docs/
```

## Getting started

> Available after Milestone 1. `.env.example` and the `pnpm` scripts below don't exist yet; until the scaffold lands, this section is the plan.

### Prerequisites

- Node 20+ and pnpm (`npm i -g pnpm`)
- A Supabase account, plus the Supabase CLI (`pnpm dlx supabase --help`)
- Docker Desktop **if** you want Supabase running locally. Otherwise, use a cloud project for development.

### Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client reads under RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: hub ingest and sim routes. Never expose to the client |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs |
| `HUB_DEV_SECRET` | Secret for the seeded dev hub; the simulator uses it |
| `WEAR_PROFILE` | `real` or `demo` (default for new closets; demo uses seconds) |

After MVP: `CRON_SECRET`, `FASHN_API_KEY`, `FASHN_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`.

### Run it

```bash
pnpm install
pnpm db:start        # local Supabase (skip if using a cloud project)
pnpm db:reset        # apply migrations + seed
pnpm db:types        # regenerate lib/supabase/types.ts
pnpm seed:history    # 3 months of fake wears
pnpm dev             # http://localhost:3000
```

Then sign in with the seeded demo account and open:

- `/sim` to fire hanger events by clicking virtual hangers
- `/closet` to watch them arrive live
- `/` for the homepage

Other scripts: `pnpm test` (Vitest), `pnpm lint`.

> Free Supabase projects pause after 7 days of low activity. Open the dashboard the day before a demo.

## Roadmap

### MVP (about 3 weeks)

The goal is the [demo script](#demo-script-what-the-mvp-must-support), on a phone, looking finished.

**Milestone 1: foundation and hub (week 1)**
- [ ] Scaffold Next.js, Tailwind, shadcn/ui, theme tokens, PWA manifest, `.env.example`
- [ ] Supabase migrations for the MVP tables, owner-based RLS, generated types
- [ ] One seeded demo account (email + password)
- [ ] Hub API (`events`, `commands`, `ack`) and wear engine with Vitest tests (`real` and `demo` profiles)
- [ ] `/sim` page
- [ ] Seed data: 24 hangers, demo garments with photos in `public/demo/`, hand-written tags, 3 months of history
- [ ] **Checkpoint:** hand the hub contract to the firmware team

**Milestone 2: core screens (week 2)**
- [ ] Closet: live wear grid, item detail, Find it
- [ ] Swipe: seasonal deck, amber light, keep / let go (donate, resell, swap), rehomed, impact counter
- [ ] Plan: rule-based planner with Open-Meteo and hard-coded events, week view, "Light up tomorrow" (purple)

**Milestone 3: demo-ready (week 3)**
- [ ] Today screen
- [ ] Style it, showing pre-generated try-on images
- [ ] Short homepage: hero, how it works, the lights, link into the app
- [ ] Deploy to Vercel, test on a phone over a hotspot
- [ ] Connect the real hub when it's ready, then rehearse the demo script

### After MVP

Not started until the MVP is done. Roughly in priority order:

1. **Photos:** upload from the phone, background removal, AI tagging with Claude
2. **NFC:** `/h/[hanger]` sticker pages, re-pairing a hanger, "tap, snap, done"
3. **Live FASHN try-on:** model photo, job pipeline, webhook, caching
4. **Desktop layouts:** sidebar shell, Closet master-detail, 7-column Plan, Today + deck
5. **Full homepage** with waitlist
6. **Smarter wear tracking:** outfit inference + "Looks like you wore…" confirm, manual wear logging, scheduled sweep (pg_cron), replay script
7. **Smarter planning:** swap pieces, plan vs. actual, learning from skips, Google Calendar
8. **Swipe extras:** 30-day challenge resurfacing, listing drafts from photos
9. **Accounts:** shared closets, push notifications, Capacitor store apps

## Demo script (what the MVP must support)

1. Lift a shirt and put it straight back: the app shows **browsed**.
2. Take a second shirt and leave it out (demo mode): a **wear** is logged live.
3. Open Plan and tap "Light up tomorrow": tomorrow's hangers glow **purple**.
4. Open Swipe: the forgotten item **breathes amber**. Swipe left, pick donate, pull it off the rail, and the impact counter goes up.
