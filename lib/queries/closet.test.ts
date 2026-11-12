import { expect, test } from "vitest";
import { heatLevel, isWaiting, toClosetItems, toClosetSummary, type HangerRow } from "./closet";
import { FIXTURE_CLOSET } from "./fixtures";

test("heat levels", () => {
  expect([0, 1, 4, 5, 12, 13, 40].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3]);
});

test("the fixture's waiting garments are the seed's forgotten hangers plus the old mystery ones", () => {
  const waiting = FIXTURE_CLOSET.filter(isWaiting).map((i) => i.hangerNumber);
  expect(waiting).toEqual([8, 12, 18, 22, 23, 24]);
});

const garment = { id: "g1", name: "Camel wool coat", category: "outer", color: "camel", photo_path: "/demo/garments/08.jpg", status: "active" };
const hanger = (number: number, extra: Partial<HangerRow> = {}): HangerRow => ({
  number,
  on_rail: true,
  garment_on: true,
  led_color: "off",
  hanger_assignments: [{ garments: garment }],
  ...extra,
});
const stats = {
  garment_id: "g1",
  closet_id: "c1",
  wears_90d: 0,
  wears_ytd: 0,
  last_worn_on: null,
  browsed_count: 2,
  idle_days_in_season: 214,
  cost_per_wear: null,
};

test("toClosetItems joins a hanger, its garment and its stats", () => {
  const [item] = toClosetItems([hanger(8, { led_color: "amber" })], [stats]);
  expect(item).toMatchObject({
    hangerNumber: 8,
    garmentId: "g1",
    name: "Camel wool coat",
    category: "outer",
    light: "amber",
    away: false,
    browsedCount: 2,
    idleDaysInSeason: 214,
  });
  expect(isWaiting(item)).toBe(true);
});

test("toClosetItems sorts by hanger number and handles empty hangers", () => {
  const items = toClosetItems([hanger(3), hanger(1, { hanger_assignments: [] })], [stats]);
  expect(items.map((i) => i.hangerNumber)).toEqual([1, 3]);
  expect(items[0]).toMatchObject({ garmentId: null, status: null, away: false, wears90d: 0 });
});

test("a garment is away when lifted off its hanger or taken out on it", () => {
  const [lifted, taken] = toClosetItems(
    [hanger(1, { garment_on: false }), hanger(2, { on_rail: false })],
    [],
  );
  expect([lifted.away, taken.away]).toEqual([true, true]);
});

test("toClosetSummary falls back to zeros", () => {
  expect(toClosetSummary(null)).toEqual({ hangerCount: 0, photographedCount: 0, worn90dPct: 0, rehomedThisYear: 0 });
});
