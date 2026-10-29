import { cookies } from "next/headers";
import { connection } from "next/server";
import { errorResponse, handle } from "@/lib/http";
import { getDeck } from "@/lib/swipe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

// docs/api.md, Swipe: the ordered deck; lights the top card's hanger amber
export async function GET() {
  // Always per request: never prerendered at build time
  await connection();
  return handle(async () => {
    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to see your deck");
    return Response.json(await getDeck(user, createAdminClient(), closet, new Date()));
  });
}
