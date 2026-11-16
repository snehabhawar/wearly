import { describe, expect, it } from "vitest";
import { dressingOrder, outfitKey, pairingSlots, suggestPairings } from "./outfit";

describe("dressingOrder", () => {
  it("layers bottoms, then tops, then outerwear", () => {
    const r = dressingOrder([
      { garmentId: "coat", category: "outer" },
      { garmentId: "blouse", category: "top" },
      { garmentId: "jeans", category: "bottom" },
    ]);
    expect(r.ok && r.steps.map((s) => s.garmentId)).toEqual(["jeans", "blouse", "coat"]);
  });

  it("refuses two pieces of one type, a top with a dress, and too many pieces", () => {
    expect(dressingOrder([]).ok).toBe(false);
    expect(
      dressingOrder([
        { garmentId: "a", category: "top" },
        { garmentId: "b", category: "top" },
      ]).ok,
    ).toBe(false);
    expect(
      dressingOrder([
        { garmentId: "dress", category: "one_piece" },
        { garmentId: "tee", category: "top" },
      ]).ok,
    ).toBe(false);
    expect(
      dressingOrder([
        { garmentId: "a", category: "top" },
        { garmentId: "a", category: "bottom" },
      ]).ok,
    ).toBe(false);
  });

  it("dresses a single garment", () => {
    const r = dressingOrder([{ garmentId: "dress", category: "one_piece" }]);
    expect(r.ok && r.steps).toHaveLength(1);
  });
});

describe("suggestPairings", () => {
  const item = (garmentId: string, category: "top" | "bottom" | "outer", wears90d: number, extra = {}) => ({
    garmentId,
    category,
    photoPath: `/demo/${garmentId}.webp`,
    status: "active",
    wears90d,
    ...extra,
  });

  it("offers the slots a top can pair with, preferred pieces first, then the most worn", () => {
    const closet = [
      item("blouse", "top", 0),
      item("jeans", "bottom", 9),
      item("trousers", "bottom", 2),
      item("skirt", "bottom", 5, { photoPath: null }),
      item("old", "bottom", 20, { status: "let_go" }),
      item("coat", "outer", 1),
    ];
    const slots = suggestPairings({ garmentId: "blouse", category: "top" }, closet, ["trousers"]);
    expect(slots.map((s) => s.slot)).toEqual(pairingSlots("top"));
    expect(slots[0].options.map((o) => o.garmentId)).toEqual(["trousers", "jeans"]);
    expect(slots[1].options.map((o) => o.garmentId)).toEqual(["coat"]);
  });
});

describe("outfitKey", () => {
  it("ignores the order the pieces were picked in", () => {
    expect(outfitKey(["b", "a"])).toBe(outfitKey(["a", "b"]));
  });
});
