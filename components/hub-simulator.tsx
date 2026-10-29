"use client";

import { Lightbulb } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GarmentThumb } from "@/components/garment-thumb";
import type { HubCommand, HubEvent, Light } from "@/lib/api";
import type { SimAbsence, SimHanger, SweepResult } from "@/lib/hub";
import { cn } from "@/lib/utils";
import { WEAR_PROFILES, type WearProfileName } from "@/lib/wear-engine";

/** How often the simulator polls for light commands, like the real hub */
const POLL_MS = 1000;
const LOG_SIZE = 12;
const COMMANDS_SIZE = 8;
/** One play of the two white blinks (the led-blink2 keyframes in globals.css) */
const BLINK_MS = 1600;

type Mode = "live" | "browsed" | "tried_on" | "worn" | "worn_washed";
type LogEntry = { key: number; time: string; hanger: number | null; event: string; result: string; tone: Tone };
type CommandEntry = HubCommand & { time: string };
type Tone = "away" | "browsed" | "tried_on" | "worn" | "worn_washed" | "missing" | "muted";

const RESULT_LABEL: Record<string, string> = {
  open: "Away",
  browsed: "Browsed",
  tried_on: "Tried on",
  worn: "Worn",
  worn_washed: "Worn + washed",
  missing: "Missing",
};

const TONE: Record<Tone, string> = {
  away: "bg-plum-soft text-plum",
  browsed: "bg-lilac text-muted-strong",
  tried_on: "bg-peach-soft text-amber-ink",
  worn: "bg-plum text-primary-foreground",
  worn_washed: "bg-ink text-primary-foreground",
  missing: "bg-peach text-ink",
  muted: "bg-muted text-muted-foreground",
};

const LIGHT_LABEL: Record<Light["color"], string> = {
  off: "off",
  purple: "purple · steady",
  amber: "amber · breathing",
  white: "white · 2 blinks",
};

const LED_FILL: Record<Light["color"], string> = {
  off: "fill-heat-0",
  purple: "fill-led-purple",
  amber: "fill-amber",
  white: "fill-white",
};

const GLOW: Record<Light["color"], string> = {
  off: "",
  purple: "shadow-[0_0_0_6px_color-mix(in_oklab,var(--led-purple)_18%,transparent),0_0_28px_color-mix(in_oklab,var(--led-purple)_45%,transparent)]",
  amber:
    "shadow-[0_0_0_6px_color-mix(in_oklab,var(--amber)_18%,transparent),0_0_28px_color-mix(in_oklab,var(--amber)_45%,transparent)] animate-led-breathe",
  white: "shadow-[0_0_0_6px_white,0_0_28px_color-mix(in_oklab,var(--muted-ink)_50%,transparent)] animate-led-blink2-once",
};

/**
 * How long a quick lift lasts: the middle of each classification band of the closet's
 * profile, so the durations stay in the one config file (lib/wear-engine/profiles.ts).
 */
