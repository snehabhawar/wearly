import { errorResponse, handle } from "@/lib/http";
import { ackCommands, pendingCommands, simDevice, sweepCloset } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev only: one hub poll cycle (sweep, fetch commands, ack them all), as the firmware would run it
export async function POST() {
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await simDevice(db, now);
    if (!device) return errorResponse("not_found", "The simulator is off");

    const sweep = await sweepCloset(db, device.closetId, now);
    const commands = await pendingCommands(db, device.closetId, now);
    if (commands.length > 0) await ackCommands(db, device.closetId, commands.map((c) => c.id), now);
    return Response.json({ commands, sweep });
  });
}
