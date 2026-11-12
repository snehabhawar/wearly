import type { GarmentCategory, Listing, SwipeCard } from "@/lib/api";
import { WAITING_IDLE_DAYS } from "@/lib/queries/closet";
import { localDate } from "@/lib/wear-engine";

/** Keep starts a wear challenge this long (docs/backend.md, Swipe deck) */
export const KEEP_CHALLENGE_DAYS = 30;

export type DeckGarment = {
  id: string;
  name: string | null;
  photoPath: string | null;
  category: GarmentCategory | null;
  priceCents: number | null;
  createdAt: string;
  hangerNumber: number | null;
};

export type DeckStats = {
  idleDaysInSeason: number;
  browsedCount: number;
  wears90d: number;
  lastWornOn: string | null;
};

/**
 * The Keep-or-let-go deck from the closet's active garments: waiting 180+ in-season days and
 * not in a keep challenge. The strongest "considered but not worn" signal comes first
 * (browsed most, worn least), then the longest wait.
 */
export function buildDeck(input: {
  garments: DeckGarment[];
  stats: Map<string, DeckStats>;
  /** Garments in a keep challenge that hasn't ended */
  inChallenge: Set<string>;
  timeZone: string;
}): SwipeCard[] {
  const cards: SwipeCard[] = [];
  for (const g of input.garments) {
    const s = input.stats.get(g.id);
    if (!s || s.idleDaysInSeason < WAITING_IDLE_DAYS || input.inChallenge.has(g.id)) continue;
    cards.push({
      garment_id: g.id,
      hanger_number: g.hangerNumber,
      name: g.name,
      photo_path: g.photoPath,
      category: g.category,
      idle_days_in_season: s.idleDaysInSeason,
      browsed_count: s.browsedCount,
      wears_90d: s.wears90d,
      waiting_since: s.lastWornOn ?? localDate(new Date(g.createdAt), input.timeZone),
      price_cents: g.priceCents,
    });
  }
  return cards.sort(
    (a, b) =>
      b.browsed_count - a.browsed_count ||
      a.wears_90d - b.wears_90d ||
      b.idle_days_in_season - a.idle_days_in_season,
  );
}

const CATEGORY_WORD: Record<GarmentCategory, string> = {
  top: "top",
  bottom: "bottoms",
  outer: "outerwear",
  one_piece: "dress",
};

/** Second-hand clothes usually sell for about a quarter to two fifths of what they cost */
const RESALE_SHARE = { min: 0.25, max: 0.4 };
/** When the price is unknown */
const FALLBACK_RANGE_CENTS = { min: 1000, max: 2000 };

const toDollar = (cents: number) => Math.max(100, Math.round(cents / 100) * 100);

/** Listing text for a resell, built from the garment's tags (no AI in the MVP) */
export function buildListing(g: Pick<DeckGarment, "name" | "category" | "priceCents"> & { color?: string | null }): Listing {
  const kind = g.category ? CATEGORY_WORD[g.category] : "piece";
  const title = g.name ?? `Closet ${kind}`;
  const details = [g.color && `Color: ${g.color}.`, g.category && `Category: ${kind}.`].filter(Boolean).join(" ");
  const range =
    g.priceCents === null
      ? FALLBACK_RANGE_CENTS
      : { min: toDollar(g.priceCents * RESALE_SHARE.min), max: toDollar(g.priceCents * RESALE_SHARE.max) };
  return {
    title,
    body: `${title}, gently worn and ready for a new closet. ${details}`.trim(),
    price_min_cents: range.min,
    price_max_cents: Math.max(range.min, range.max),
  };
}
