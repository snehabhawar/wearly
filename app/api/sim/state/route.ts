import { connection } from "next/server";
import { errorResponse, handle } from "@/lib/http";
import { simDevice, simState } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev only: the dev closet's hangers, sensors, lights and garments
export async function GET() {
  // Always per request: never prerendered at build time
  await connection();
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await simDevice(db, now);
    if (!device) return errorResponse("not_found", "The simulator is off");
    return Response.json({ hangers: await simState(db, device.closetId) });
  });
}
