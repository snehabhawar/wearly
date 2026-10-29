import { localDate, type OpenAbsence, type WearChange } from "@/lib/wear-engine";
import { check, isUniqueViolation, type Db, type HubCloset } from "./db";

export type OpenAbsenceRow = OpenAbsence & { id: string; hangerId: string; garmentId: string | null };

const OPEN_ABSENCE_COLUMNS = "id, hanger_id, garment_id, left_at, classification, wears(id)" as const;

type AbsenceRow = {
  id: string;
  hanger_id: string;
  garment_id: string | null;
  left_at: string;
  wears: { id: string }[];
};

function toOpen(row: AbsenceRow): OpenAbsenceRow {
  return {
    id: row.id,
    hangerId: row.hanger_id,
    garmentId: row.garment_id,
    leftAt: new Date(row.left_at),
    hasWear: row.wears.length > 0,
  };
}

/** The hanger's absence still away, if any (a unique index allows at most one) */
export async function openAbsenceFor(db: Db, hangerId: string): Promise<OpenAbsenceRow | null> {
  const row = check(
    await db.from("absences").select(OPEN_ABSENCE_COLUMNS).eq("hanger_id", hangerId).is("returned_at", null).maybeSingle(),
  );
  return row ? toOpen(row) : null;
}

/** Every absence still away in the closet, with its garment's status, for the sweep */
export async function openAbsencesIn(db: Db, closetId: string) {
  const rows = check(
    await db
      .from("absences")
      .select(`${OPEN_ABSENCE_COLUMNS}, garments(status)`)
      .eq("closet_id", closetId)
      .is("returned_at", null),
  );
  return rows.map((row) => ({ ...toOpen(row), classification: row.classification, garmentStatus: row.garments?.status ?? null }));
}

/** Writes or removes the wear that belongs to an absence */
export async function applyWear(db: Db, closet: HubCloset, absence: OpenAbsenceRow, change: WearChange): Promise<void> {
  if (change === "add" && absence.garmentId) {
    const { error } = await db.from("wears").insert({
      closet_id: closet.id,
      garment_id: absence.garmentId,
      worn_on: localDate(absence.leftAt, closet.timeZone),
      source: "sensor",
      absence_id: absence.id,
    });
    // Already there: a concurrent ingest or sweep wrote it
    if (error && !isUniqueViolation(error)) throw error;
  }
  if (change === "remove") check(await db.from("wears").delete().eq("absence_id", absence.id));
}
