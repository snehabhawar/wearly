import { errorResponse, handle } from "@/lib/http";
import { simDevice, simReset, simState } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev only (docs/api.md): every hanger back in the closet, lights off, open absences and pending commands dropped
export async function POST() {
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await simDevice(db, now);
    if (!device) return errorResponse("not_found", "The simulator is off");
    await simReset(db, device.closetId, now);
    return Response.json({ hangers: await simState(db, device.closetId) });
  });
}
