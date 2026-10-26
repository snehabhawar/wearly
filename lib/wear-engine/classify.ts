import type { WearProfile } from "./profiles";

export type Classification =
  | "open"
  | "browsed"
  | "tried_on"
  | "worn"
  | "worn_washed"
  | "missing";

/**
 * Whether a hanger's sensor state means its garment is away (docs/backend.md, Hanger states).
 * Returns null for an empty hanger moved off the rail: ignore it and leave any open absence as is.
 */
export function isAway(onRail: boolean, garmentOn: boolean): boolean | null {
  if (onRail && garmentOn) return false;
  if (onRail !== garmentOn) return true;
  return null;
}

/** Classifies a finished absence by how long the garment was away. */
export function classifyDuration(ms: number, profile: WearProfile): Exclude<Classification, "open"> {
  if (ms < profile.browsedUnder) return "browsed";
  if (ms < profile.triedOnUnder) return "tried_on";
  if (ms < profile.wornUnder) return "worn";
  if (ms < profile.washedUnder) return "worn_washed";
  return "missing";
}

export function countsAsWear(classification: Classification): boolean {
  return classification === "worn" || classification === "worn_washed";
}

/** The calendar date (YYYY-MM-DD) of an instant in the closet's timezone. */
export function localDate(at: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
