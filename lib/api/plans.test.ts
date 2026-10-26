import { expect, test } from "vitest";
import { Forecast, GeneratePlanRequest } from "./plans";

test("week_start must be a Monday and replace defaults to false", () => {
  expect(GeneratePlanRequest.parse({ week_start: "2026-10-26" })).toEqual({
    week_start: "2026-10-26",
    replace: false,
  });
  expect(GeneratePlanRequest.safeParse({ week_start: "2026-10-27" }).success).toBe(false);
});

test("forecast days have the agreed fields", () => {
  const day = { day: "2026-10-26", high_c: 14, low_c: 6, rain: true, condition: "rain", summary: "Rain after 4 pm" };
  expect(Forecast.safeParse([day]).success).toBe(true);
  expect(Forecast.safeParse([{ ...day, condition: "stormy" }]).success).toBe(false);
});
