import { describe, expect, test } from "vitest";
import { WEAR_PROFILES } from "./profiles";

describe("WEAR_PROFILES", () => {
  test.each(Object.entries(WEAR_PROFILES))("%s thresholds increase", (_name, p) => {
    expect(p.browsedUnder).toBeGreaterThan(0);
    expect(p.triedOnUnder).toBeGreaterThan(p.browsedUnder);
    expect(p.wornUnder).toBeGreaterThan(p.triedOnUnder);
    expect(p.washedUnder).toBeGreaterThan(p.wornUnder);
  });

  test("match the documented bands", () => {
    expect(WEAR_PROFILES.real).toEqual({
      browsedUnder: 20 * 60_000,
      triedOnUnder: 3 * 3_600_000,
      wornUnder: 36 * 3_600_000,
      washedUnder: 14 * 86_400_000,
    });
    expect(WEAR_PROFILES.demo).toEqual({
      browsedUnder: 5_000,
      triedOnUnder: 12_000,
      wornUnder: 20_000,
      washedUnder: 60_000,
    });
  });
});
