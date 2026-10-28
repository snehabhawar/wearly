import { expect, test } from "vitest";
import { formatCents, formatMonth, formatMonthDay, formatSince } from "./format";

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
