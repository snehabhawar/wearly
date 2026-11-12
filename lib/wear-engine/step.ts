import { classifyDuration, countsAsWear, isAway, type Classification } from "./classify";
import type { WearProfile } from "./profiles";

/*
 * The live, one-event-at-a-time version of replayHanger: hub ingest and the sweep use these,
 * the replay script uses replayHanger. Both follow the same rules, so a replay rebuilds what
 * the live path wrote.
 */

/** The hanger's absence that is still away, if any */
export type OpenAbsence = { leftAt: Date; hasWear: boolean };

export type WearChange = "add" | "remove" | "keep" | "none";

export type EventStep =
  | { kind: "none" }
  | { kind: "open"; leftAt: Date }
  | { kind: "close"; returnedAt: Date; classification: Exclude<Classification, "open">; wear: WearChange };

/** What one sensor event does to a hanger's absences. An open absence means the garment is away. */
export function stepHanger(input: {
  open: OpenAbsence | null;
  event: { onRail: boolean; garmentOn: boolean; occurredAt: Date };
  profile: WearProfile;
}): EventStep {
  const { open, event, profile } = input;
  const away = isAway(event.onRail, event.garmentOn);
  if (away === null) return { kind: "none" };
  if (away && !open) return { kind: "open", leftAt: event.occurredAt };
  if (!away && open) {
    // A buffered event can't end an absence before it started
    const returnedAt = event.occurredAt < open.leftAt ? open.leftAt : event.occurredAt;
    const classification = classifyDuration(returnedAt.getTime() - open.leftAt.getTime(), profile);
    return { kind: "close", returnedAt, classification, wear: wearChange(open.hasWear, countsAsWear(classification)) };
  }
  return { kind: "none" };
}

export type SweepStep = { missing: boolean; wear: WearChange };

/**
 * What the sweep does to an absence still away at `now`: past the tried-on band it gets a
 * provisional wear so it shows up the same day; past the missing threshold it is missing, with no wear.
 */
export function sweepAbsence(open: OpenAbsence, now: Date, profile: WearProfile): SweepStep {
  const awayMs = now.getTime() - open.leftAt.getTime();
  if (awayMs >= profile.washedUnder) return { missing: true, wear: wearChange(open.hasWear, false) };
  return { missing: false, wear: wearChange(open.hasWear, awayMs >= profile.triedOnUnder) };
}

/** A let-go garment that has been away past the browsed threshold has left the closet for good */
export function hasLeftForGood(open: OpenAbsence, now: Date, profile: WearProfile): boolean {
  return now.getTime() - open.leftAt.getTime() >= profile.browsedUnder;
}

function wearChange(hasWear: boolean, shouldHave: boolean): WearChange {
  if (shouldHave) return hasWear ? "keep" : "add";
  return hasWear ? "remove" : "none";
}
