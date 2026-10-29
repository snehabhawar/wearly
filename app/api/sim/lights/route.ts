import { z } from "zod";
import { HangerNumber, Light } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { queueLight, simDevice } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";

const SimLightsRequest = z.object({ hangers: z.array(HangerNumber).min(1), light: Light });

// Dev only: queue a light on some hangers, as Find it, the plan or the deck would
export async function POST(request: Request) {
  return handle(async () => {
    const now = new Date();
    const db = createAdminClient();
    const device = await simDevice(db, now);
    if (!device) return errorResponse("not_found", "The simulator is off");

    const body = await readJson(request, SimLightsRequest);
    if (!body.ok) return body.response;

    const { data: hangers, error } = await db
      .from("hangers")
      .select("id, number")
      .eq("closet_id", device.closetId)
      .in("number", body.data.hangers);
    if (error) throw error;
    const ids = [];
    for (const h of hangers) {
      ids.push(await queueLight(db, { closetId: device.closetId, hangerId: h.id, light: body.data.light, reason: "sim", now }));
    }
    return Response.json({ command_ids: ids }, { status: 202 });
  });
}
