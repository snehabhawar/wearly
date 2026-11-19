# Development

How Wearly fits together, how to run it locally, and how to deploy it. For the product overview, see the [README](../README.md).

This repo holds the **web app, API and backend**, plus the [firmware](../firmware/) for the hangers and hub. Without hardware, everything runs against a **virtual hub simulator** (`/sim`) that speaks the same API as the real ESP32 hub.

## How it fits together

```
 Virtual hub (/sim)  ─┐  POST /api/hub/events        ┌──────────────────────────────┐
 ESP32 hub           ─┴─────────────────────────────►│ Next.js on Vercel            │
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

More detail: [frontend.md](frontend.md), [backend.md](backend.md), [api.md](api.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript, pnpm |
| UI | Tailwind CSS, shadcn/ui, Motion (swipe deck, light animations) |
| Data | Supabase: Postgres + RLS, Auth, Storage, Realtime |
| Client data | supabase-js, TanStack Query |
| Validation | Zod (hub payloads, API bodies) |
| Weather | Open-Meteo (free, no key) |
| AI | FASHN (background removal, virtual try-on), Claude `claude-haiku-5-5` (garment tagging) |
| Tests | Vitest (wear engine, planner) |
| Hosting | Vercel + Supabase Cloud, Vercel Web Analytics |
| Phone app | PWA |

Two rules keep a future Capacitor (store app) build possible:

1. **Server logic lives behind `/api/*` routes**, never in server components or server actions that a static export can't run.
2. **`lib/` has no Next.js imports.** The wear engine and planner are plain TypeScript, so tests, scripts and a mobile shell can reuse them.

## Repo layout

```
app/
  (marketing)/page.tsx        homepage
  (app)/today | closet | closet/[garmentId] | plan | swipe | style/[garmentId]
  cam/                        closet camera: a phone in the closet snaps garments when hung back
  sim/                        virtual hub simulator (404 in production unless SIM_ENABLED)
  login/
  api/
    hub/events, hub/commands, hub/commands/ack
    hangers/[number]/find, plans/, swipe/, garments/, tryon/
    sim/                      helpers for /sim
components/                   UI components (see frontend.md)
lib/
  wear-engine/                pure TS + tests
  hub/                        hub ingest, light commands, the sweep
  planner/  swipe/  weather/  fashn/  tagging/
  queries/                    TanStack Query hooks (reads under RLS)
  api/                        Zod schemas shared by routes and callers
  supabase/                   clients and generated types
  demo/                       Style it looks for the demo garments
public/demo/                  demo garment photos and pre-generated try-on images
supabase/
  migrations/
  seed.sql
scripts/
  seed-history.ts             3 months of fake wear history
  demo-hanger.ts              puts a demo garment on the real hanger
  prepare-photos.ts           photos/raw/NN.jpg -> public/demo/garments/NN.webp (rembg, local)
  generate-tryon.ts           Style it images via FASHN (dry run by default)
firmware/                     hanger + hub Arduino code
requests/hub.http             example hub requests (REST Client)
docs/
```

## Running it locally

### Prerequisites

- Node 20+ and pnpm (`npm i -g pnpm`)
- A Supabase Cloud project (no Docker needed). Run `pnpm exec supabase login` once.
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
| `FASHN_API_KEY` | Server only: background removal and live try-on (1 credit per photo or garment), and `pnpm tryon:generate` |
| `TRYON_DAILY_LIMIT` | New live try-ons per closet per 24 h (default 10); reused outfits are free |
| `SIM_ENABLED` | `true` turns `/sim` on in production, for the closet owner only (always on in development) |
| `ANTHROPIC_API_KEY` | Server only: Claude names garments from their photos. Optional: without it photos are saved untagged |

### Run it

```bash
pnpm install
pnpm db:link         # once: link the CLI to your Supabase project
pnpm db:reset        # WIPES the linked DB, then migrations + seed
pnpm seed:history    # 3 months of fake wears
pnpm dev             # http://localhost:3000
```

Then sign in with the seeded demo account (see `supabase/seed.sql`) and open:

- `/sim` to fire hanger events by clicking virtual hangers
- `/closet` to watch them arrive live
- `/` for the homepage

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | App on :3000 |
| `pnpm build` / `pnpm lint` / `pnpm test` | Production build, ESLint, Vitest |
| `pnpm db:push` | Apply new migrations to the linked project |
| `pnpm db:reset` | Wipe the linked DB, then migrations + seed |
| `pnpm db:types` | Regenerate `lib/supabase/types.ts` |
| `pnpm seed:history` | 3 months of fake wear history (needs `SUPABASE_SERVICE_ROLE_KEY`) |
| `pnpm demo:hanger` | Put the black blazer on hanger 1, the real hanger (after `seed:history`) |
| `pnpm photos:prepare` | Cut out demo garment photos locally |
| `pnpm tryon:generate` | Pre-generate Style it images via FASHN (dry run; add `--yes` to spend credits) |

> Free Supabase projects pause after 7 days of low activity. Open the dashboard the day before a demo.

## Deploying (Vercel)

- Add the variables above in the Vercel project (Production), with `NEXT_PUBLIC_APP_URL` set to the deployed URL.
- Apply the migrations first (`pnpm db:push`): photos and try-ons need the private `garments` and `tryon` storage buckets.
- `/sim` and `/api/sim/*` are off in production unless `SIM_ENABLED=true`. Even then, only the dev closet's owner (the demo account) can use them.
- The seed's hub secret and demo password are public in this repo. Anyone who knows them can send hub events or sign in to the demo closet, so change both in the database for a public deployment, and run `pnpm db:reset` + `pnpm seed:history` before a demo.
- Turn on **Analytics** in the Vercel project to see page views.

## Demo prep

1. `pnpm db:reset` → `pnpm seed:history` → `pnpm demo:hanger`
2. Pre-make the try-ons you'll show (Style it → "Your mix" for the blazer).
3. Rehearse the demo script in the [README](../README.md#the-demo-in-one-minute).
