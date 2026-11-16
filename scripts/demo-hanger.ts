/**
 * Puts a demo garment on the real hanger, by swapping two garments' hangers in the data.
 * The firmware keeps its number; only hanger_assignments change, so each garment keeps its
 * photo, history and try-ons. Re-run after `pnpm db:reset` (the seed puts garment n on hanger n).
 *
 * Usage: pnpm demo:hanger [garment] [hanger]
 *   Default: garment 14 (Black blazer) onto hanger 1, the real hanger. The garment that was
 *   on hanger 1 moves to the blazer's old hanger.
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/types";

const CLOSET_ID = "00000000-0000-0000-0000-0000000000c1";
const seedGarment = (n: number) => `00000000-0000-0000-0000-0000000002${String(n).padStart(2, "0")}`;

const [garmentArg = "14", hangerArg = "1"] = process.argv.slice(2);
const garmentId = seedGarment(Number(garmentArg));
const targetNumber = Number(hangerArg);

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

function found<T>(value: T, what: string): NonNullable<T> {
  if (value == null) throw new Error(`${what} not found. Did the seed run?`);
  return value as NonNullable<T>;
}

async function main() {
  const target = found(
    check(await db.from("hangers").select("id").eq("closet_id", CLOSET_ID).eq("number", targetNumber).maybeSingle()),
    `Hanger ${targetNumber}`,
  );
  const mine = found(
    check(await db.from("hanger_assignments").select("id, hanger_id").eq("garment_id", garmentId).is("ended_at", null).maybeSingle()),
    `Garment ${garmentArg} on a hanger`,
  );
  if (mine.hanger_id === target.id) {
    console.log(`Garment ${garmentArg} is already on hanger ${targetNumber}.`);
    return;
  }
  const other = check(
    await db.from("hanger_assignments").select("id").eq("hanger_id", target.id).is("ended_at", null).maybeSingle(),
  );

  // Only one open assignment per hanger: close ours for a moment, move the other, reopen ours
  const now = new Date().toISOString();
  check(await db.from("hanger_assignments").update({ ended_at: now }).eq("id", mine.id));
  if (other) check(await db.from("hanger_assignments").update({ hanger_id: mine.hanger_id }).eq("id", other.id));
  check(await db.from("hanger_assignments").update({ hanger_id: target.id, ended_at: null }).eq("id", mine.id));

  const rows = found(
    check(
      await db
        .from("hanger_assignments")
        .select("hangers!inner(number), garments!inner(name)")
        .is("ended_at", null)
        .in("hanger_id", [target.id, mine.hanger_id]),
    ),
    "Assignments",
  );
  for (const r of rows) console.log(`Hanger ${r.hangers.number}: ${r.garments.name ?? "(no name yet)"}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
