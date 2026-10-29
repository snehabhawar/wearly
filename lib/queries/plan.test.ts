import { expect, test } from "vitest";
import { toWeekPlan } from "./plan";

test("toWeekPlan lays out seven days with weather, events and pieces in dressing order", () => {
  const plan = toWeekPlan({
    id: "p1",
    week_start: "2026-10-26",
    forecast: [{ day: "2026-10-27", high_c: 12, low_c: 4, rain: true, condition: "rain", summary: "Rain" }],
    plan_items: [
      { day: "2026-10-27", slot: "outer", reason: "Rain on the way.", garments: { name: "Denim jacket", category: "outer", color: "blue", photo_path: null }, hangers: { number: 13 } },
      { day: "2026-10-27", slot: "top", reason: "Rain on the way.", garments: { name: null, category: null, color: null, photo_path: null }, hangers: { number: 19 } },
      { day: "2026-10-27", slot: "bottom", reason: "Rain on the way.", garments: { name: "Jeans", category: "bottom", color: "indigo", photo_path: null }, hangers: { number: 9 } },
    ],
  });
  expect(plan.days.map((d) => d.day)).toEqual([
    "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
  ]);
  const tuesday = plan.days[1];
  expect(tuesday.weather?.high_c).toBe(12);
  expect(tuesday.events.map((e) => e.title)).toEqual(["Gym", "Client call"]);
  expect(tuesday.pieces.map((p) => [p.slot, p.hangerNumber, p.mystery])).toEqual([
    ["top", 19, true],
    ["bottom", 9, false],
    ["outer", 13, false],
  ]);
  expect(tuesday.reason).toBe("Rain on the way.");
  expect(plan.days[0]).toMatchObject({ weather: null, pieces: [], reason: null });
});
