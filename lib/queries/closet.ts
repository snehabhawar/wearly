import type { GarmentCategory, GarmentStatus, Light } from "@/lib/api";

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
