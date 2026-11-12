import { describe, expect, it } from "vitest";
import { looksFor, STYLED_GARMENTS } from "./tryon";

describe("Style it looks", () => {
  it("returns no looks for a garment without any", () => {
    expect(looksFor("00000000-0000-0000-0000-000000000224")).toEqual([]);
  });

  it("has 1-3 looks per garment, each with a unique id and image", () => {
    for (const id of STYLED_GARMENTS) {
      const looks = looksFor(id);
      expect(looks.length).toBeGreaterThanOrEqual(1);
      expect(looks.length).toBeLessThanOrEqual(3);
      expect(new Set(looks.map((l) => l.id)).size).toBe(looks.length);
      expect(new Set(looks.map((l) => l.image)).size).toBe(looks.length);
    }
  });

  it("pairs each garment with other garments only", () => {
    for (const id of STYLED_GARMENTS) {
      for (const look of looksFor(id)) {
        expect(look.with.length).toBeGreaterThan(0);
        expect(look.with).not.toContain(id);
      }
    }
  });

  it("names images after the garment's seed number", () => {
    expect(looksFor("00000000-0000-0000-0000-000000000218")[0].image).toBe("/demo/tryon/18-a.webp");
  });
});
