# Frontend

One Next.js app (App Router, TypeScript) serves the homepage, the app on phone and desktop, the NFC landing pages and the dev simulator. It ships as a **PWA**. Every screen is designed in the [Wearly App Mockup](https://claude.ai/artifact/E8aWsZqMko2VrhDzJ8jNUa), so use it as the visual spec.

> Status: specification. Nothing is implemented yet.

## MVP scope

**In the MVP**
- Phone screens:
  - Today (outfit + "waiting" card)
  - Closet + item detail with Find it
  - Plan: phone week view with "Light up tomorrow"
  - Swipe, with the let-go sheet
  - Style it, showing pre-generated images
- `/sim`
- A short homepage: hero, how it works, the lights, link into the app
- `/login` with the seeded demo account
- PWA manifest
- **Desktop layouts, built first** (sidebar, Closet master-detail, 7-column Plan, Today + deck), with the phone layout below 768 px

**After MVP**
- `/h/[hanger]` NFC pages and photo capture
- Live try-on
- "Looks like you wore…" confirm card
- Swapping plan pieces
- Full homepage with waitlist
- Service worker and push notifications

## Routes

| Route | Screen | Mockup artboard | Notes |
| --- | --- | --- | --- |
| `/` | Homepage | Homepage | Static. MVP: hero, how it works, the lights, link into the app. Waitlist after MVP |
| `/login` | Sign-in | – | Supabase Auth. MVP: email + password for the seeded demo account (no email round-trip during a demo). Magic link after MVP |
| `/today` | Today | Today | Default after login. Desktop also shows the swipe deck |
| `/closet` | Closet grid + stats | Closet | Desktop shows the selected item in a side panel |
| `/closet/[garmentId]` | Item detail | Item detail | Full page |
| `/plan` | Week plan | Plan | Day strip + one day on phone, 7 columns on desktop |
| `/swipe` | Keep or let go | Swipe | |
| `/style/[garmentId]` | Style it (try-on) | Style it | MVP: pre-generated images from `public/demo/tryon/`. Live FASHN after MVP |
| `/h/[hanger]` | NFC landing | – | *After MVP.* URL written on each sticker. Blinks the hanger white, opens its item, and offers the camera if there's no photo |
| `/sim` | Hub simulator | Hub simulator | **Dev only**, hidden in production. Sends real events through the hub API |

Route groups: `app/(marketing)` for the homepage (no app shell), `app/(app)` for signed-in screens (shared shell). The auth guard is `proxy.ts`: it refreshes the Supabase session, sends signed-out visitors to `/login?next=…` and signed-in ones from `/login` to `/today`; add new signed-in routes to its `matcher`. Sign-in and sign-out run in the browser through `lib/supabase/client.ts`.

## Layout and responsiveness

- **Desktop (≥ 768 px), built first:** left sidebar (`SidebarNav`) with the logo and nav. The swipe count badge and the hub status card ("Closet hub online · 24 hangers") join it once their data is wired up. The content area uses wider layouts: master-detail on Closet, 7 columns on Plan, Today + deck side by side.
- **Phone (< 768 px):** single column, bottom tab bar (`BottomNav`) with Today, Closet, Plan, Swipe. Detail screens push full-screen with a back link.
- Both navs read the same list in `components/nav-items.ts`.
- One component tree with responsive classes. Don't build separate phone and desktop pages; swap layout pieces with Tailwind breakpoints.
- Wide content (the 7-column plan) scrolls horizontally inside its own box. The page never scrolls sideways.

## Design tokens

Taken from the mockup. They are defined once as CSS variables in `app/globals.css` and mapped to Tailwind with `@theme`, so components use names like `bg-plum`, not hex codes. The shadcn/ui semantic colors (`primary`, `secondary`, `muted`, `border`…) point at the same palette, so stock components already look like Wearly.

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#2A1530` | Primary text, dark surfaces |
| `plum` | `#5B2A6E` | Primary buttons, active nav, brand |
| `plum-soft` | `#F1E9F7` | Secondary buttons, selected nav |
| `lilac` | `#F3EEF5` | Tile backgrounds, chips |
| `cream` | `#FBF7F3` | Page background |
| `peach` | `#F8C9AA` | Accent on dark |
| `peach-soft` | `#FCEBDD` | "Waiting" cards, reasons |
| `amber` | `#E39A2D` | Amber light dot |
| `amber-ink` | `#8A4A06` | Amber text (passes contrast on cream) |
| `muted-foreground` | `#6E5F73` | Secondary text (shadcn name; `bg-muted` is `lilac`) |
| `muted-strong` | `#5E4A66` | Body text on tinted backgrounds |
| `line` | `#E6DCE8` | Borders (also shadcn `border`) |
| `line-strong` | `#D8CBDD` | Input and outline-button borders (also shadcn `input`) |
| `led-purple` | `#8B5CC9` | Purple light dot |
| `heat-0` … `heat-3` | `#F3EEF5` `#E2D5EE` `#C4ABE0` `#9B74CC` | Wear-frequency shading on the closet grid |

**Type:**
- Headings: **Zilla Slab** (600–700), class `font-heading`; `h1`–`h3` get it by default. Body: **Inter** (400–700), the default `font-sans`.
- All fonts load with `next/font/google` in `app/layout.tsx`.
- Monospace (simulator only): JetBrains Mono.

**Gradients:** purple-to-peach (`#E9DDF6 → #F8D9C6`), the `bg-dawn` utility. Use it only for the Today header, photo backdrops and the homepage CTA.

**Radii:** `--radius` is 14 px. Use `rounded-lg` (14 px) for buttons and tiles, `rounded-xl`/`rounded-2xl` (20–25 px) for cards, and `rounded-full` for chips.

**Dark mode:** none in the MVP.

## Light language in the UI

The app always shows a hanger's light with the same component, `<LedDot color pattern />`, so the UI matches the closet:

| Light | Dot | Motion |
| --- | --- | --- |
| Purple | `led-purple` with a soft ring | steady |
| Amber | `amber` with a soft ring | slow breathing (CSS keyframes) |
| White | white with a border | two quick blinks |
| Off | none | – |

**Never show color alone:** every dot has a text label nearby ("Breathing amber," "These hangers glow purple…"). Don't use red or green anywhere for item status. Respect `prefers-reduced-motion` by turning motion into a static ring.

## Components (planned)

Components marked † come after MVP.

| Component | Used on | Notes |
| --- | --- | --- |
| `AppShell` | all app routes | `SidebarNav` on desktop (≥ 768 px), `BottomNav` on phones |
| `GarmentThumb` | everywhere | Cutout photo if present; otherwise a numbered tile; `mystery` variant with dashed border and "?" |
| `HangerTile` | Closet grid | Heat-shaded background, hanger number, amber "waiting" dot, selectable |
| `StatCard` | Closet, Item | Big slab number + label |
| `LedDot` | everywhere | See above |
| `OutfitCard` | Today, Plan | Pieces list. Swap buttons after MVP |
| `ConfirmOutfitCard` † | Today | "Looks like you wore…" with Yes / Not quite |
| `WeekStrip` | Plan | Day strip + selected day |
| `WeekColumns` | Plan (desktop) | 7 columns over the same data |
| `LightUpButton` | Plan | "Light up tomorrow": calls `/api/plans/{id}/lights` |
| `SwipeDeck` | Swipe, Today (desktop) | Motion drag gestures plus Keep / Style it / Let go buttons (buttons are the accessible path) |
| `LetGoSheet` | Swipe | Donate / Resell / Swap |
| `TryOnViewer` | Style it, Today | Result image and combination picker. MVP uses static images; the loading state ("Dressing you up…") comes with live FASHN |
| `FindItButton` | Item, Closet | Calls `/api/hangers/{n}/find`, shows "blinking white" toast |
| `HubStatus` † | sidebar | From `devices.last_seen_at` |
| `PhotoCapture` † | `/h/[hanger]`, Item | `<input type="file" accept="image/*" capture="environment">` |

Base primitives (Button, Sheet, Dialog, Toast, Tabs) come from shadcn/ui, restyled with the tokens.

## Data fetching

- **Reads:** supabase-js with the user's session, through TanStack Query hooks in `lib/queries/`, for example `useHangers()`, `useGarmentStats()`, `usePlan(weekStart)`. RLS does the scoping.
- **Writes with side effects:** `fetch('/api/...')` through typed helpers in `lib/api/client.ts`, which share Zod schemas with the route handlers.
- **Realtime:** one subscription per closet (`hangers`, `absences`, `wears`, `commands`; plus `ai_jobs` after MVP) that updates or invalidates the matching queries. This is what makes the grid update live when a garment is lifted.
- **Server components:** use them for static and marketing pages and for the shell. Don't put data-dependent business logic in them (no server actions with side effects). That keeps a static Capacitor build possible later; see the README.

## Copy and tone

Warm and non-judgmental, as set out in the product plan:

| Do | Don't |
| --- | --- |
| "This one's been waiting since March." | "Unworn: 214 days." |
| "Picked up, put back 6×" | "Rejected 6 times" |
| "Let go" | "Throw away" |

Use relative, human dates ("since March," "9 days ago") in the UI, with exact dates in tooltips or on the detail page.

## PWA

- **MVP:** `app/manifest.ts` with name "Wearly", `start_url: "/today"`, `display: "standalone"`, theme color `#5B2A6E`, background `#FBF7F3`. Icons use the starburst logo: `public/icon.svg` and `public/icon-maskable.svg` for the manifest, `app/icon.svg` as the favicon, and `app/apple-icon.tsx`, which renders a 180 px PNG because iOS ignores SVG icons. That's enough for "Add to Home Screen."
- **After MVP:** a service worker for an offline shell and web push (the Sunday "plan your week?" prompt). On iOS, push only works after the app is added to the home screen (iOS 16.4+).
- **NFC (after MVP):** stickers hold `https://<app>/h/<number>`. iOS and Android open these natively, so no Web NFC is needed. Write the stickers once with a free app such as NFC Tools.

## Accessibility checklist

- Real `<button>` and `<a>` elements, never clickable divs. Icon-only buttons have `aria-label`.
- Touch targets ≥ 44 px.
- Text contrast ≥ 4.5:1. Check muted text on tinted cards.
- The swipe deck works fully with buttons and keyboard, not only drag.
- Light states are always labelled in text.

## Simulator page (`/sim`)

Matches the mockup:

- **Virtual rail:** 6–24 hangers, each with "Lift garment" / "Hang back," "Take hanger" / "Rehang" and Find it.
- **"Put it back" picker:** "when I click" (live: each click sends one event now, the demo's way) or a quick lift that lasts the middle of the browsed, tried-on, worn or worn-and-washed band of the closet's profile (seconds in `demo`). A quick lift sends both events at once, the first with an `age_ms` offset; see [api.md](api.md#dev-only).
- **Panels:** live event log with each classification (and the sweep's provisional wears), the command queue with each hanger's LED state, and the last payload.
- The page polls `POST /api/sim/poll` every second, like the hub, and sends events one request at a time in click order.
- **"Play 3-min demo script":** runs the demo steps in the browser (once Plan and Swipe are live).

It calls the real hub API with `HUB_DEV_SECRET`, through a small server route that adds the secret, so the secret never reaches the browser.
