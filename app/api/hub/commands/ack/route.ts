import { HubAckRequest } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { ackCommands, authenticateHub, bearerToken } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

// Hub contract: docs/api.md, POST /api/hub/commands/ack
export async function POST(request: Request) {
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await authenticateHub(db, bearerToken(request.headers.get("authorization")), now);
    if (!device) return errorResponse("unauthorized", "Unknown hub secret");

    const body = await readJson(request, HubAckRequest);
    if (!body.ok) return body.response;

    await ackCommands(db, device.closetId, body.data.ids, now);
    return new Response(null, { status: 204 });
  });
}
