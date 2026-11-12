import { describe, expect, it } from "vitest";
import { safeNextPath } from "./auth";

describe("safeNextPath", () => {
  it("keeps paths inside the app", () => {
    expect(safeNextPath("/swipe")).toBe("/swipe");
    expect(safeNextPath("/closet/abc?tab=wears")).toBe("/closet/abc?tab=wears");
  });

  it("falls back to Today when missing", () => {
    expect(safeNextPath(null)).toBe("/today");
    expect(safeNextPath("")).toBe("/today");
  });

  it("refuses to leave the app", () => {
    expect(safeNextPath("https://evil.example")).toBe("/today");
    expect(safeNextPath("//evil.example")).toBe("/today");
    expect(safeNextPath("/\\evil.example")).toBe("/today");
  });

  it("doesn't loop back to /login", () => {
    expect(safeNextPath("/login")).toBe("/today");
    expect(safeNextPath("/login?next=/swipe")).toBe("/today");
  });
});
