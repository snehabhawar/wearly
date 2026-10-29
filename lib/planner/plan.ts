import type { ForecastDay, GarmentCategory } from "@/lib/api";
import { DEFAULT_DRESS, type PlanEvent } from "./demo-events";

/*
 * The rule-based weekly planner (docs/backend.md, Planner). Pure: garments, stats, forecast and
 * events in, seven days of outfits out. Rules, in order:
 *  1. top + bottom or one_piece, plus outer when the high is under 16 °C or rain is forecast
 *  2. only active garments that are on their hanger
 *  3. formality within ±1 of the day's dress code
 *  4. season tags fit the day
 *  5. no piece twice within 3 days
 *  6. favour under-worn pieces, boost keep challenges
 *  7. hangers without a photographed garment fill in as mystery picks
 *  8. a short, warm reason per day
 * When nothing fits a slot, rules 3 then 4 relax before a mystery pick steps in.
 */

/** Below this high, the day gets an outer layer */
const LAYER_BELOW_C = 16;
/** A piece worn on a day can't come back for this many days (rule 5) */
const NO_REPEAT_DAYS = 3;
/** The day (0 = Monday) that features a mystery pick, so the week shows one */
const MYSTERY_DAY = 1;

export type Season = "spring" | "summer" | "fall" | "winter";

export type PlannerGarment = {
  id: string;
  name: string | null;
  /** Null for a garment we know nothing about yet: a mystery pick */
  category: GarmentCategory | null;
  seasons: string[] | null;
  formality: number | null;
  /** Garments let go, rehomed or missing are never planned */
  active: boolean;
  /** Out of the closet right now (an open absence): worn, in the laundry or lent */
  away: boolean;
  hangerId: string | null;
  hangerNumber: number | null;
};

export type PlannerStats = { idleDaysInSeason: number; wears90d: number };

export type PlannedItem = { slot: GarmentCategory; garmentId: string; hangerId: string | null; mystery: boolean };

export type PlannedDay = { day: string; events: PlanEvent[]; items: PlannedItem[]; reason: string };

