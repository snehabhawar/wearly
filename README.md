# Wearly

**Smart hangers that notice what you actually wear.**

Most of us wear a small part of our closet over and over, while the rest waits on the rail. Wardrobe apps try to fix this, but they start by asking you to photograph and log everything, and most people give up after a week.

Wearly works the other way around: **no cataloging, just hang your clothes.** Each hanger feels when a garment leaves and comes back, and the app quietly builds up a picture of what you really wear. Then the closet talks back with three small lights.

🌐 **Try it:** [wearly.fashion](https://wearly.fashion) has a demo closet with 24 hangers and three months of history.

## How it works

1. **Hang your everyday clothes.** Put Wearly hangers in the part of your closet you use most. Each hanger has a number, so tracking starts on day one. Photos are optional.
2. **Get dressed like always.** A few minutes away from the rail means you were browsing; hours away means you wore it. A small hub in the closet sends these moments to the app.
3. **Your closet talks back.** Today's outfit lights up when you open the door, and pieces you haven't reached for in a while gently remind you they're there.

## The lights

Each hanger has three small LEDs. Each light has its own motion, so it never depends on color alone, and there is no red or green: nothing that says your clothes are "bad".

| Light | Means |
| --- | --- |
| **Blue**, steady | Part of today's (or tomorrow's) outfit |
| **Yellow**, slow breathing | Waiting a while: rediscover it, or let it go |
| **White**, two blinks | "Here I am": the piece you searched for in the app |

Most of the time the closet stays dark.

## What's in the app

- **Today:** the weather, your plans for the day, and an outfit picked for both.
- **Closet:** every garment and how often it's really worn, updated live as you take things off the rail. Tap **Find it** to make a hanger blink.
- **Plan:** a week of outfits based on the forecast and what's on that week. **Light up tomorrow** turns those hangers blue.
- **Swipe:** the pieces that have waited longest, one card at a time. Keep it and it joins next week's plan, or let it go (donate, resell or swap) and watch your impact counter grow.
- **Style it:** see a forgotten piece in a full outfit with a virtual try-on, on a model or on your own photo.
- **Closet camera:** a phone mounted in the closet snaps a garment as it's hung back, removes the background and names it, so photos happen without any effort.

## The demo in one minute

1. Lift a shirt and put it straight back: the app shows it was **browsed**.
2. Take another one out and keep it: a **wear** is logged live.
3. Tap **Light up tomorrow**: tomorrow's hangers glow **blue**.
4. Open **Swipe**: a black blazer that gets looked at often but never worn **breathes yellow**. Style it into a new outfit and keep it, and its light goes off. Let the next piece go, and the impact counter goes up.

## Where it's at

Wearly is a working prototype. The web app is complete, and a first real hanger and hub (ESP32 boards with a sensor and three LEDs) talk to the live app. While the rest of the hangers are being built, a **virtual hub** in the app stands in for them using exactly the same connection.

Ideas for later: NFC stickers to pair a hanger with a garment in one tap, smarter guesses about which pieces you wore together, calendar sync, shared closets, and phone apps in the stores.

## Built with

Next.js and TypeScript, Supabase, Tailwind CSS, and Vercel for the app. Open-Meteo for the weather, FASHN for background removal and virtual try-on, and Claude for naming garments from their photos. The hangers and hub run on ESP32 boards ([firmware/](firmware/)).

## For developers

- [docs/development.md](docs/development.md): how it fits together, running it locally, deploying
- [docs/frontend.md](docs/frontend.md): screens, design tokens, components
- [docs/backend.md](docs/backend.md): data model, wear tracking, planner, swipe deck
- [docs/api.md](docs/api.md): the hub API (shared with the firmware) and app endpoints
