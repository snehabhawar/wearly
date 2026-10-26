import { z } from "zod";
import { GarmentCategory, GarmentStatus, HangerNumber, Id, LocalDate, Timestamp } from "./common";

/** One card in the Keep-or-Let-go deck */
export const SwipeCard = z.object({
  garment_id: Id,
  /** Null only if the garment has no open hanger assignment */
  hanger_number: HangerNumber.nullable(),
  /** Null for garments without a photo or tags: show the hanger number instead */
  name: z.string().nullable(),
  photo_path: z.string().nullable(),
  category: GarmentCategory.nullable(),
  idle_days_in_season: z.int().min(0),
  browsed_count: z.int().min(0),
  wears_90d: z.int().min(0),
  /** Last wear, or when the garment was added if never worn. For copy like "waiting since March" */
  waiting_since: LocalDate,
  price_cents: z.int().min(0).nullable(),
});
export type SwipeCard = z.infer<typeof SwipeCard>;

/** GET /api/swipe/deck: ordered candidates; the top card's hanger starts breathing amber */
export const SwipeDeckResponse = z.object({
  cards: z.array(SwipeCard),
  /** The hanger now lit amber/breathe, or null if the deck is empty */
  lit_hanger: HangerNumber.nullable(),
});
export type SwipeDeckResponse = z.infer<typeof SwipeDeckResponse>;

/** POST /api/swipe/decisions. A route is required for let_go and not allowed otherwise. */
export const SwipeDecisionRequest = z.discriminatedUnion("decision", [
  z.object({ garment_id: Id, decision: z.literal("keep") }),
  z.object({ garment_id: Id, decision: z.literal("style") }),
  z.object({
    garment_id: Id,
    decision: z.literal("let_go"),
    route: z.enum(["donate", "resell", "swap"]),
  }),
]);
export type SwipeDecisionRequest = z.infer<typeof SwipeDecisionRequest>;

/** Listing text built from the garment's tags, for the share sheet */
export const Listing = z.object({
  title: z.string(),
  body: z.string(),
  price_min_cents: z.int().min(0),
  price_max_cents: z.int().min(0),
});
export type Listing = z.infer<typeof Listing>;

export const SwipeDecisionResponse = z.object({
  garment_status: GarmentStatus,
  /** Set for keep: the end of the 30-day challenge */
  challenge_until: Timestamp.nullable(),
  /** Set for let_go with route resell */
  listing: Listing.nullable(),
});
export type SwipeDecisionResponse = z.infer<typeof SwipeDecisionResponse>;
