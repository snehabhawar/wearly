import { cookies } from "next/headers";
import { FindHangerResponse, HangerNumber } from "@/lib/api";
import { errorResponse, handle } from "@/lib/http";
import { queueLight } from "@/lib/hub";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

// docs/api.md, Hangers: blinks a hanger white so its garment is easy to spot
export async function POST(_request: Request, ctx: RouteContext<"/api/hangers/[number]/find">) {
  return handle(async () => {
    const number = HangerNumber.safeParse(Number((await ctx.params).number));
    if (!number.success) return errorResponse("invalid_query", "Hanger numbers are whole numbers from 1");

    // The user's session and RLS decide which closet and hangers they can reach
    const supabase = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(supabase);
    if (!closet) return errorResponse("unauthorized", "Sign in to find a hanger");
    const { data: hanger, error } = await supabase
      .from("hangers")
      .select("id")
      .eq("closet_id", closet.id)
      .eq("number", number.data)
      .maybeSingle();
    if (error) throw error;
    if (!hanger) return errorResponse("not_found", `There's no hanger ${number.data} in this closet`);

    // Only the service role writes commands (RLS: users read them)
    const commandId = await queueLight(createAdminClient(), {
      closetId: closet.id,
      hangerId: hanger.id,
      light: { color: "white", pattern: "blink2" },
      reason: "find",
      now: new Date(),
    });
    const body: FindHangerResponse = { command_id: commandId };
    return Response.json(body, { status: 202 });
  });
}
