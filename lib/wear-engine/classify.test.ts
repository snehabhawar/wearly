import { describe, expect, test } from "vitest";
import { classifyDuration, countsAsWear, isAway, localDate } from "./classify";
import { WEAR_PROFILES } from "./profiles";

const { real, demo } = WEAR_PROFILES;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("isAway", () => {
  test("in the closet", () => expect(isAway(true, true)).toBe(false));
  test("garment taken off the hanger", () => expect(isAway(true, false)).toBe(true));
  test("taken out on its hanger", () => expect(isAway(false, true)).toBe(true));
  test("empty hanger moved is ignored", () => expect(isAway(false, false)).toBeNull());
});

describe("classifyDuration (real)", () => {
  test.each([
    [0, "browsed"],
    [20 * MIN - 1, "browsed"],
    [20 * MIN, "tried_on"],
    [3 * HOUR - 1, "tried_on"],
    [3 * HOUR, "worn"],
    [36 * HOUR - 1, "worn"],
    [36 * HOUR, "worn_washed"],
    [14 * DAY - 1, "worn_washed"],
    [14 * DAY, "missing"],
  ] as const)("%i ms is %s", (ms, expected) => {
    expect(classifyDuration(ms, real)).toBe(expected);
  });
});

describe("classifyDuration (demo)", () => {
  test.each([
    [4_999, "browsed"],
    [5_000, "tried_on"],
    [12_000, "worn"],
    [20_000, "worn_washed"],
    [60_000, "missing"],
  ] as const)("%i ms is %s", (ms, expected) => {
    expect(classifyDuration(ms, demo)).toBe(expected);
  });
});

test("only worn and worn_washed count as wears", () => {
  expect(countsAsWear("worn")).toBe(true);
  expect(countsAsWear("worn_washed")).toBe(true);
  for (const c of ["open", "browsed", "tried_on", "missing"] as const) {
    expect(countsAsWear(c)).toBe(false);
  }
});

describe("localDate", () => {
  test("uses the closet timezone, not UTC", () => {
    // 02:30 UTC on Oct 27 is still Oct 26 in New York
    const at = new Date("2026-10-27T02:30:00Z");
    expect(localDate(at, "America/New_York")).toBe("2026-10-26");
    expect(localDate(at, "UTC")).toBe("2026-10-27");
  });
});