/** Northern-hemisphere meteorological seasons, as season_of() in the stats migration */
export function seasonOf(day: string): Season {
  const month = Number(day.slice(5, 7));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Rule 6: long-idle and rarely worn pieces first; a kept piece in its challenge goes first of all */
function score(stats: PlannerStats | undefined, challenge: boolean): number {
  const idle = Math.min(stats?.idleDaysInSeason ?? 0, 180) / 30;
  const underWorn = Math.max(0, 6 - (stats?.wears90d ?? 0));
  return idle + underWorn + (challenge ? 20 : 0);
}

export function planWeek(input: {
  weekStart: string;
  /** One entry per day, or null when there's no forecast */
  forecast: (ForecastDay | undefined)[] | null;
  events: PlanEvent[][];
  garments: PlannerGarment[];
  stats: Map<string, PlannerStats>;
  inChallenge: Set<string>;
}): PlannedDay[] {
  const available = input.garments.filter((g) => g.active && !g.away && g.hangerId !== null);
  const known = available.filter((g) => g.category !== null);
  // Newest mystery garments first: older ones are likely already lit in the swipe deck
  const mystery = available
    .filter((g) => g.category === null)
    .sort((a, b) => (input.stats.get(a.id)?.idleDaysInSeason ?? 0) - (input.stats.get(b.id)?.idleDaysInSeason ?? 0));
  const ranked = [...known].sort(
    (a, b) =>
      score(input.stats.get(b.id), input.inChallenge.has(b.id)) -
        score(input.stats.get(a.id), input.inChallenge.has(a.id)) || a.id.localeCompare(b.id),
  );
  const lastUsed = new Map<string, number>();
  const days: PlannedDay[] = [];

  for (let i = 0; i < 7; i++) {
    const day = addDays(input.weekStart, i);
    const weather = input.forecast?.[i];
    const events = input.events[i] ?? [];
    const dress = events.length ? Math.max(...events.map((e) => e.dress)) : DEFAULT_DRESS;
    const season = seasonOf(day);
    const free = (g: PlannerGarment) => {
      const last = lastUsed.get(g.id);
      return last === undefined || i - last >= NO_REPEAT_DAYS;
    };
    const fitsSeason = (g: PlannerGarment) => !g.seasons?.length || g.seasons.includes(season);
    const fitsDress = (g: PlannerGarment) => g.formality === null || Math.abs(g.formality - dress) <= 1;

    // Rules 3 and 4, relaxed one at a time when nothing fits
    const pick = (slot: GarmentCategory, taken: Set<string>) => {
      const pool = ranked.filter((g) => g.category === slot && free(g) && !taken.has(g.id));
      return (
        pool.find((g) => fitsDress(g) && fitsSeason(g)) ?? pool.find(fitsSeason) ?? pool.find(fitsDress) ?? pool[0] ?? null
      );
    };
    const pickMystery = (taken: Set<string>) => mystery.find((g) => free(g) && !taken.has(g.id)) ?? null;

    const taken = new Set<string>();
    const items: PlannedItem[] = [];
    const add = (slot: GarmentCategory, g: PlannerGarment | null, isMystery = false) => {
      if (!g) return;
      taken.add(g.id);
      items.push({ slot, garmentId: g.id, hangerId: g.hangerId, mystery: isMystery });
    };

    // Rule 1: a one-piece wins when it outranks the top and bottom it would replace
    const onePiece = pick("one_piece", taken);
    const top = pick("top", taken);
    const bottom = pick("bottom", taken);
    const s = (g: PlannerGarment | null) => (g ? score(input.stats.get(g.id), input.inChallenge.has(g.id)) : -1);
    if (onePiece && s(onePiece) > (s(top) + s(bottom)) / 2) {
      add("one_piece", onePiece);
    } else {
      const featureMystery = i === MYSTERY_DAY ? pickMystery(taken) : null;
      if (featureMystery) add("top", featureMystery, true);
      else add("top", top ?? pickMystery(taken), !top);
      add("bottom", bottom ?? pickMystery(taken), !bottom);
    }
    const needsLayer = weather ? weather.high_c < LAYER_BELOW_C || weather.rain : season === "fall" || season === "winter";
    if (needsLayer) {
      const outer = pick("outer", taken);
      add("outer", outer ?? pickMystery(taken), !outer);
    }

    for (const item of items) lastUsed.set(item.garmentId, i);
    days.push({
      day,
      events,
      items,
      reason: reasonFor({ weather, events, items, garments: available, stats: input.stats, inChallenge: input.inChallenge }),
    });
  }
  return days;
}

/** Rule 8: one or two warm sentences: the weather, then why this outfit */
function reasonFor(input: {
  weather: ForecastDay | undefined;
  events: PlanEvent[];
  items: PlannedItem[];
  garments: PlannerGarment[];
  stats: Map<string, PlannerStats>;
  inChallenge: Set<string>;
}): string {
  const { weather, events, items } = input;
  const byId = new Map(input.garments.map((g) => [g.id, g]));
  const named = (id: string) => byId.get(id)?.name ?? "this piece";

  const sky = !weather
    ? null
    : weather.rain
      ? "Rain on the way, so there's a layer."
      : weather.high_c < LAYER_BELOW_C
        ? "Cool out, so there's a layer."
        : weather.high_c >= 24
          ? "Warm and dry."
          : "Mild and dry.";

  const kept = items.find((it) => input.inChallenge.has(it.garmentId));
  const mystery = items.find((it) => it.mystery);
  const waiting = items
    .filter((it) => !it.mystery)
    .sort((a, b) => (input.stats.get(b.garmentId)?.idleDaysInSeason ?? 0) - (input.stats.get(a.garmentId)?.idleDaysInSeason ?? 0))[0];
  const dressed = events.find((e) => e.dress >= 3);

  let why: string;
  if (kept) why = `The ${named(kept.garmentId).toLowerCase()} you kept gets its chance.`;
  else if (mystery) {
    const n = byId.get(mystery.garmentId)?.hangerNumber;
    why = `Hanger ${n} has no photo yet; it glows so you can find it.`;
  } else if (dressed) why = `Dressed for ${dressed.title.toLowerCase()}.`;
  else if (waiting && (input.stats.get(waiting.garmentId)?.idleDaysInSeason ?? 0) >= 30)
    why = `The ${named(waiting.garmentId).toLowerCase()} hasn't been out in a while.`;
  else why = "Comfortable pieces for an easy day.";

  return [sky, why].filter(Boolean).join(" ");
}
