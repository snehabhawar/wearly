import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Wearly: smart hangers that notice what you wear",
  description:
    "Wearly hangers notice what you actually wear. The app plans your week, and your closet lights up to show what to wear and what you've forgotten.",
};

/** Hangers on the hero rail: real demo photos, each with the light it would show */
const RAIL = [
  { photo: "/demo/garments/01.webp", light: "blue" },
  { photo: "/demo/garments/10.webp", light: "blue" },
  { photo: "/demo/garments/18.webp", light: "yellow" },
  { photo: "/demo/garments/03.webp", light: "off" },
] as const;

const GLOW = {
  blue: "bg-led-blue shadow-[0_0_22px_6px_color-mix(in_oklab,var(--led-blue)_55%,transparent)]",
  yellow:
    "bg-led-yellow shadow-[0_0_22px_6px_color-mix(in_oklab,var(--led-yellow)_50%,transparent)] animate-led-breathe",
  white: "bg-white shadow-[0_0_22px_6px_color-mix(in_oklab,white_50%,transparent)] animate-led-blink2",
  off: "border-2 border-muted-ink bg-ink",
} as const;

const STEPS = [
  {
    title: "Hang your everyday clothes",
    body: "Put the hangers in the part of your closet you use most. Each one has a number, so tracking starts on day one. Photos are optional.",
  },
  {
    title: "Get dressed like always",
    body: "Each hanger feels when a garment leaves and comes back. A few minutes away means you were browsing; hours away means you wore it.",
  },
  {
    title: "Your closet talks back",
    body: "Today's outfit glows blue when you open the door. Pieces that have waited a long time breathe yellow, so you can rediscover them, or let them go.",
  },
];

const LIGHTS = [
  { glow: "blue", name: "Blue · steady", meaning: "In today's planned outfit" },
  { glow: "yellow", name: "Yellow · breathing", meaning: "Waiting a while, or marked to let go" },
  { glow: "white", name: "White · two blinks", meaning: "Found it: the hanger you asked for" },
  { glow: "off", name: "Off", meaning: "Normal. The closet stays dark" },
] as const;

