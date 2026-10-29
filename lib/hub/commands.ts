import type { HubCommand, Light } from "@/lib/api";
import { check, type Db } from "./db";

/**
 * Queues a light for a hanger. A lasting light (purple, amber, off) expires older commands still
 * pending for that hanger, so the hub can never fall back to a stale light after acking it.
 * White blinks are momentary and expire nothing: a lasting light queued before still goes out after.
 */
export async function queueLight(
  db: Db,
  input: { closetId: string; hangerId: string; light: Light; reason: string; expiresAt?: Date; now: Date },
): Promise<number> {
  const now = input.now.toISOString();
  if (input.light.color !== "white") {
    check(
      await db
        .from("commands")
        .update({ expires_at: now })
        .eq("hanger_id", input.hangerId)
        .is("acked_at", null)
        .gt("expires_at", now),
    );
  }
  const row = check(
    await db
      .from("commands")
      .insert({
        closet_id: input.closetId,
        hanger_id: input.hangerId,
        color: input.light.color,
        pattern: input.light.pattern,
        reason: input.reason,
        // Omitted: the 5-minute default
        ...(input.expiresAt && { expires_at: input.expiresAt.toISOString() }),
      })
      .select("id")
      .single(),
  );
  return row.id;
}

/** What the hub should show: per hanger, the newest command not yet acked or expired */
export async function pendingCommands(db: Db, closetId: string, now: Date): Promise<HubCommand[]> {
  const rows = check(
    await db
      .from("commands")
      .select("id, color, pattern, hangers(number)")
      .eq("closet_id", closetId)
      .is("acked_at", null)
      .gt("expires_at", now.toISOString())
      .order("id", { ascending: false }),
  );
  const seen = new Set<number>();
  const commands: HubCommand[] = [];
  for (const row of rows) {
    const hanger = row.hangers?.number;
    if (hanger === undefined || seen.has(hanger)) continue;
    seen.add(hanger);
    commands.push({ id: row.id, hanger, color: row.color, pattern: row.pattern } as HubCommand);
  }
  return commands.reverse();
}

/** Marks commands forwarded. A database trigger then copies each light onto its hanger. */
export async function ackCommands(db: Db, closetId: string, ids: number[], now: Date): Promise<void> {
  check(
    await db
      .from("commands")
      .update({ acked_at: now.toISOString() })
      .eq("closet_id", closetId)
      .in("id", ids)
      .is("acked_at", null),
  );
}
