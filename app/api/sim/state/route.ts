import { connection } from "next/server";
import { errorResponse, handle } from "@/lib/http";
import { loadCloset, simState } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";
import { openSimDevice } from "../device";

// Simulator only: the dev closet's wear profile and its hangers' sensors, lights and garments
export async function GET() {
  // Always per request: never prerendered at build time
  await connection();
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await openSimDevice(db, now);
    if (!device) return errorResponse("not_found", "The simulator is off");
    const closet = await loadCloset(db, device.closetId);
    return Response.json({ profile: closet.profileName, hangers: await simState(db, device.closetId) });
  });
}
