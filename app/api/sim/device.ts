import { cookies } from "next/headers";
import { simDevice, type HubDevice } from "@/lib/hub";
import type { Db } from "@/lib/hub/db";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * The dev hub for an /api/sim/* request, or null when the simulator is off. In production
 * (SIM_ENABLED=true) the request must come from the signed-in owner of the dev closet.
 */
export async function openSimDevice(db: Db, now: Date): Promise<HubDevice | null> {
  const viewer =
    process.env.NODE_ENV === "production" ? ((await getCurrentCloset(createServerSupabase(await cookies())))?.id ?? null) : null;
  return simDevice(db, now, viewer);
}
