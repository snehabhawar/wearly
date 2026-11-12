import { GarmentCategory, GarmentStatus, type Light } from "@/lib/api";
import type { Classification } from "@/lib/wear-engine";

/** How many past absences the item page lists */
export const ACTIVITY_LIMIT = 8;

const FORMALITY: Record<number, string> = {
  1: "Lounge",
  2: "Casual",
  3: "Smart casual",
  4: "Business",
  5: "Formal",
};

const CATEGORY: Record<GarmentCategory, string> = {
  top: "Top",
  bottom: "Bottoms",
  outer: "Outerwear",
  one_piece: "Dress",
};

export type ActivityEntry = {
  /** YYYY-MM-DD in the closet's timezone */
  day: string;
  kind: Exclude<Classification, "open"> | "out";
  /** "out for 3 min", "out now" */
  detail: string;
};

export type ItemDetail = {
  garmentId: string;
  name: string | null;
  category: GarmentCategory | null;
  color: string | null;
  photoPath: string | null;
  status: GarmentStatus;
  /** Tags shown as chips: category, color, seasons, dress code, who tagged it */
  tags: string[];
  hanger: { number: number; light: Light; away: boolean } | null;
  wearsYtd: number;
  lastWornOn: string | null;
  browsedCount: number;
  idleDaysInSeason: number;
  costPerWearCents: number | null;
  activity: ActivityEntry[];
};

export type ItemRow = {
  id: string;
  name: string | null;
  category: string | null;
  color: string | null;
  seasons: string[] | null;
  formality: number | null;
  photo_path: string | null;
  tags_source: string | null;
  status: string;
  hanger_assignments: {
    hangers: { number: number; led_color: string; led_pattern: string; on_rail: boolean; garment_on: boolean } | null;
  }[];
};

export type ItemStatsRow = {
  wears_ytd: number | null;
  last_worn_on: string | null;
  browsed_count: number | null;
  idle_days_in_season: number | null;
  cost_per_wear: number | null;
} | null;

export type AbsenceRow = { left_at: string; returned_at: string | null; classification: string };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "3 min", "8 h", "2 days" */
export function formatAway(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

function localDay(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(at),
  );
}

/** One garment with its hanger, stats and recent absences, for the item page */
export function toItemDetail(input: {
  garment: ItemRow;
  stats: ItemStatsRow;
  absences: AbsenceRow[];
  timeZone: string;
}): ItemDetail {
  const g = input.garment;
  const h = g.hanger_assignments[0]?.hangers ?? null;
  const category = g.category ? GarmentCategory.parse(g.category) : null;
  const seasons = g.seasons?.length === 4 ? "All seasons" : g.seasons?.map(capitalize).join(" · ");
  const tags = [
    category && CATEGORY[category],
    g.color && capitalize(g.color),
    seasons,
    g.formality !== null && FORMALITY[g.formality],
    g.tags_source === "ai" ? "Tagged by AI" : g.tags_source === "user" ? "Tagged by you" : null,
  ].filter((t): t is string => Boolean(t));

  const activity: ActivityEntry[] = [...input.absences]
    .sort((a, b) => b.left_at.localeCompare(a.left_at))
    .slice(0, ACTIVITY_LIMIT)
    .map((a) => {
      const day = localDay(a.left_at, input.timeZone);
      if (a.returned_at === null) {
        return { day, kind: a.classification === "missing" ? "missing" : "out", detail: "out now" };
      }
      const away = formatAway(new Date(a.returned_at).getTime() - new Date(a.left_at).getTime());
      return { day, kind: a.classification as ActivityEntry["kind"], detail: `out for ${away}` };
    });

  return {
    garmentId: g.id,
    name: g.name,
    category,
    color: g.color,
    photoPath: g.photo_path,
    status: GarmentStatus.parse(g.status),
    tags,
    hanger: h && {
      number: h.number,
      light: { color: h.led_color, pattern: h.led_pattern } as Light,
      away: !(h.on_rail && h.garment_on),
    },
    wearsYtd: input.stats?.wears_ytd ?? 0,
    lastWornOn: input.stats?.last_worn_on ?? null,
    browsedCount: input.stats?.browsed_count ?? 0,
    idleDaysInSeason: input.stats?.idle_days_in_season ?? 0,
    costPerWearCents: input.stats?.cost_per_wear ?? null,
    activity,
  };
}
