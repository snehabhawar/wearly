import type { Light } from "@/lib/api";
import type { Classification } from "@/lib/wear-engine";
import { authenticateHub, type HubDevice } from "./auth";
import { check, type Db } from "./db";

/*
 * Dev-only helpers behind /api/sim/*: the /sim page plays the hub for the dev closet.
 */

/** The dev hub (HUB_DEV_SECRET), or null in production or when the secret matches no device */
export async function simDevice(db: Db, now: Date): Promise<HubDevice | null> {
  if (process.env.NODE_ENV === "production") return null;
  return authenticateHub(db, process.env.HUB_DEV_SECRET ?? null, now);
}

export type SimHanger = {
  number: number;
  onRail: boolean;
  garmentOn: boolean;
  light: Light;
  garment: { name: string | null; category: string | null; color: string | null; photoPath: string | null; status: string } | null;
};

export type SimAbsence = {
  hanger: number;
  leftAt: string;
  returnedAt: string | null;
  classification: Classification;
};

/** Every hanger in the closet with its sensors, light and current garment */
export async function simState(db: Db, closetId: string): Promise<SimHanger[]> {
  const rows = check(
    await db
      .from("hangers")
      .select("number, on_rail, garment_on, led_color, led_pattern, hanger_assignments(garments(name, category, color, photo_path, status))")
      .eq("closet_id", closetId)
      .is("hanger_assignments.ended_at", null)
      .order("number"),
  );
  return rows.map((h) => {
    const garment = h.hanger_assignments[0]?.garments ?? null;
    return {
      number: h.number,
      onRail: h.on_rail,
      garmentOn: h.garment_on,
      light: { color: h.led_color, pattern: h.led_pattern } as Light,
      garment: garment && {
        name: garment.name,
        category: garment.category,
        color: garment.color,
        photoPath: garment.photo_path,
        status: garment.status,
      },
    };
  });
}

/** Each hanger's latest absence, for the event log's classification column */
export async function latestAbsences(db: Db, closetId: string, hangerNumbers: number[]): Promise<SimAbsence[]> {
  if (hangerNumbers.length === 0) return [];
  const rows = check(
    await db
      .from("absences")
      .select("left_at, returned_at, classification, hangers!inner(number)")
      .eq("closet_id", closetId)
      .in("hangers.number", hangerNumbers)
      .order("left_at", { ascending: false })
      .limit(hangerNumbers.length * 4),
  );
  const seen = new Set<number>();
  const out: SimAbsence[] = [];
  for (const row of rows) {
    const hanger = row.hangers.number;
    if (seen.has(hanger)) continue;
    seen.add(hanger);
    out.push({
      hanger,
      leftAt: row.left_at,
      returnedAt: row.returned_at,
      classification: row.classification as Classification,
    });
  }
  return out;
}

/**
 * Puts every hanger back in the closet with its light off and drops what is still in flight:
 * open absences (and their provisional wears) and pending commands. Finished history stays.
 */
export async function simReset(db: Db, closetId: string, now: Date): Promise<void> {
  check(await db.from("absences").delete().eq("closet_id", closetId).is("returned_at", null));
  check(await db.from("commands").delete().eq("closet_id", closetId).is("acked_at", null));
  check(
    await db
      .from("hangers")
      .update({ on_rail: true, garment_on: true, led_color: "off", led_pattern: "off", state_changed_at: now.toISOString() })
      .eq("closet_id", closetId),
  );
}
