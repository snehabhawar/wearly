import { hasLeftForGood, stepHanger, sweepAbsence, SWEEP_INTERVAL_MS } from "@/lib/wear-engine";
import { applyWear, openAbsencesIn, type OpenAbsenceRow } from "./absences";
import { queueLight } from "./commands";
import { check, loadCloset, type Db, type HubCloset } from "./db";

export type SweepResult = { provisionalWears: number; missing: number; rehomed: number };

/**
 * The closet-wide sweep, run on hub polls (docs/backend.md, Sweep). Throttled by
 * closets.last_swept_at: every poll in demo, every 5 minutes for real. Returns null when skipped.
 */
export async function sweepCloset(db: Db, closetId: string, now: Date, options: { force?: boolean } = {}) {
  const closet = await loadCloset(db, closetId);

  // Claim this run, so two polls at once don't both sweep
  const due = new Date(now.getTime() - SWEEP_INTERVAL_MS[closet.profileName]).toISOString();
  let claim = db.from("closets").update({ last_swept_at: now.toISOString() }).eq("id", closet.id);
  if (!options.force) claim = claim.or(`last_swept_at.is.null,last_swept_at.lte.${due}`);
  if (check(await claim.select("id")).length === 0) return null;

  const result: SweepResult = { provisionalWears: 0, missing: 0, rehomed: 0 };
  for (const absence of await openAbsencesIn(db, closet.id)) {
    if (absence.garmentStatus === "let_go" && hasLeftForGood(absence, now, closet.profile)) {
      await rehome(db, closet, absence, now);
      result.rehomed++;
      continue;
    }
    if (absence.classification === "missing") continue;

    const step = sweepAbsence(absence, now, closet.profile);
    if (step.missing) {
      check(await db.from("absences").update({ classification: "missing" }).eq("id", absence.id));
      if (absence.garmentId) {
        check(await db.from("garments").update({ status: "missing" }).eq("id", absence.garmentId).eq("status", "active"));
      }
      result.missing++;
    }
    if (step.wear === "add") result.provisionalWears++;
    await applyWear(db, closet, absence, step.wear);
  }
  return result;
}

/**
 * A let-go garment that left: it is rehomed, its hanger is freed and turned off. Ending the
 * assignment closes the absence now, classified like any return, as replayHanger does.
 */
async function rehome(db: Db, closet: HubCloset, absence: OpenAbsenceRow, now: Date) {
  const step = stepHanger({ open: absence, event: { onRail: true, garmentOn: true, occurredAt: now }, profile: closet.profile });
  if (step.kind !== "close") return;
  const at = now.toISOString();
  check(
    await db.from("absences").update({ returned_at: at, classification: step.classification }).eq("id", absence.id),
  );
  await applyWear(db, closet, absence, step.wear);
  if (absence.garmentId) {
    check(await db.from("hanger_assignments").update({ ended_at: at }).eq("garment_id", absence.garmentId).is("ended_at", null));
    check(await db.from("garments").update({ status: "rehomed" }).eq("id", absence.garmentId));
  }
  await queueLight(db, {
    closetId: closet.id,
    hangerId: absence.hangerId,
    light: { color: "off", pattern: "off" },
    reason: "rehomed",
    now,
  });
}
