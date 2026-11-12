import { cookies } from "next/headers";
import { Id, MAX_PHOTO_BYTES, type GarmentPhotoResponse } from "@/lib/api";
import { saveGarmentPhoto, signedPhotoUrl } from "@/lib/garments/server";
import { errorResponse, handle } from "@/lib/http";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";

// Background removal runs inside the request (a few seconds)
export const maxDuration = 30;

// docs/api.md, Garments: the garment's photo, as a redirect to a short-lived signed URL
export async function GET(_request: Request, ctx: RouteContext<"/api/garments/[id]/photo">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) return errorResponse("invalid_query", "That isn't a garment id");

    const user = createServerSupabase(await cookies());
    if (!(await getCurrentCloset(user))) return errorResponse("unauthorized", "Sign in to see your photos");
    const url = await signedPhotoUrl(user, id.data);
    if (!url) return errorResponse("not_found", "This garment has no photo yet");
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=300" } });
  });
}

// docs/api.md, Garments: a new photo (multipart field `photo`), background removed
export async function POST(request: Request, ctx: RouteContext<"/api/garments/[id]/photo">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) return errorResponse("invalid_query", "That isn't a garment id");

    const user = createServerSupabase(await cookies());
    if (!(await getCurrentCloset(user))) return errorResponse("unauthorized", "Sign in to add a photo");

    const form = await request.formData().catch(() => null);
    const photo = form?.get("photo");
    if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
      return errorResponse("invalid_body", "Send the photo as multipart field `photo`");
    }
    if (photo.size > MAX_PHOTO_BYTES) return errorResponse("invalid_body", "That photo is too large");

    const key = process.env.FASHN_API_KEY;
    if (!key) return errorResponse("upstream_error", "Photo cutouts aren't set up on this server (FASHN_API_KEY)");

    const result = await saveGarmentPhoto(user, id.data, Buffer.from(await photo.arrayBuffer()), key, new Date());
    if (!result.ok) {
      if (result.reason === "not_found") return errorResponse("not_found", "That garment isn't in your closet");
      if (result.reason === "no_garment_found") {
        return errorResponse("invalid_body", "We couldn't spot a garment in that photo. Try a plainer background.");
      }
      return errorResponse("upstream_error", "We couldn't cut out the background just now. Your photo is saved; try again in a moment.");
    }
    const body: GarmentPhotoResponse = { photo_path: result.photoPath };
    return Response.json(body);
  });
}
