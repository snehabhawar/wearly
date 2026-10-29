import { HubEventsRequest } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { ingestEvents, latestAbsences, simDevice } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev only (docs/api.md): the hub ingest with HUB_DEV_SECRET added on the server, plus each
// touched hanger's latest absence for the simulator's event log
export async function POST(request: Request) {
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await simDevice(db, now);
    if (!device) return errorResponse("not_found", "The simulator is off");

    const body = await readJson(request, HubEventsRequest);
    if (!body.ok) return body.response;

    const result = await ingestEvents(db, device, body.data.events, now);
    const hangers = [...new Set(body.data.events.map((e) => e.hanger))];
    return Response.json({ ...result, absences: await latestAbsences(db, device.closetId, hangers) });
  });
}
