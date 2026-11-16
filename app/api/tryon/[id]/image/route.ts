import { cookies } from "next/headers";
import { Id } from "@/lib/api";
import { errorResponse, handle } from "@/lib/http";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";
import { signedTryOnUrl } from "@/lib/tryon/server";

// docs/api.md, Try-on: a finished try-on's image, as a redirect to a short-lived signed URL
export async function GET(_request: Request, ctx: RouteContext<"/api/tryon/[id]/image">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) return errorResponse("invalid_query", "That isn't a try-on id");

    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to see your try-ons");
    const url = await signedTryOnUrl(user, closet.id, id.data);
    if (!url) return errorResponse("not_found", "This try-on has no image yet");
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=300" } });
  });
}
