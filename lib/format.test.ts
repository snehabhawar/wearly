import { expect, test } from "vitest";
import { formatCents, formatMonth, formatMonthDay, formatSince, localMidnight, mondayOf, todayIn } from "./format";

test("today is the closet's local date, not UTC", () => {
  // 02:30 UTC on Oct 28 is still the evening of Oct 27 in New York
  expect(todayIn("America/New_York", new Date("2026-10-28T02:30:00Z"))).toBe("2026-10-27");
  expect(todayIn("UTC", new Date("2026-10-28T02:30:00Z"))).toBe("2026-10-28");
});

test("dates format as written, without a timezone shift", () => {
  expect(formatMonthDay("2026-10-01")).toBe("Oct 1");
  expect(formatMonth("2026-03-31")).toBe("March");
});

test("'since' dates name the year only when it isn't this year", () => {
  expect(formatSince("2026-03-04", "2026-10-28")).toBe("March");
  expect(formatSince("2025-05-31", "2026-10-28")).toBe("May 2025");
});

test("cents format as dollars", () => {
  expect(formatCents(205)).toBe("$2.05");
  expect(formatCents(18900)).toBe("$189.00");
});

test("localMidnight finds the start of a local day across offsets", () => {
  expect(localMidnight("2026-10-30", "America/New_York").toISOString()).toBe("2026-10-30T04:00:00.000Z");
  expect(localMidnight("2026-11-02", "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z");
  expect(localMidnight("2026-10-30", "Asia/Ho_Chi_Minh").toISOString()).toBe("2026-10-29T17:00:00.000Z");
});

test("mondayOf", () => {
  expect(["2026-10-26", "2026-10-29", "2026-11-01"].map(mondayOf)).toEqual(["2026-10-26", "2026-10-26", "2026-10-26"]);
});
