import { cookies } from "next/headers";
import { Id, PlanLightsRequest } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { lightPlanDay } from "@/lib/planner/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

// docs/api.md, Plan: "Light up tomorrow". That day's hangers glow purple; other purple hangers go off.
export async function POST(request: Request, ctx: RouteContext<"/api/plans/[id]/lights">) {
  return handle(async () => {
    const planId = Id.safeParse((await ctx.params).id);
    if (!planId.success) return errorResponse("invalid_query", "That isn't a plan id");

    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to light up your plan");

    const body = await readJson(request, PlanLightsRequest);
    if (!body.ok) return body.response;

    const result = await lightPlanDay(user, createAdminClient(), closet, planId.data, body.data.day, new Date());
    if (!result) return errorResponse("not_found", "That plan isn't in your closet");
    return Response.json(result, { status: 202 });
  });
}
