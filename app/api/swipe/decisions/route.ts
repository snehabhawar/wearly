import { cookies } from "next/headers";
import { SwipeDecisionRequest } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { decide } from "@/lib/swipe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

// docs/api.md, Swipe: records keep, let go (with a route) or style
export async function POST(request: Request) {
  return handle(async () => {
    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to decide");

    const body = await readJson(request, SwipeDecisionRequest);
    if (!body.ok) return body.response;

    const result = await decide(user, createAdminClient(), closet, body.data, new Date());
    if (!result) return errorResponse("not_found", "That garment isn't in your closet");
    return Response.json(result);
  });
}
