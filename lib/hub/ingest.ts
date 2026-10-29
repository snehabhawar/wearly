import type { HubEvent, HubEventsResponse } from "@/lib/api";
import { stepHanger } from "@/lib/wear-engine";
import { applyWear, openAbsenceFor } from "./absences";
import type { HubDevice } from "./auth";
import { check, isUniqueViolation, loadCloset, type Db, type HubCloset } from "./db";

/**
 * POST /api/hub/events: stores each event (dropping duplicate seq), updates the hanger's
 * current state and runs the wear engine for that hanger. Events arrive oldest first.
 */
export async function ingestEvents(db: Db, device: HubDevice, events: HubEvent[], now: Date): Promise<HubEventsResponse> {
  const closet = await loadCloset(db, device.closetId);
  const hangers = check(await db.from("hangers").select("id, number, state_changed_at").eq("closet_id", closet.id));
  const byNumber = new Map(hangers.map((h) => [h.number, { id: h.id, stateChangedAt: new Date(h.state_changed_at) }]));

  let accepted = 0;
  let duplicates = 0;
  const unknown = new Set<number>();

  for (const event of events) {
    const hanger = byNumber.get(event.hanger);
    if (!hanger) {
      unknown.add(event.hanger);
      continue;
    }
    // The hub has no clock: the server dates the event
    const occurredAt = new Date(now.getTime() - event.age_ms);
    const { error } = await db.from("sensor_events").insert({
      closet_id: closet.id,
      device_id: device.id,
      hanger_id: hanger.id,
      on_rail: event.on_rail,
      garment_on: event.garment_on,
      seq: event.seq ?? null,
      occurred_at: occurredAt.toISOString(),
      received_at: now.toISOString(),
    });
    if (isUniqueViolation(error)) {
      duplicates++;
      continue;
    }
    if (error) throw error;
    accepted++;

    // A buffered event older than the current state must not overwrite it
    if (occurredAt >= hanger.stateChangedAt) {
      check(
        await db
          .from("hangers")
          .update({ on_rail: event.on_rail, garment_on: event.garment_on, state_changed_at: occurredAt.toISOString() })
          .eq("id", hanger.id),
      );
      hanger.stateChangedAt = occurredAt;
    }

    await applyEvent(db, closet, hanger.id, { onRail: event.on_rail, garmentOn: event.garment_on, occurredAt });
  }

  return { accepted, duplicates, unknown_hangers: [...unknown] };
}

async function applyEvent(
  db: Db,
  closet: HubCloset,
  hangerId: string,
  event: { onRail: boolean; garmentOn: boolean; occurredAt: Date },
) {
  const open = await openAbsenceFor(db, hangerId);
  const step = stepHanger({ open, event, profile: closet.profile });

  if (step.kind === "open") {
    const assignment = check(
      await db.from("hanger_assignments").select("garment_id").eq("hanger_id", hangerId).is("ended_at", null).maybeSingle(),
    );
    const { error } = await db.from("absences").insert({
      closet_id: closet.id,
      hanger_id: hangerId,
      garment_id: assignment?.garment_id ?? null,
      left_at: step.leftAt.toISOString(),
    });
    // A concurrent request opened it first
    if (error && !isUniqueViolation(error)) throw error;
    return;
  }

  if (step.kind === "close" && open) {
    check(
      await db
        .from("absences")
        .update({ returned_at: step.returnedAt.toISOString(), classification: step.classification })
        .eq("id", open.id),
    );
    await applyWear(db, closet, open, step.wear);
    // Back on its hanger: no longer missing
    if (open.garmentId) {
      check(await db.from("garments").update({ status: "active" }).eq("id", open.garmentId).eq("status", "missing"));
    }
  }
}
