import { expect, test } from "vitest";
import { garmentColorHex, silhouetteFor } from "./garment-visuals";

test.each([
  ["top", "White oxford shirt", "shirt"],
  ["top", "Grey crewneck tee", "tee"],
  ["top", "Cream knit sweater", "sweater"],
  ["top", "Rust turtleneck", "sweater"],
  ["top", "Burgundy silk blouse", "shirt"],
  ["outer", "Camel wool coat", "jacket"],
  ["bottom", "Floral midi skirt", "skirt"],
  ["bottom", "Dark indigo jeans", "pants"],
  ["one_piece", "Linen wrap dress", "dress"],
  [null, null, null],
] as const)("%s %s -> %s", (category, name, expected) => {
  expect(silhouetteFor(category, name)).toBe(expected);
});

test("unknown colors fall back to a neutral fill", () => {
  expect(garmentColorHex("Navy")).toBe("#24345c");
  expect(garmentColorHex("chartreuse")).toBe("#c4abe0");
  expect(garmentColorHex(null)).toBe("#c4abe0");
});
