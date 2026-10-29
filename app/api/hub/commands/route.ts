import { connection } from "next/server";
import type { HubCommandsResponse } from "@/lib/api";
import { errorResponse, handle } from "@/lib/http";
import { authenticateHub, bearerToken, pendingCommands, sweepCloset } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

// Hub contract: docs/api.md, GET /api/hub/commands. The poll also runs the throttled sweep.
export async function GET(request: Request) {
  // Always per request: never prerendered at build time
  await connection();
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await authenticateHub(db, bearerToken(request.headers.get("authorization")), now);
    if (!device) return errorResponse("unauthorized", "Unknown hub secret");

    // Sweep first: rehoming queues lights the hub should get in this same poll
    await sweepCloset(db, device.closetId, now);
    const body: HubCommandsResponse = { commands: await pendingCommands(db, device.closetId, now) };
    return Response.json(body);
  });
}