function quickDurations(profile: WearProfileName): Record<Exclude<Mode, "live">, number> {
  const p = WEAR_PROFILES[profile];
  return {
    browsed: p.browsedUnder / 2,
    tried_on: (p.browsedUnder + p.triedOnUnder) / 2,
    worn: (p.triedOnUnder + p.wornUnder) / 2,
    worn_washed: (p.wornUnder + p.washedUnder) / 2,
  };
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 6) / 10;
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 2.4) / 10} days`;
}

const clock = () => new Date().toLocaleTimeString("en-GB");

function stateLabel(h: SimHanger): string {
  if (h.onRail) return h.garmentOn ? "In the closet" : "Garment taken off hanger";
  return h.garmentOn ? "Out on its hanger" : "Empty hanger moved";
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json() as Promise<T>;
}

/** Dev-only virtual hub: sends real hub events for the dev closet and plays back its light commands. */
export function HubSimulator() {
  const [profile, setProfile] = useState<WearProfileName>("demo");
  const [hangers, setHangers] = useState<SimHanger[] | null>(null);
  const [mode, setMode] = useState<Mode>("live");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [commands, setCommands] = useState<CommandEntry[]>([]);
  const [payload, setPayload] = useState("// nothing sent yet");
  const [status, setStatus] = useState("idle");
  // Hangers playing a Find blink right now; their lasting light stays as it was
  const [blinking, setBlinking] = useState<Set<number>>(new Set());
  const logKey = useRef(0);
  const polling = useRef(false);
  // Events go out one request at a time, in click order, like the hub's queue: a quick
  // "hang back" must never reach the server before its "lift"
  const outbox = useRef<Promise<unknown>>(Promise.resolve());

  const addLog = useCallback((entries: Omit<LogEntry, "key" | "time">[]) => {
    const time = clock();
    setLog((prev) => [...entries.map((e) => ({ ...e, key: ++logKey.current, time })), ...prev].slice(0, LOG_SIZE));
  }, []);

  useEffect(() => {
    fetch("/api/sim/state")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`state answered ${res.status}`))))
      .then((data: { profile: WearProfileName; hangers: SimHanger[] }) => {
        setProfile(data.profile);
        setHangers(data.hangers);
      })
      .catch((e: Error) => setStatus(e.message));
  }, []);

  // Poll like the hub: run the sweep, take the light commands, ack them, show them on the rail
  useEffect(() => {
    const timer = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const { commands: received, sweep } = await post<{ commands: HubCommand[]; sweep: SweepResult | null }>(
          "/api/sim/poll",
        );
        if (received.length > 0) {
          const time = clock();
          // White is momentary: the hanger blinks twice, then shows its lasting light again
          const blinks = received.filter((c) => c.color === "white").map((c) => c.hanger);
          if (blinks.length > 0) {
            setBlinking((prev) => new Set([...prev, ...blinks]));
            setTimeout(
              () => setBlinking((prev) => new Set([...prev].filter((n) => !blinks.includes(n)))),
              BLINK_MS,
            );
          }
          const byHanger = new Map(received.filter((c) => c.color !== "white").map((c) => [c.hanger, c]));
          setHangers((prev) =>
            prev?.map((h) => {
              const c = byHanger.get(h.number);
              return c ? { ...h, light: { color: c.color, pattern: c.pattern } as Light } : h;
            }) ?? prev,
          );
          setCommands((prev) => [...received.map((c) => ({ ...c, time })), ...prev].slice(0, COMMANDS_SIZE));
        }
        if (sweep && sweep.provisionalWears + sweep.missing + sweep.rehomed > 0) {
          const parts = [
            sweep.provisionalWears && `${sweep.provisionalWears} worn while out`,
            sweep.missing && `${sweep.missing} missing`,
            sweep.rehomed && `${sweep.rehomed} rehomed`,
          ].filter(Boolean);
          addLog([{ hanger: null, event: "sweep", result: parts.join(", "), tone: sweep.provisionalWears ? "worn" : "muted" }]);
        }
      } catch {
        // The next poll retries, as the hub would
      } finally {
        polling.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [addLog]);

  function send(events: HubEvent[], names: string[]) {
    outbox.current = outbox.current.then(() => deliver(events, names));
  }

  async function deliver(events: HubEvent[], names: string[]) {
    setPayload(JSON.stringify({ events }, null, 2));
    try {
      const res = await post<{ accepted: number; duplicates: number; absences: SimAbsence[] }>("/api/sim/events", { events });
      setStatus("200 OK");
      const byHanger = new Map(res.absences.map((a) => [a.hanger, a]));
      const last = events.at(-1)!;
      const absence = byHanger.get(last.hanger);
      const result = !absence ? "Updated" : absence.returnedAt === null ? "open" : absence.classification;
      addLog([
        {
          hanger: last.hanger,
          event: names.join(" → "),
          result: RESULT_LABEL[result] ?? "Updated",
          tone: result === "open" ? "away" : ((result in TONE ? result : "muted") as Tone),
        },
      ]);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  function update(number: number, patch: Partial<SimHanger>) {
    setHangers((prev) => prev?.map((h) => (h.number === number ? { ...h, ...patch } : h)) ?? prev);
  }

  function toggleGarment(h: SimHanger) {
    if (mode !== "live" && h.onRail && h.garmentOn) {
      const ms = Math.round(quickDurations(profile)[mode]);
      send(
        [
          { hanger: h.number, on_rail: true, garment_on: false, age_ms: ms },
          { hanger: h.number, on_rail: true, garment_on: true, age_ms: 0 },
        ],
        ["garment_off", `garment_on after ${formatDuration(ms)}`],
      );
      return;
    }
    const garmentOn = !h.garmentOn;
    update(h.number, { garmentOn });
    send([{ hanger: h.number, on_rail: h.onRail, garment_on: garmentOn, age_ms: 0 }], [
      garmentOn ? "garment_on" : "garment_off",
    ]);
  }

  function toggleRail(h: SimHanger) {
    const onRail = !h.onRail;
    update(h.number, { onRail });
    send([{ hanger: h.number, on_rail: onRail, garment_on: h.garmentOn, age_ms: 0 }], [onRail ? "rail_on" : "rail_off"]);
  }

  async function lights(numbers: number[], light: Light) {
    if (numbers.length === 0) return;
    await post("/api/sim/lights", { hangers: numbers, light }).catch((e: Error) => setStatus(e.message));
  }

  async function reset() {
    const res = await post<{ hangers: SimHanger[] }>("/api/sim/reset").catch((e: Error) => {
      setStatus(e.message);
      return null;
    });
    if (!res) return;
    setHangers(res.hangers);
    setLog([]);
    setCommands([]);
    setPayload("// nothing sent yet");
  }

  const durations = quickDurations(profile);
  const lit = hangers?.filter((h) => h.light.color !== "off").map((h) => h.number) ?? [];

  return (
    <div className="min-h-dvh bg-lilac text-ink">
      <header className="bg-ink text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3.5 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-heading text-[22px] font-bold">
              <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-peach">
                <polygon points="23,12 15.7,13.53 19.78,19.78 13.53,15.7 12,23 10.47,15.7 4.22,19.78 8.3,13.53 1,12 8.3,10.47 4.22,4.22 10.47,8.3 12,1 13.53,8.3 19.78,4.22 15.7,10.47" />
              </svg>
              Hub simulator
            </span>
            <span className="rounded-md bg-peach px-2 py-0.75 text-[11px] font-bold tracking-wider text-ink">DEV ONLY</span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-heat-1">
              <span className="size-2 rounded-full bg-heat-2" aria-hidden />
              virtual hub · POST /api/hub/events · {status}
            </span>
          </div>
          <span className="rounded-lg border border-peach px-3.5 py-2 text-[13px] font-semibold text-peach">
            {profile === "demo" ? "Demo closet: seconds" : "Real time"}
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-wrap items-start gap-6 px-4 py-6 sm:px-6">
        <section aria-labelledby="rail-head" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h1 id="rail-head" className="text-[26px] font-semibold">
                Virtual closet rail
              </h1>
              <span className="text-[13px] text-muted-foreground">
                Each button sends the same event the real hanger will send over ESP-NOW.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-muted-strong">Put it back</span>
              <div role="group" aria-label="Put it back" className="flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
                {(["live", "browsed", "tried_on", "worn", "worn_washed"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "min-h-8.5 rounded-lg px-2.5 text-xs font-semibold",
                      mode === m ? "bg-plum text-primary-foreground" : "text-plum hover:bg-lilac",
                    )}
                  >
                    {m === "live" ? "when I click" : `after ${formatDuration(durations[m])}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-[20px] border border-line bg-card p-5">
            <div aria-hidden className="relative mx-2 h-2.5 rounded-full bg-muted-strong">
              <div className="absolute inset-x-0 -top-0.75 h-0.75 rounded-full bg-ink" />
            </div>
            {hangers === null ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Connecting to the dev closet…</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5 pt-1">
                {hangers.map((h) => (
                  <HangerCard
                    key={h.number}
                    hanger={h}
                    blinking={blinking.has(h.number)}
                    quick={mode !== "live" && h.onRail && h.garmentOn}
                    onGarment={() => toggleGarment(h)}
                    onRail={() => toggleRail(h)}
                    onFind={() => lights([h.number], { color: "white", pattern: "blink2" })}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={lit.length === 0}
              onClick={() => lights(lit, { color: "off", pattern: "off" })}
              className="min-h-10 rounded-lg border border-line-strong bg-card px-3.5 text-[13px] font-semibold disabled:opacity-50"
            >
              All lights off
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-10 rounded-lg px-3.5 text-[13px] font-semibold text-plum underline"
            >
              Reset
            </button>
          </div>
        </section>

        <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <section aria-labelledby="log-head" className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-card p-4.5">
            <h2 id="log-head" className="text-xl font-semibold">
              Event log → wear engine
            </h2>
            {log.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Lift a garment to send the first event.</p>
            ) : (
              <ol className="flex flex-col">
                {log.map((e) => (
                  <li
                    key={e.key}
                    className="grid grid-cols-[64px_36px_minmax(0,1fr)_auto] items-center gap-2 border-t border-lilac py-2 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">{e.time}</span>
                    <span className="font-bold">{e.hanger ? `#${e.hanger}` : ""}</span>
                    <span className="truncate font-mono text-muted-strong">{e.event}</span>
                    <span className={cn("rounded-full px-2 py-0.75 text-[11px] font-bold whitespace-nowrap", TONE[e.tone])}>
                      {e.result}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="cmd-head" className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-card p-4.5">
            <h2 id="cmd-head" className="text-xl font-semibold">
              Command queue
            </h2>
            <span className="font-mono text-xs text-muted-foreground">GET /api/hub/commands · polled every 1 s</span>
            {commands.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No light commands yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {commands.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 text-xs">
                    <svg viewBox="0 0 10 10" aria-hidden className="size-2.5">
                      <circle cx="5" cy="5" r="4.5" className={cn(LED_FILL[c.color], "stroke-line-strong")} />
                    </svg>
                    <span className="font-bold">#{c.hanger}</span>
                    <span className="font-mono text-muted-strong">{LIGHT_LABEL[c.color]}</span>
                    <span className="ml-auto font-mono text-muted-foreground">
                      #{c.id} · {c.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="payload-head" className="flex flex-col gap-2 rounded-[20px] bg-ink p-4.5 text-heat-1">
            <h2 id="payload-head" className="font-sans text-xs font-bold tracking-wider text-peach uppercase">
              Last payload
            </h2>
            <pre className="font-mono text-xs leading-normal whitespace-pre-wrap">{payload}</pre>
          </section>
        </aside>
      </main>
    </div>
  );
}

function HangerCard({
  hanger: h,
  blinking,
  quick,
  onGarment,
  onRail,
  onFind,
}: {
  hanger: SimHanger;
  blinking: boolean;
  quick: boolean;
  onGarment: () => void;
  onRail: () => void;
  onFind: () => void;
}) {
  const known = h.garment && (h.garment.name || h.garment.category);
  const color = blinking ? "white" : h.light.color;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "flex h-37.5 flex-col items-center rounded-2xl px-1.5 transition-[transform,opacity] duration-300",
          GLOW[color],
          !h.onRail && "translate-y-6 opacity-55",
        )}
      >
        <svg width="110" height="64" viewBox="0 0 110 64" aria-hidden>
          <path d="M55 22 L55 12 Q55 4 62 4 Q68 4 68 10" fill="none" className="stroke-muted-strong" strokeWidth="3" strokeLinecap="round" />
          <path d="M55 22 L8 50 L102 50 Z" fill="none" className="stroke-muted-strong" strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="55" cy="26" r="7" className={cn(LED_FILL[color], "stroke-ink", blinking && "animate-led-blink2-once")} strokeWidth="1" />
        </svg>
        {h.garmentOn ? (
          <div className="relative -mt-6 size-21.5">
            {known ? (
              <GarmentThumb garment={h.garment} hangerNumber={h.number} sizes="86px" className="rounded-[10px]" />
            ) : (
              <div className="flex size-full items-center justify-center rounded-[10px] border-2 border-dashed border-heat-2 bg-plum-soft font-heading text-[22px] font-bold text-plum">
                ?
              </div>
            )}
          </div>
        ) : (
          <div className="-mt-6 flex size-21.5 items-center justify-center text-[11px] text-muted-foreground">garment out</div>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="line-clamp-1 text-sm font-bold">
          #{h.number} · {h.garment?.name ?? "No photo"}
        </span>
        <span className="text-xs text-muted-strong">{stateLabel(h)}</span>
        <span className="text-[11px] text-muted-foreground">LED: {LIGHT_LABEL[color]}</span>
      </div>
      <div className="flex w-full flex-col gap-1.5">
        <button
          type="button"
          onClick={onGarment}
          className="min-h-9 rounded-lg border border-plum bg-plum px-2 text-xs font-semibold text-primary-foreground"
        >
          {quick ? "Lift, then put back" : h.garmentOn ? "Lift garment off" : "Hang garment back"}
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onRail}
            className="min-h-9 flex-1 rounded-lg border border-line-strong bg-card text-xs font-semibold text-plum"
          >
            {h.onRail ? "Take hanger" : "Rehang"}
          </button>
          <button
            type="button"
            onClick={onFind}
            aria-label={`Find hanger ${h.number}`}
            className="flex min-h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-card text-plum"
          >
            <Lightbulb aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
