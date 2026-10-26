import { describe, expect, test } from "vitest";
import { ErrorBody, HangerNumber, Id, Light, LocalDate } from "./common";

describe("common schemas", () => {
  test("Id accepts seeded fixed ids and random uuids", () => {
    expect(Id.safeParse("00000000-0000-0000-0000-0000000000c1").success).toBe(true);
    expect(Id.safeParse("dcfb110d-5e60-47aa-9658-9920ce31627a").success).toBe(true);
    expect(Id.safeParse("hanger-3").success).toBe(false);
  });

  test("LocalDate is YYYY-MM-DD only", () => {
    expect(LocalDate.safeParse("2026-10-26").success).toBe(true);
    expect(LocalDate.safeParse("2026-10-26T00:00:00Z").success).toBe(false);
  });

  test("HangerNumber is a positive integer", () => {
    expect(HangerNumber.safeParse(1).success).toBe(true);
    expect(HangerNumber.safeParse(0).success).toBe(false);
    expect(HangerNumber.safeParse(2.5).success).toBe(false);
  });

  test("Light only allows the fixed color/pattern pairs", () => {
    expect(Light.safeParse({ color: "purple", pattern: "steady" }).success).toBe(true);
    expect(Light.safeParse({ color: "off", pattern: "off" }).success).toBe(true);
    expect(Light.safeParse({ color: "purple", pattern: "breathe" }).success).toBe(false);
    expect(Light.safeParse({ color: "red", pattern: "steady" }).success).toBe(false);
  });

  test("ErrorBody matches the documented shape", () => {
    expect(
      ErrorBody.safeParse({ error: { code: "not_found", message: "unknown hanger 99" } }).success,
    ).toBe(true);
    expect(ErrorBody.safeParse({ error: { code: "oops", message: "x" } }).success).toBe(false);
  });
});
