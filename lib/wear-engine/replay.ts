import { classifyDuration, countsAsWear, isAway, localDate, type Classification } from "./classify";
import type { WearProfile } from "./profiles";

export type HangerEvent = { onRail: boolean; garmentOn: boolean; occurredAt: Date };

export type Assignment = { garmentId: string; startedAt: Date; endedAt: Date | null };

export type DerivedAbsence = {
  garmentId: string | null;
  leftAt: Date;
  returnedAt: Date | null;
  classification: Classification;
};

export type DerivedWear = {
  garmentId: string;
  /** YYYY-MM-DD in the closet timezone, the day the garment left */
  wornOn: string;
  /** Index into the returned absences */
  absenceIndex: number;
};

export type ReplayResult = {
  absences: DerivedAbsence[];
  wears: DerivedWear[];
  /** Sensor state after the last event, or null if there were no events */
  finalState: HangerEvent | null;
};

/**
 * Rebuilds one hanger's absences and wears from its raw events, as the live ingest and
 * sweep would have produced them by `now`.
 *
 * - Repeated states are ignored, so a duplicate "away" doesn't open a second absence.
 * - An absence belongs to the garment assigned to the hanger when it left. If that
 *   assignment ends while the garment is away (it was rehomed), the absence closes then.
 * - A still-open absence past the worn threshold gets a provisional wear; past the
 *   missing threshold it is marked missing, without a wear.
 */
export function replayHanger(input: {
  events: HangerEvent[];
  assignments: Assignment[];
  profile: WearProfile;
  timeZone: string;
  now: Date;
}): ReplayResult {
  const { profile, timeZone, now } = input;
  const events = [...input.events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const absences: DerivedAbsence[] = [];
  let open: DerivedAbsence | null = null;
  let away = false;

  const assignmentAt = (at: Date) =>
    input.assignments.find(
      (a) => a.startedAt <= at && (a.endedAt === null || a.endedAt > at),
    ) ?? null;

  const close = (returnedAt: Date) => {
    if (!open) return;
    open.returnedAt = returnedAt;
    open.classification = classifyDuration(returnedAt.getTime() - open.leftAt.getTime(), profile);
    open = null;
  };

  // Closes the open absence if its garment's assignment ended before `at`
  const closeIfRehomed = (at: Date) => {
    if (!open?.garmentId) return;
    const garmentId = open.garmentId;
    const ended = input.assignments.find(
      (a) => a.garmentId === garmentId && a.startedAt <= open!.leftAt && a.endedAt !== null && a.endedAt <= at,
    );
    if (ended?.endedAt) close(ended.endedAt);
  };

  for (const event of events) {
    closeIfRehomed(event.occurredAt);
    const nowAway = isAway(event.onRail, event.garmentOn);
    if (nowAway === null || nowAway === away) continue;
    away = nowAway;
    if (away) {
      open = {
        garmentId: assignmentAt(event.occurredAt)?.garmentId ?? null,
        leftAt: event.occurredAt,
        returnedAt: null,
        classification: "open",
      };
      absences.push(open);
    } else {
      close(event.occurredAt);
    }
  }
  closeIfRehomed(now);

  const wears: DerivedWear[] = [];
  absences.forEach((a, absenceIndex) => {
    if (a.returnedAt === null) {
      const awayMs = now.getTime() - a.leftAt.getTime();
      if (awayMs >= profile.washedUnder) {
        a.classification = "missing";
        return;
      }
      if (awayMs < profile.triedOnUnder) return;
    } else if (!countsAsWear(a.classification)) {
      return;
    }
    if (a.garmentId) {
      wears.push({ garmentId: a.garmentId, wornOn: localDate(a.leftAt, timeZone), absenceIndex });
    }
  });

  return { absences, wears, finalState: events.at(-1) ?? null };
}
