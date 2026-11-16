import { cookies } from "next/headers";
import { Id } from "@/lib/api";
import { errorResponse, handle } from "@/lib/http";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";
import { advanceTryOnJob } from "@/lib/tryon/server";

// The last step downloads FASHN's image and stores it
export const maxDuration = 30;

// docs/api.md, Try-on: a job's status; each poll moves it along
export async function GET(request: Request, ctx: RouteContext<"/api/tryon/[id]">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) return errorResponse("invalid_query", "That isn't a try-on id");

    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to see your try-ons");

    const key = process.env.FASHN_API_KEY;
    if (!key) return errorResponse("upstream_error", "Try-on isn't set up on this server (FASHN_API_KEY)");

    const job = await advanceTryOnJob(user, closet.id, id.data, { key, origin: new URL(request.url).origin, now: new Date() });
    if (!job) return errorResponse("not_found", "There's no such try-on");
    return Response.json(job, { headers: { "Cache-Control": "no-store" } });
  });
}
