import type { GarmentCategory } from "@/lib/api";

/*
 * Outfit rules for live try-on (docs/backend.md, FASHN try-on). Plain TS, shared by the
 * Style it screen (what can be paired) and the server (what it will dress, in which order).
 */

/** Most pieces in one try-on: each one is a FASHN call (1 credit) */
export const MAX_PIECES = 3;

/** FASHN dresses one garment per call, so a look is layered: bottoms first, then tops, then outerwear */
const LAYER: Record<GarmentCategory, number> = { bottom: 0, one_piece: 0, top: 1, outer: 2 };

/** FASHN's category for each of ours */
export const FASHN_CATEGORY: Record<GarmentCategory, string> = {
  top: "tops",
  bottom: "bottoms",
  outer: "tops",
  one_piece: "one-pieces",
};

/** What a garment of this category can be paired with, one piece per slot */
export function pairingSlots(category: GarmentCategory): GarmentCategory[] {
  switch (category) {
    case "top":
      return ["bottom", "outer"];
    case "bottom":
      return ["top", "outer"];
    case "outer":
      return ["top", "bottom"];
    case "one_piece":
      return ["outer"];
  }
}

export type OutfitPiece = { garmentId: string; category: GarmentCategory };

/**
 * Checks an outfit and returns its pieces in dressing order, or why it can't be dressed:
 * one piece per category, no top or bottom with a one-piece, at most MAX_PIECES.
 */
export function dressingOrder(pieces: OutfitPiece[]): { ok: true; steps: OutfitPiece[] } | { ok: false; reason: string } {
  if (pieces.length === 0) return { ok: false, reason: "Pick at least one garment" };
  if (pieces.length > MAX_PIECES) return { ok: false, reason: `Pick at most ${MAX_PIECES} garments` };
  if (new Set(pieces.map((p) => p.garmentId)).size !== pieces.length) return { ok: false, reason: "A garment is in there twice" };
  const categories = pieces.map((p) => p.category);
  if (new Set(categories).size !== categories.length) return { ok: false, reason: "Pick one garment per type" };
  if (categories.includes("one_piece") && (categories.includes("top") || categories.includes("bottom"))) {
    return { ok: false, reason: "A dress or jumpsuit goes without a separate top or bottom" };
  }
  return { ok: true, steps: [...pieces].sort((a, b) => LAYER[a.category] - LAYER[b.category]) };
}

export type PairingCandidate = {
  garmentId: string | null;
  category: GarmentCategory | null;
  photoPath: string | null;
  status: string | null;
  wears90d: number;
};

/** How many candidates each slot offers */
const SUGGESTIONS_PER_SLOT = 6;

/**
 * Garments that could go with the styled one, per slot: active, photographed, of that category.
 * Pieces from the hand-picked looks come first, then what gets worn most.
 */
export function suggestPairings<C extends PairingCandidate>(
  styled: { garmentId: string; category: GarmentCategory },
  closet: C[],
  preferred: string[] = [],
): { slot: GarmentCategory; options: (C & { garmentId: string })[] }[] {
  const rank = (id: string) => {
    const i = preferred.indexOf(id);
    return i === -1 ? preferred.length : i;
  };
  return pairingSlots(styled.category).map((slot) => ({
    slot,
    options: closet
      .filter(
        (c): c is C & { garmentId: string } =>
          c.garmentId !== null && c.garmentId !== styled.garmentId && c.category === slot && c.status === "active" && c.photoPath !== null,
      )
      .sort((a, b) => rank(a.garmentId) - rank(b.garmentId) || b.wears90d - a.wears90d)
      .slice(0, SUGGESTIONS_PER_SLOT),
  }));
}

/** The same outfit always gets the same key on the client, whatever order it was picked in */
export const outfitKey = (garmentIds: string[]) => [...garmentIds].sort().join("+");
