import { describe, expect, it } from "vitest";
import type { ForecastDay } from "@/lib/api";
import { addDays, planWeek, seasonOf, type PlannerGarment, type PlannerStats } from "./plan";

const MONDAY = "2026-10-26";

let n = 0;
const g = (category: PlannerGarment["category"], extra: Partial<PlannerGarment> = {}): PlannerGarment => {
  n++;
  return {
    id: `g${String(n).padStart(2, "0")}`,
    name: `${category ?? "mystery"} ${n}`,
    category,
    seasons: null,
    formality: 3,
    active: true,
    away: false,
    hangerId: `h${n}`,
    hangerNumber: n,
    ...extra,
  };
};
const weather = (high: number, rain = false): ForecastDay => ({
  day: MONDAY,
  high_c: high,
  low_c: high - 8,
  rain,
  condition: rain ? "rain" : "clear",
  summary: "",
});
const mild = Array.from({ length: 7 }, () => weather(20));
const noEvents = Array.from({ length: 7 }, () => []);
const plan = (garments: PlannerGarment[], extra: Partial<Parameters<typeof planWeek>[0]> = {}) =>
  planWeek({
    weekStart: MONDAY,
    forecast: mild,
    events: noEvents,
    garments,
    stats: new Map(),
    inChallenge: new Set(),
    ...extra,
  });
const slots = (day: ReturnType<typeof plan>[number]) => day.items.map((i) => i.slot).sort();
const wardrobe = () => [
  ...Array.from({ length: 4 }, () => g("top")),
  ...Array.from({ length: 4 }, () => g("bottom")),
  ...Array.from({ length: 3 }, () => g("outer")),
];

describe("helpers", () => {
  it("seasonOf and addDays", () => {
    expect([seasonOf("2026-10-26"), seasonOf("2026-01-02"), seasonOf("2026-07-01")]).toEqual(["fall", "winter", "summer"]);
    expect(addDays("2026-10-26", 6)).toBe("2026-11-01");
  });
});

describe("planWeek", () => {
  it("plans seven days of top + bottom, with a layer only when it's cool or wet", () => {
    const forecast = [weather(20), weather(12), weather(20, true), weather(20), weather(20), weather(20), weather(20)];
    const days = plan(wardrobe(), { forecast });
    expect(days.map((d) => d.day)).toEqual(Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i)));
    expect(slots(days[0])).toEqual(["bottom", "top"]);
    expect(slots(days[1])).toContain("outer");
    expect(slots(days[2])).toContain("outer");
  });

  it("never plans let-go, rehomed or away garments", () => {
    const out = g("top", { away: true });
    const gone = g("top", { active: false });
    const days = plan([out, gone, ...wardrobe()]);
    const used = days.flatMap((d) => d.items.map((i) => i.garmentId));
    expect(used).not.toContain(out.id);
    expect(used).not.toContain(gone.id);
  });

  it("doesn't repeat a piece within 3 days", () => {
    const days = plan(wardrobe());
    days.forEach((d, i) => {
      for (const prev of days.slice(Math.max(0, i - 2), i)) {
        const ids = new Set(prev.items.map((it) => it.garmentId));
        expect(d.items.some((it) => ids.has(it.garmentId))).toBe(false);
      }
    });
  });

  it("matches the dress code within one step when it can", () => {
    const casual = g("top", { formality: 1 });
    const sharp = g("top", { formality: 4 });
    const events = [[{ title: "Presentation", time: "10:00", dress: 4 as const }], ...noEvents.slice(1)];
    const [monday] = plan([casual, sharp, g("bottom", { formality: 4 })], { events });
    expect(monday.items.find((i) => i.slot === "top")?.garmentId).toBe(sharp.id);
    expect(monday.reason).toContain("Dressed for presentation.");
  });

  it("keeps out-of-season pieces for when nothing else fits", () => {
    const summer = g("top", { seasons: ["summer"] });
    const fall = g("top", { seasons: ["fall", "winter"] });
    const [monday] = plan([summer, fall, g("bottom")]);
    expect(monday.items.find((i) => i.slot === "top")?.garmentId).toBe(fall.id);
  });

  it("puts a kept piece in its challenge first, and says so", () => {
    const tops = [g("top"), g("top"), g("top")];
    const kept = tops[2];
    const days = plan([...tops, g("bottom"), g("bottom")], {
      stats: new Map<string, PlannerStats>(tops.map((t) => [t.id, { idleDaysInSeason: 0, wears90d: 10 }])),
      inChallenge: new Set([kept.id]),
    });
    expect(days[0].items.some((i) => i.garmentId === kept.id)).toBe(true);
    expect(days[0].reason).toContain("you kept gets its chance");
  });

  it("features one mystery pick on Tuesday and fills gaps with mystery hangers", () => {
    const unknown = g(null, { name: null, hangerNumber: 19 });
    const days = plan([unknown, ...wardrobe()]);
    const tuesdayTop = days[1].items.find((i) => i.slot === "top");
    expect(tuesdayTop).toMatchObject({ garmentId: unknown.id, mystery: true });
    expect(days[1].reason).toContain("Hanger 19 has no photo yet");

    const onlyBottoms = plan([g(null, { name: null }), g("bottom"), g("bottom"), g("bottom")]);
    expect(onlyBottoms[0].items.find((i) => i.slot === "top")?.mystery).toBe(true);
  });

  it("plans without a forecast, layering in fall", () => {
    const [monday] = plan(wardrobe(), { forecast: null });
    expect(slots(monday)).toContain("outer");
    expect(monday.reason.startsWith("Rain")).toBe(false);
  });
});
