import { cookies } from "next/headers";
import { GeneratePlanRequest, type GeneratePlanResponse } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { generatePlan } from "@/lib/planner/server";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

// docs/api.md, Plan: runs the planner for a week (Monday start); the UI then reads plans and plan_items
export async function POST(request: Request) {
  return handle(async () => {
    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to plan your week");

    const body = await readJson(request, GeneratePlanRequest);
    if (!body.ok) return body.response;

    const planId = await generatePlan(user, closet, body.data.week_start, body.data.replace, new Date());
    const response: GeneratePlanResponse = { plan_id: planId };
    return Response.json(response);
  });
}
