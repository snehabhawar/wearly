/**
 * Style it looks for the MVP: hand-picked outfits with pre-generated try-on images
 * (no AI calls; docs/backend.md, AI jobs). Keyed by garment ID from supabase/seed.sql,
 * never by hanger number.
 *
 * Each look's `image` is a static file in public/demo/tryon/. Until that file exists,
 * Style it shows an outfit board built from the garment photos instead.
 */

export type TryOnLook = {
  /** Unique within the garment, used in the image name */
  id: string;
  /** Short button label: "Office" */
  title: string;
  /** What it's paired with: "+ black trousers" */
  sub: string;
  /** The other garments in the outfit */
  with: string[];
  /** Try-on image under public/ */
  image: string;
  /** One warm sentence under the picker */
  note: string;
};

/** A seeded garment's ID from its seed number (the seed hangs garment n on hanger n) */
const seedGarment = (n: number) => `00000000-0000-0000-0000-0000000002${String(n).padStart(2, "0")}`;

const look = (garment: number, l: Omit<TryOnLook, "image" | "with"> & { with: number[] }): TryOnLook => ({
  ...l,
  with: l.with.map(seedGarment),
  image: `/demo/tryon/${String(garment).padStart(2, "0")}-${l.id}.webp`,
});

const LOOKS: Record<string, TryOnLook[]> = {
  // Burgundy silk blouse: browsed often, never worn. The demo keeps it after Style it.
  [seedGarment(18)]: [
    look(18, {
      id: "a",
      title: "Office",
      sub: "+ black trousers",
      with: [10],
      note: "Tucked into the black trousers, it's an easy yes for a workday.",
    }),
    look(18, {
      id: "b",
      title: "Weekend",
      sub: "+ dark jeans",
      with: [9],
      note: "Loose over dark jeans, sleeves pushed up. Silk doesn't have to be fancy.",
    }),
    look(18, {
      id: "c",
      title: "Soft",
      sub: "+ grey wide-leg",
      with: [17],
      note: "With the grey wide-leg pants for a calm, cozy evening out.",
    }),
  ],
  // Camel wool coat
  [seedGarment(8)]: [
    look(8, {
      id: "a",
      title: "Everyday",
      sub: "+ tee and jeans",
      with: [3, 9],
      note: "Over a grey tee and dark jeans, the coat does all the work.",
    }),
    look(8, {
      id: "b",
      title: "Sharp",
      sub: "+ black trousers",
      with: [1, 10],
      note: "With the white shirt and black trousers for a crisp winter workday.",
    }),
  ],
  // Floral midi skirt
  [seedGarment(12)]: [
    look(12, {
      id: "a",
      title: "Easy",
      sub: "+ grey tee",
      with: [3],
      note: "A plain grey tee lets the flowers do the talking.",
    }),
    look(12, {
      id: "b",
      title: "Breezy",
      sub: "+ navy linen",
      with: [2],
      note: "The navy linen shirt, knotted at the waist, for a warm afternoon.",
    }),
  ],
};

/** The Style it looks for a garment, or an empty list when it has none */
export function looksFor(garmentId: string): TryOnLook[] {
  return LOOKS[garmentId] ?? [];
}

/** Every garment that has looks (for tests and the docs) */
export const STYLED_GARMENTS = Object.keys(LOOKS);