function Dot({ glow, className }: { glow: keyof typeof GLOW; className?: string }) {
  return <span aria-hidden className={cn("shrink-0 rounded-full motion-reduce:animate-none", GLOW[glow], className)} />;
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Wearly home">
          <Logo className="text-[28px]" />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-5">
          <a href="#how" className="hidden min-h-11 items-center text-[15px] font-medium text-muted-strong hover:text-ink sm:flex">
            How it works
          </a>
          <a href="#lights" className="hidden min-h-11 items-center text-[15px] font-medium text-muted-strong hover:text-ink sm:flex">
            The lights
          </a>
          <Link
            href="/today"
            className="flex min-h-11 items-center rounded-xl bg-plum px-4.5 text-[15px] font-semibold text-primary-foreground hover:bg-plum/90"
          >
            Open the app
          </Link>
        </nav>
      </header>

      <main className="flex flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-8 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:gap-12 md:pt-12 md:pb-20">
          <div className="flex flex-col gap-6">
            <span className="self-start rounded-full bg-peach-soft px-3 py-1.5 text-[13px] font-bold text-amber-ink">
              Smart hangers + app
            </span>
            <h1 className="text-[40px] leading-[1.04] font-bold tracking-tight sm:text-[56px] lg:text-[64px]">
              Your closet keeps track, so you don&apos;t have to.
            </h1>
            <p className="max-w-[34em] text-lg leading-relaxed text-muted-strong">
              Wearly hangers notice what you actually wear: no photos to take, nothing to log. The app plans your
              week, and your closet lights up to show what to wear and what you&apos;ve forgotten.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/today"
                className="flex min-h-13 items-center rounded-[14px] bg-plum px-5.5 text-base font-semibold text-primary-foreground hover:bg-plum/90"
              >
                See the demo closet
              </Link>
              <a
                href="#how"
                className="flex min-h-13 items-center rounded-[14px] border border-plum px-5.5 text-base font-semibold text-plum hover:bg-plum-soft"
              >
                How it works
              </a>
            </div>
          </div>

          <div className="relative flex h-105 flex-col overflow-hidden rounded-[32px] bg-linear-155 from-ink via-plum to-plum/80 sm:h-120">
            <div aria-hidden className="mx-[7%] mt-16 h-2 rounded bg-heat-2/70" />
            <div className="mx-[7%] grid grid-cols-4 gap-2">
              {RAIL.map((h) => (
                <div key={h.photo} className="flex flex-col items-center">
                  <Dot glow={h.light} className="mt-3 size-3.5" />
                  {/* Cutouts carry a transparent margin: scale up so neighbors hang close, like a real rail */}
                  <div className="relative mt-1 aspect-[3/4] w-full origin-top scale-[1.7]">
                    <Image src={h.photo} alt="" fill sizes="(min-width: 768px) 220px, 38vw" className="object-contain object-top" />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3.5 rounded-[20px] bg-card px-4.5 py-4 shadow-[0_12px_32px_color-mix(in_oklab,var(--ink)_35%,transparent)] sm:inset-x-6 sm:bottom-6">
              <Dot glow="yellow" className="size-3.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">The burgundy blouse has been waiting a while.</span>
                <span className="text-[13px] text-muted-foreground">Blue: today&apos;s outfit · Yellow: waiting a while</span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-4 border-y border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:py-22">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className="text-[32px] leading-tight font-bold sm:text-[44px]">No cataloging. Just hang your clothes.</h2>
              <p className="text-lg leading-relaxed text-muted-strong">
                Most wardrobe apps start by asking you to photograph everything. Wearly starts working the moment a
                shirt goes on its hanger.
              </p>
            </div>
            <ol className="grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-3.5 rounded-3xl border border-line bg-background p-7">
                  <span className="flex size-12 items-center justify-center rounded-[14px] bg-plum-soft font-heading text-[22px] font-bold text-plum">
                    {i + 1}
                  </span>
                  <h3 className="text-2xl font-semibold">{s.title}</h3>
                  <p className="text-base leading-relaxed text-muted-strong">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The lights */}
        <section id="lights" className="scroll-mt-4 bg-ink text-primary-foreground">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.3fr] md:py-22">
            <div className="flex flex-col gap-3.5">
              <h2 className="text-[32px] leading-tight font-bold sm:text-[44px]">Three small lights. A dark closet by default.</h2>
              <p className="text-lg leading-relaxed text-primary-foreground/80">
                Each light has its own motion, so it never depends on color alone. No red, no green: nothing that says
                your clothes are &ldquo;bad&rdquo;.
              </p>
            </div>
            <ul className="grid gap-3.5 sm:grid-cols-2">
              {LIGHTS.map((l) => (
                <li key={l.name} className="flex items-center gap-4 rounded-[20px] bg-primary-foreground/8 p-5">
                  <Dot glow={l.glow} className="size-7" />
                  <span className="flex flex-col gap-0.5">
                    <strong className="text-base font-semibold">{l.name}</strong>
                    <span className="text-sm text-primary-foreground/75">{l.meaning}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Into the app */}
        <section className="px-4 py-16 sm:px-6 md:py-22">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-[32px] bg-dawn px-6 py-14 text-center">
            <Logo className="text-[40px]" />
            <h2 className="max-w-[16em] text-[32px] leading-tight font-bold sm:text-[46px]">
              Wear what you own. Let go of what you don&apos;t.
            </h2>
            <p className="text-lg text-muted-strong">Walk through a demo closet with 24 hangers and three months of history.</p>
            <Link
              href="/today"
              className="flex min-h-13 items-center rounded-[14px] bg-plum px-6 text-base font-semibold text-primary-foreground hover:bg-plum/90"
            >
              Open the demo
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-7 text-sm text-muted-foreground sm:px-6">
          <Logo className="text-xl" />
          <span>© 2026 Wearly</span>
        </div>
      </footer>
    </div>
  );
}
