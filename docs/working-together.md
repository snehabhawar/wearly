# Working together

Two people build the MVP in parallel: one on the **frontend**, one on the **backend**. This page is what we agreed on so the two halves connect without surprises.

## The contract

The frontend and backend meet in three places. Each is a file in git, so a mismatch shows up as a type error or a failing test, not at demo time.

| Contract | Where | Used by |
| --- | --- | --- |
| Database schema (tables, views, allowed values) | `supabase/migrations/`, generated into `lib/supabase/types.ts` | Frontend reads tables and views with supabase-js under RLS |
| App endpoint bodies | Zod schemas in `lib/api/` | Route handlers parse with them; the UI imports their types |
| Hub contract | `lib/api/hub.ts` + [api.md](api.md) | The hub firmware, `/sim`, and the ingest routes |

Rules:

- **Endpoints do things, tables are for reading.** A plan, a deck decision or a light command is triggered through `/api/*`, and the UI reads the result from tables and views.
- **Change a contract only in a PR reviewed by both sides,** and update [api.md](api.md) or [backend.md](backend.md) in the same PR.
- After every migration, run `pnpm db:types` and commit `lib/supabase/types.ts`.
- Value conventions: `YYYY-MM-DD` dates in the closet's timezone, ISO timestamps, money in cents, uuids for rows, hanger **numbers** in URLs and hub payloads, and only the fixed light pairs.

## Who owns what

| Owner | Folders |
| --- | --- |
| Frontend | `app/(app)/`, `app/(marketing)/`, `app/login/`, `app/sim/`, `components/`, `lib/queries/`, `public/demo/` |
| Backend | `app/api/`, `lib/wear-engine/`, `lib/planner/`, `lib/weather/`, `supabase/`, `scripts/` |
| Shared: PR reviewed by both | `lib/api/`, `lib/supabase/`, `docs/api.md`, `.env.example`, `package.json` |

## Supabase projects

Each developer has **their own free Supabase Cloud project**, because `pnpm db:reset` wipes the linked database. Migrations travel through git; apply them to your own project. One shared **demo** project comes in week 3 for the Vercel deploy, and only the backend owner migrates it.

## Realtime

The frontend opens one subscription per closet on `hangers`, `absences`, `wears` and `commands`, filtered by `closet_id`. A change invalidates the matching TanStack Query keys (defined in `lib/queries/keys.ts`); the UI doesn't patch data by hand.

## Building before the other side is ready

- **Reads:** as soon as the migrations and seed are on your project, the frontend reads real data.
- **Endpoints:** the backend first ships every MVP route as a **stub** that returns fixed data matching its `lib/api/` schema, then fills in the logic. The frontend never builds against a shape that doesn't exist yet.

## Git

- Work on feature branches (`feat/...`) and open PRs into `main`. Only Tam merges to `main`.
- Merge with merge commits or rebase, **not squash**, so small commits survive.
- Merge `main` into your branch at least daily.
- Commit messages: Conventional Commits in English, `type: short imperative summary` (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`).

## Next steps, split

Steps marked ⇄ are sync points: the other side is waiting on them.

### Together, first (about 30 minutes)

1. Review and merge this contract branch (`feat/api-contract`).
2. Confirm folder ownership and that each of you creates a Supabase project.
3. Decide whether the seed's garment layout matches the mockup (navy blazer on hanger 3, white tee on 7, green cardigan "waiting since March" on 12, no photo on 4, 8, 13, 14, 19, 22). The Today screen and the demo script depend on it.

### Backend

| # | Task | Notes |
| --- | --- | --- |
| B1 ⇄ | Supabase CLI, migrations for the 12 MVP tables, RLS, `garment_stats` and `closet_summary` views, Realtime; make `seed.sql` run; generate and commit types | Unblocks every frontend read. Target: day 2 |
| B2 ⇄ | `lib/supabase/` clients: browser, server (cookie session), admin (service role, server-only), plus a "current closet" helper | Unblocks `/login` and all reads. Target: day 2 |
| B3 ⇄ | Stub routes for every MVP endpoint, returning fixtures that pass the `lib/api/` schemas | Unblocks frontend actions. Target: day 3 |
| B4 | Wear engine in `lib/wear-engine/` with Vitest tests; fix and wire `scripts/seed-history.ts` | |
| B5 | Hub API: `events` (through `lib/hub/`), `commands`, `ack`, and the sweep | Then hand the contract to firmware |
| B6 | `/api/sim/events` and `/api/sim/reset` | `/sim` goes live |
| B7 | Real `find`, `plans/{id}/lights`, `swipe/deck`, `swipe/decisions` | |
| B8 | Planner (`lib/planner/`), Open-Meteo, hard-coded demo events, `plans/generate` | |

### Frontend

| # | Task | Notes |
| --- | --- | --- |
| F1 | shadcn/ui, design tokens, fonts, PWA manifest, `AppShell` (bottom tabs, phone width centered on desktop) | No backend needed |
| F2 | Shared components from [frontend.md](frontend.md) (`LedDot`, `GarmentThumb`, `HangerTile`, `StatCard`, `OutfitCard`…) against fixtures | No backend needed |
| F3 | `/sim` page | Works against the B3 stub, live after B6 |
| F4 | `/login` and the signed-out redirect | Needs B2 |
| F5 | Closet grid, item detail, Find it, Realtime updates | Needs B1, B2; Find it needs B3 |
| F6 | Swipe deck and the let-go sheet | Needs B3, real after B7 |
| F7 | Plan week view and "Light up tomorrow" | Needs B3, real after B8 |
| F8 | Today, Style it (static try-on images), short homepage | Week 3 |
| F9 | Demo photos and try-on images in `public/demo/` | Anytime before week 3 |

### Together, week 3

Deploy to Vercel with the shared demo project, test on a phone over a hotspot, connect the real hub, and rehearse the demo script.
