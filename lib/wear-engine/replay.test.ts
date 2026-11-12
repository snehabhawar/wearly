import { describe, expect, test } from "vitest";
import { WEAR_PROFILES } from "./profiles";
import { replayHanger, type Assignment, type HangerEvent } from "./replay";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = new Date("2026-10-01T12:00:00Z").getTime();
const at = (offsetMs: number) => new Date(T0 + offsetMs);

const off = (t: number): HangerEvent => ({ onRail: true, garmentOn: false, occurredAt: at(t) });
const on = (t: number): HangerEvent => ({ onRail: true, garmentOn: true, occurredAt: at(t) });
const shirt: Assignment = { garmentId: "shirt", startedAt: at(-30 * DAY), endedAt: null };

function replay(events: HangerEvent[], nowOffset: number, assignments = [shirt]) {
  return replayHanger({
    events,
    assignments,
    profile: WEAR_PROFILES.real,
    timeZone: "America/New_York",
    now: at(nowOffset),
  });
}

describe("replayHanger", () => {
  test("lift and put back is browsed, not a wear", () => {
    const r = replay([off(0), on(2 * MIN)], HOUR);
    expect(r.absences).toEqual([
      { garmentId: "shirt", leftAt: at(0), returnedAt: at(2 * MIN), classification: "browsed" },
    ]);
    expect(r.wears).toEqual([]);
  });

  test("out for a day is one wear on the local date it left", () => {
    // Leaves 23:30 New York time on Sep 30 (03:30 UTC Oct 1)
    const leave = -8.5 * HOUR;
    const r = replay([off(leave), on(leave + 9 * HOUR)], DAY);
    expect(r.absences[0].classification).toBe("worn");
    expect(r.wears).toEqual([{ garmentId: "shirt", wornOn: "2026-09-30", absenceIndex: 0 }]);
  });

  test("out for several days is worn_washed and still one wear", () => {
    const r = replay([off(0), on(3 * DAY)], 4 * DAY);
    expect(r.absences[0].classification).toBe("worn_washed");
    expect(r.wears).toHaveLength(1);
  });

  test("duplicate states don't open a second absence", () => {
    const r = replay([off(0), off(MIN), on(5 * HOUR), on(6 * HOUR)], DAY);
    expect(r.absences).toHaveLength(1);
    expect(r.absences[0].returnedAt).toEqual(at(5 * HOUR));
  });

  test("an empty hanger moved off the rail is ignored", () => {
    const r = replay([{ onRail: false, garmentOn: false, occurredAt: at(0) }], HOUR);
    expect(r.absences).toEqual([]);
    expect(r.finalState).toEqual({ onRail: false, garmentOn: false, occurredAt: at(0) });
  });

  test("taking the hanger out with the garment counts as away", () => {
    const r = replay([{ onRail: false, garmentOn: true, occurredAt: at(0) }, on(10 * HOUR)], DAY);
    expect(r.absences[0].classification).toBe("worn");
  });

  test("a garment still out past the worn threshold gets a provisional wear", () => {
    const r = replay([off(0)], 4 * HOUR);
    expect(r.absences[0]).toMatchObject({ returnedAt: null, classification: "open" });
    expect(r.wears).toHaveLength(1);
  });

  test("a garment still out for a short while has no wear yet", () => {
    const r = replay([off(0)], HOUR);
    expect(r.absences[0].classification).toBe("open");
    expect(r.wears).toEqual([]);
  });

  test("a garment out past the missing threshold is missing, without a wear", () => {
    const r = replay([off(0)], 15 * DAY);
    expect(r.absences[0]).toMatchObject({ returnedAt: null, classification: "missing" });
    expect(r.wears).toEqual([]);
  });

  test("a rehomed garment's absence closes when its assignment ends", () => {
    const old: Assignment = { garmentId: "old", startedAt: at(-30 * DAY), endedAt: at(30 * MIN) };
    const next: Assignment = { garmentId: "new", startedAt: at(DAY), endedAt: null };
    // Old garment leaves, is rehomed 30 min later; a new garment is hung the next day
    const r = replay([off(0), on(DAY)], 2 * DAY, [old, next]);
    expect(r.absences).toEqual([
      { garmentId: "old", leftAt: at(0), returnedAt: at(30 * MIN), classification: "tried_on" },
    ]);
    expect(r.wears).toEqual([]);
    expect(r.finalState?.garmentOn).toBe(true);
  });

  test("events are processed in time order", () => {
    const r = replay([on(10 * HOUR), off(0)], DAY);
    expect(r.absences[0].classification).toBe("worn");
  });

  test("a hanger with no garment records absences without a garment or wears", () => {
    const r = replay([off(0), on(10 * HOUR)], DAY, []);
    expect(r.absences[0].garmentId).toBeNull();
    expect(r.wears).toEqual([]);
  });
});
