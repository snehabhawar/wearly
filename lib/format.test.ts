import { expect, test } from "vitest";
import { formatCents, formatMonth, formatMonthDay } from "./format";

test("dates format as written, without a timezone shift", () => {
  expect(formatMonthDay("2026-10-01")).toBe("Oct 1");
  expect(formatMonth("2026-03-31")).toBe("March");
});

test("cents format as dollars", () => {
  expect(formatCents(205)).toBe("$2.05");
  expect(formatCents(18900)).toBe("$189.00");
});
