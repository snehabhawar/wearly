import { expect, test } from "vitest";
import { formatAway, toItemDetail, type ItemRow } from "./item";

const garment: ItemRow = {
  id: "g8",
  name: "Camel wool coat",
  category: "outer",
  color: "camel",
  seasons: ["fall", "winter"],
  formality: 3,
  photo_path: null,
  tags_source: "user",
  status: "active",
  hanger_assignments: [
    { hangers: { number: 8, led_color: "amber", led_pattern: "breathe", on_rail: true, garment_on: true } },
  ],
};

test("formatAway", () => {
  expect([10_000, 3 * 60_000, 8 * 3_600_000, 3 * 86_400_000].map(formatAway)).toEqual(["1 min", "3 min", "8 h", "3 days"]);
});

test("toItemDetail builds tags, the hanger and recent activity in the closet's timezone", () => {
  const item = toItemDetail({
    garment,
    stats: { wears_ytd: 2, last_worn_on: "2026-03-14", browsed_count: 6, idle_days_in_season: 214, cost_per_wear: 2250 },
    absences: [
      { left_at: "2026-10-12T14:00:00Z", returned_at: "2026-10-12T14:45:00Z", classification: "tried_on" },
      // 01:00 UTC on Oct 22 is still Oct 21 in New York
      { left_at: "2026-10-22T01:00:00Z", returned_at: "2026-10-22T01:03:00Z", classification: "browsed" },
      { left_at: "2026-10-28T12:00:00Z", returned_at: null, classification: "open" },
    ],
    timeZone: "America/New_York",
  });
  expect(item.tags).toEqual(["Outerwear", "Camel", "Fall · Winter", "Smart casual", "Tagged by you"]);
  expect(item.hanger).toEqual({ number: 8, light: { color: "amber", pattern: "breathe" }, away: false });
  expect(item.activity).toEqual([
    { day: "2026-10-28", kind: "out", detail: "out now" },
    { day: "2026-10-21", kind: "browsed", detail: "out for 3 min" },
    { day: "2026-10-12", kind: "tried_on", detail: "out for 45 min" },
  ]);
  expect(item).toMatchObject({ wearsYtd: 2, browsedCount: 6, costPerWearCents: 2250 });
});

test("a garment we know nothing about has no tags and no hanger once rehomed", () => {
  const item = toItemDetail({
    garment: { ...garment, name: null, category: null, color: null, seasons: null, formality: null, tags_source: null, status: "rehomed", hanger_assignments: [] },
    stats: null,
    absences: [],
    timeZone: "UTC",
  });
  expect(item).toMatchObject({ tags: [], hanger: null, status: "rehomed", wearsYtd: 0, activity: [] });
});
