import { describe, expect, it } from "vitest";
import { WEAR_PROFILES } from "./profiles";
import { hasLeftForGood, stepHanger, sweepAbsence } from "./step";

const demo = WEAR_PROFILES.demo;
const t0 = new Date("2026-10-28T12:00:00Z");
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);
const event = (onRail: boolean, garmentOn: boolean, seconds: number) => ({ onRail, garmentOn, occurredAt: at(seconds) });

describe("stepHanger", () => {
  it("opens an absence when the garment is lifted off", () => {
    expect(stepHanger({ open: null, event: event(true, false, 0), profile: demo })).toEqual({ kind: "open", leftAt: t0 });
  });

  it("opens an absence when the hanger is taken out with the garment", () => {
    expect(stepHanger({ open: null, event: event(false, true, 0), profile: demo }).kind).toBe("open");
  });

  it("ignores an empty hanger moved, and repeated states", () => {
    expect(stepHanger({ open: null, event: event(false, false, 0), profile: demo }).kind).toBe("none");
    expect(stepHanger({ open: null, event: event(true, true, 0), profile: demo }).kind).toBe("none");
    expect(stepHanger({ open: { leftAt: t0, hasWear: false }, event: event(true, false, 3), profile: demo }).kind).toBe("none");
  });

  it("closes a quick lift as browsed, with no wear", () => {
    expect(stepHanger({ open: { leftAt: t0, hasWear: false }, event: event(true, true, 2), profile: demo })).toEqual({
      kind: "close",
      returnedAt: at(2),
      classification: "browsed",
      wear: "none",
    });
  });

  it("closes a long absence as worn and adds a wear, or keeps the sweep's provisional one", () => {
    const back = event(true, true, 15);
    expect(stepHanger({ open: { leftAt: t0, hasWear: false }, event: back, profile: demo })).toMatchObject({
      classification: "worn",
      wear: "add",
    });
    expect(stepHanger({ open: { leftAt: t0, hasWear: true }, event: back, profile: demo })).toMatchObject({ wear: "keep" });
  });

  it("never closes before the absence began", () => {
    expect(stepHanger({ open: { leftAt: t0, hasWear: false }, event: event(true, true, -5), profile: demo })).toMatchObject({
      returnedAt: t0,
      classification: "browsed",
    });
  });
});

describe("sweepAbsence", () => {
  it("does nothing while it could still be a browse or try-on", () => {
    expect(sweepAbsence({ leftAt: t0, hasWear: false }, at(8), demo)).toEqual({ missing: false, wear: "none" });
  });

  it("adds a provisional wear once past the tried-on band, once", () => {
    expect(sweepAbsence({ leftAt: t0, hasWear: false }, at(13), demo)).toEqual({ missing: false, wear: "add" });
    expect(sweepAbsence({ leftAt: t0, hasWear: true }, at(13), demo)).toEqual({ missing: false, wear: "keep" });
  });

  it("marks it missing and drops the provisional wear past the missing threshold", () => {
    expect(sweepAbsence({ leftAt: t0, hasWear: true }, at(61), demo)).toEqual({ missing: true, wear: "remove" });
  });
});

describe("hasLeftForGood", () => {
  it("is true once away past the browsed threshold", () => {
    expect(hasLeftForGood({ leftAt: t0, hasWear: false }, at(4), demo)).toBe(false);
    expect(hasLeftForGood({ leftAt: t0, hasWear: false }, at(5), demo)).toBe(true);
  });
});
