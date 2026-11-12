import { cookies } from "next/headers";
import { Id, UpdateGarmentRequest, UpdateGarmentResponse } from "@/lib/api";
import { updateGarment } from "@/lib/garments/server";
import { errorResponse, handle, readJson } from "@/lib/http";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

// docs/api.md, Garments: the name and type the user typed
export async function PATCH(request: Request, ctx: RouteContext<"/api/garments/[id]">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) return errorResponse("invalid_query", "That isn't a garment id");

    const user = createServerSupabase(await cookies());
    if (!(await getCurrentCloset(user))) return errorResponse("unauthorized", "Sign in to edit a garment");

    const body = await readJson(request, UpdateGarmentRequest);
    if (!body.ok) return body.response;

    const garment = await updateGarment(user, id.data, body.data);
    if (!garment) return errorResponse("not_found", "That garment isn't in your closet");
    return Response.json(UpdateGarmentResponse.parse(garment));
  });
}
