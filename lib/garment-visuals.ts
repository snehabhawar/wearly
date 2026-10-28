/*
 * Stand-in drawings for garments without a photo yet: a silhouette by kind, filled
 * with the garment's color. Shapes come from the mockup (64x64 viewBox). The hex
 * values below depict clothing colors, so they're data, not UI design tokens.
 */

export type Silhouette = "tee" | "shirt" | "jacket" | "sweater" | "pants" | "dress" | "skirt";

export const SILHOUETTE_PATHS: Record<Silhouette, string> = {
  tee: "M22 8 L14 12 L6 22 L14 28 L18 24 L18 56 L46 56 L46 24 L50 28 L58 22 L50 12 L42 8 Q32 16 22 8 Z",
  shirt: "M22 8 L12 12 L4 44 L12 46 L18 26 L18 58 L46 58 L46 26 L52 46 L60 44 L52 12 L42 8 L32 18 Z",
  jacket: "M22 8 L12 12 L4 46 L12 48 L18 26 L18 58 L46 58 L46 26 L52 48 L60 46 L52 12 L42 8 L32 30 Z",
  sweater: "M22 8 L12 12 L4 46 L12 48 L18 28 L18 58 L46 58 L46 28 L52 48 L60 46 L52 12 L42 8 Q32 14 22 8 Z",
  pants: "M18 6 L46 6 L50 58 L37 58 L32 22 L27 58 L14 58 Z",
  dress: "M24 6 L40 6 L42 20 L52 58 L12 58 L22 20 Z",
  skirt: "M20 12 L44 12 L52 56 L12 56 Z",
};

/** Picks a silhouette from the category, refined by words in the name. Null if unknown. */
export function silhouetteFor(category: string | null, name: string | null): Silhouette | null {
  const n = (name ?? "").toLowerCase();
  switch (category) {
    case "top":
      if (/sweater|knit|turtleneck|cardigan|hoodie/.test(n)) return "sweater";
      if (/shirt|blouse|oxford/.test(n) && !/t-?shirt|tee/.test(n)) return "shirt";
      return "tee";
    case "outer":
      return /sweater|cardigan/.test(n) ? "sweater" : "jacket";
    case "bottom":
      return /skirt/.test(n) ? "skirt" : "pants";
    case "one_piece":
      return "dress";
    default:
      return null;
  }
}

const COLORS: Record<string, string> = {
  white: "#ffffff",
  cream: "#f2e3c6",
  beige: "#d9cbb3",
  camel: "#c9a67a",
  grey: "#8a8f98",
  gray: "#8a8f98",
  black: "#2b2b2b",
  navy: "#24345c",
  indigo: "#2f3a4f",
  blue: "#6c8ebf",
  green: "#4f7a5a",
  olive: "#6b6b3a",
  rust: "#b4532a",
  burgundy: "#7a2e3b",
  pink: "#e59ab0",
  red: "#b8433c",
  multi: "#e59ab0",
  plaid: "#8c5a4a",
};

/** Fill color for a garment color name; a neutral lilac when unknown */
export function garmentColorHex(color: string | null): string {
  return (color && COLORS[color.toLowerCase()]) || "#c4abe0";
}
