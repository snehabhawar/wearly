import { describe, expect, it } from "vitest";
import { buildDeck, buildListing, type DeckGarment, type DeckStats } from "./deck";

const garment = (id: string, extra: Partial<DeckGarment> = {}): DeckGarment => ({
  id,
  name: `Garment ${id}`,
  photoPath: null,
  category: "top",
  priceCents: 4000,
  createdAt: "2025-08-28T12:00:00Z",
  hangerNumber: Number(id),
  ...extra,
});
const stats = (extra: Partial<DeckStats> = {}): DeckStats => ({
  idleDaysInSeason: 200,
  browsedCount: 0,
  wears90d: 0,
  lastWornOn: null,
  ...extra,
});

describe("buildDeck", () => {
  it("keeps garments waiting 180+ days and not in a keep challenge", () => {
    const cards = buildDeck({
      garments: [garment("1"), garment("2"), garment("3")],
      stats: new Map([
        ["1", stats()],
        ["2", stats({ idleDaysInSeason: 179 })],
        ["3", stats()],
      ]),
      inChallenge: new Set(["3"]),
      timeZone: "America/New_York",
    });
    expect(cards.map((c) => c.garment_id)).toEqual(["1"]);
  });

  it("puts the most browsed first, then the least worn, then the longest wait", () => {
    const cards = buildDeck({
      garments: ["1", "2", "3", "4"].map((id) => garment(id)),
      stats: new Map([
        ["1", stats({ browsedCount: 0, idleDaysInSeason: 400 })],
        ["2", stats({ browsedCount: 15 })],
        ["3", stats({ browsedCount: 0, idleDaysInSeason: 300 })],
        ["4", stats({ browsedCount: 3 })],
      ]),
      inChallenge: new Set(),
      timeZone: "America/New_York",
    });
    expect(cards.map((c) => c.garment_id)).toEqual(["2", "4", "1", "3"]);
  });

  it("dates the wait from the last wear, or the day it was added in the closet's timezone", () => {
    const [worn, never] = buildDeck({
      garments: [garment("1"), garment("2", { createdAt: "2025-08-29T02:00:00Z" })],
      stats: new Map([
        ["1", stats({ lastWornOn: "2026-03-14", browsedCount: 1 })],
        ["2", stats()],
      ]),
      inChallenge: new Set(),
      timeZone: "America/New_York",
    });
    expect(worn.waiting_since).toBe("2026-03-14");
    expect(never.waiting_since).toBe("2025-08-28");
  });
});

describe("buildListing", () => {
  it("prices a quarter to two fifths of what it cost, in whole dollars", () => {
    expect(buildListing({ name: "Camel wool coat", category: "outer", priceCents: 18900, color: "camel" })).toEqual({
      title: "Camel wool coat",
      body: "Camel wool coat, gently worn and ready for a new closet. Color: camel. Category: outerwear.",
      price_min_cents: 4700,
      price_max_cents: 7600,
    });
  });

  it("falls back for a garment with no tags or price", () => {
    expect(buildListing({ name: null, category: null, priceCents: null })).toMatchObject({
      title: "Closet piece",
      price_min_cents: 1000,
      price_max_cents: 2000,
    });
  });
});
