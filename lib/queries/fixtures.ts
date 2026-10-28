import type { SwipeCard } from "@/lib/api";
import { isWaiting, type ClosetItem, type ClosetSummary } from "./closet";

/*
 * Fake closet shaped like supabase/seed.sql, so screens can be built before reads
 * are wired up (backend tasks B1/B2). Stats are roughly what scripts/seed-history.ts
 * produces. Delete this file once the real queries land.
 */

type Row = [
  hanger: number,
  name: string | null,
  category: ClosetItem["category"],
  color: string | null,
  wears90d: number,
  wearsYtd: number,
  lastWornOn: string | null,
  browsed: number,
  idleDays: number,
  priceCents: number | null,
];

const ROWS: Row[] = [
  [1, "White oxford shirt", "top", "white", 9, 31, "2026-10-21", 3, 4, 4500],
  [2, "Navy linen shirt", "top", "navy", 6, 18, "2026-10-19", 2, 7, 5200],
  [3, "Grey crewneck tee", "top", "grey", 29, 96, "2026-10-24", 5, 1, 1800],
  [4, "Black fitted tee", "top", "black", 34, 110, "2026-10-25", 4, 0, 2000],
  [5, "Striped breton top", "top", "blue", 7, 22, "2026-10-20", 2, 5, 3800],
  [6, "Cream knit sweater", "top", "cream", 3, 6, "2026-10-12", 1, 13, 6800],
  [7, "Olive overshirt", "outer", "olive", 4, 9, "2026-10-14", 1, 11, 7400],
  [8, "Camel wool coat", "outer", "camel", 0, 0, null, 0, 237, 18900],
  [9, "Dark indigo jeans", "bottom", "indigo", 27, 88, "2026-10-24", 3, 1, 7800],
  [10, "Black trousers", "bottom", "black", 31, 101, "2026-10-25", 2, 0, 6900],
  [11, "Beige chinos", "bottom", "beige", 8, 25, "2026-10-17", 2, 8, 5900],
  [12, "Floral midi skirt", "bottom", "multi", 0, 0, null, 0, 190, 4900],
  [13, "Denim jacket", "outer", "blue", 6, 14, "2026-10-18", 1, 7, 8200],
  [14, "Black blazer", "outer", "black", 5, 15, "2026-10-16", 3, 9, 12900],
  [15, "Linen wrap dress", "one_piece", "green", 2, 11, "2026-09-02", 1, 0, 8800],
  [16, "Rust turtleneck", "top", "rust", 2, 4, "2026-10-08", 2, 17, 5400],
  [17, "Grey wide-leg pants", "bottom", "grey", 7, 20, "2026-10-22", 1, 3, 6200],
  [18, "Burgundy silk blouse", "top", "burgundy", 0, 0, null, 14, 239, 9400],
  [19, null, null, null, 0, 0, null, 3, 39, null],
  [20, null, null, null, 0, 0, null, 2, 39, null],
  [21, null, null, null, 0, 0, null, 4, 39, null],
  [22, null, null, null, 0, 0, null, 3, 427, null],
  [23, null, null, null, 0, 0, null, 2, 427, null],
  [24, null, null, null, 0, 0, null, 0, 427, null],
];

const pad = (n: number) => String(n).padStart(2, "0");

export const FIXTURE_CLOSET: ClosetItem[] = ROWS.map(
  ([hanger, name, category, color, wears90d, wearsYtd, lastWornOn, browsed, idleDays, priceCents]) => ({
    hangerNumber: hanger,
    garmentId: `00000000-0000-0000-0000-0000000002${pad(hanger)}`,
    name,
    category,
    color,
    photoPath: name ? `/demo/garments/${pad(hanger)}.jpg` : null,
    status: "active",
    away: false,
    light: "off",
    wears90d,
    wearsYtd,
    lastWornOn,
    browsedCount: browsed,
    idleDaysInSeason: idleDays,
    costPerWearCents: priceCents !== null && wearsYtd > 0 ? Math.round(priceCents / wearsYtd) : null,
  }),
);

export const FIXTURE_SUMMARY: ClosetSummary = {
  hangerCount: 24,
  photographedCount: 18,
  worn90dPct: 54,
  rehomedThisYear: 3,
};

/** The seeded closet's timezone */
export const FIXTURE_TIMEZONE = "America/New_York";

/** When the seed adds every garment: about 14 months ago */
const ADDED_ON = "2025-08-28";

const priceOf = (hanger: number) => ROWS.find((r) => r[0] === hanger)?.[9] ?? null;

/**
 * What GET /api/swipe/deck returns for the fixture closet: waiting garments, most
 * "put back unworn" first, then the longest idle (docs/backend.md, Swipe deck).
 */
export const FIXTURE_DECK: SwipeCard[] = FIXTURE_CLOSET.filter(isWaiting)
  .sort(
    (a, b) =>
      b.browsedCount - a.browsedCount || a.wears90d - b.wears90d || b.idleDaysInSeason - a.idleDaysInSeason,
  )
  .map((item) => ({
    garment_id: item.garmentId ?? "",
    hanger_number: item.hangerNumber,
    name: item.name,
    photo_path: item.photoPath,
    category: item.category,
    idle_days_in_season: item.idleDaysInSeason,
    browsed_count: item.browsedCount,
    wears_90d: item.wears90d,
    waiting_since: item.lastWornOn ?? ADDED_ON,
    price_cents: priceOf(item.hangerNumber),
  }));
