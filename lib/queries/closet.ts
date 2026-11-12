import { GarmentCategory, GarmentStatus, type Light } from "@/lib/api";
import type { Tables } from "@/lib/supabase/types";

/**
 * One hanger in the closet grid with its current garment and stats: the shape the
 * Closet, Today and Swipe screens render. Built from `hangers`, the open
 * `hanger_assignments`, `garments` and `garment_stats` once reads are wired up.
 */
export type ClosetItem = {
  hangerNumber: number;
  garmentId: string | null;
  name: string | null;
  category: GarmentCategory | null;
  color: string | null;
  photoPath: string | null;
  status: GarmentStatus | null;
  /** The garment is off its hanger right now */
  away: boolean;
  light: Light["color"];
  wears90d: number;
  wearsYtd: number;
  /** YYYY-MM-DD, closet timezone */
  lastWornOn: string | null;
  browsedCount: number;
  idleDaysInSeason: number;
  costPerWearCents: number | null;
};

export type ClosetSummary = {
  hangerCount: number;
  photographedCount: number;
  worn90dPct: number;
  rehomedThisYear: number;
};

/** Same rule as the swipe deck: in season and idle for 180+ days (docs/backend.md) */
export const WAITING_IDLE_DAYS = 180;

export function isWaiting(item: ClosetItem): boolean {
  return item.status === "active" && item.idleDaysInSeason >= WAITING_IDLE_DAYS;
}

/** 0-3 shading for the closet grid, from wears in the last 90 days */
export function heatLevel(wears90d: number): 0 | 1 | 2 | 3 {
  if (wears90d === 0) return 0;
  if (wears90d < 5) return 1;
  if (wears90d < 13) return 2;
  return 3;
}

/** A hanger row with its open assignment's garment, as fetched for the grid */
export type HangerRow = Pick<Tables<"hangers">, "number" | "on_rail" | "garment_on" | "led_color"> & {
  hanger_assignments: {
    garments: Pick<Tables<"garments">, "id" | "name" | "category" | "color" | "photo_path" | "status"> | null;
  }[];
};
export type GarmentStatsRow = Tables<"garment_stats">;
export type ClosetSummaryRow = Tables<"closet_summary">;

/** Joins hangers, their current garments and garment_stats into grid items, ordered by hanger number. */
export function toClosetItems(hangers: HangerRow[], stats: GarmentStatsRow[]): ClosetItem[] {
  const statsById = new Map(stats.map((s) => [s.garment_id, s]));
  return [...hangers]
    .sort((a, b) => a.number - b.number)
    .map((h) => {
      const g = h.hanger_assignments[0]?.garments ?? null;
      const s = g ? statsById.get(g.id) : undefined;
      return {
        hangerNumber: h.number,
        garmentId: g?.id ?? null,
        name: g?.name ?? null,
        category: g?.category ? GarmentCategory.parse(g.category) : null,
        color: g?.color ?? null,
        photoPath: g?.photo_path ?? null,
        status: g ? GarmentStatus.parse(g.status) : null,
        // Away = the garment isn't hanging on the rail (docs/backend.md, Hanger states)
        away: g !== null && !(h.on_rail && h.garment_on),
        light: h.led_color as Light["color"],
        wears90d: s?.wears_90d ?? 0,
        wearsYtd: s?.wears_ytd ?? 0,
        lastWornOn: s?.last_worn_on ?? null,
        browsedCount: s?.browsed_count ?? 0,
        idleDaysInSeason: s?.idle_days_in_season ?? 0,
        costPerWearCents: s?.cost_per_wear ?? null,
      };
    });
}

export function toClosetSummary(row: ClosetSummaryRow | null): ClosetSummary {
  return {
    hangerCount: row?.hanger_count ?? 0,
    photographedCount: row?.photographed_count ?? 0,
    worn90dPct: row?.worn_90d_pct ?? 0,
    rehomedThisYear: row?.rehomed_this_year ?? 0,
  };
}
