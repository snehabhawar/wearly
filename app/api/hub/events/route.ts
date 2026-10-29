import { HubEventsRequest } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { authenticateHub, bearerToken, ingestEvents } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

// Hub contract: docs/api.md, POST /api/hub/events
export async function POST(request: Request) {
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await authenticateHub(db, bearerToken(request.headers.get("authorization")), now);
    if (!device) return errorResponse("unauthorized", "Unknown hub secret");

    const body = await readJson(request, HubEventsRequest);
    if (!body.ok) return body.response;

    return Response.json(await ingestEvents(db, device, body.data.events, now));
  });
}
