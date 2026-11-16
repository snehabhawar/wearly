import { cookies } from "next/headers";
import { MAX_PHOTO_BYTES, type ModelPhotoResponse } from "@/lib/api";
import { errorResponse, handle } from "@/lib/http";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearModelPhoto, saveModelPhoto, signedModelPhotoUrl } from "@/lib/tryon/server";

// docs/api.md, Try-on: the user's own model photo, as a redirect to a short-lived signed URL
export async function GET() {
  return handle(async () => {
    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to see your photo");
    const url = await signedModelPhotoUrl(user, closet);
    if (!url) return errorResponse("not_found", "Try-ons use the demo model");
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=300" } });
  });
}

// docs/api.md, Try-on: a full-body photo (multipart field `photo`) that try-ons dress from now on
export async function POST(request: Request) {
  return handle(async () => {
    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to add your photo");

    const form = await request.formData().catch(() => null);
    const photo = form?.get("photo");
    if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
      return errorResponse("invalid_body", "Send the photo as multipart field `photo`");
    }
    if (photo.size > MAX_PHOTO_BYTES) return errorResponse("invalid_body", "That photo is too large");

    await saveModelPhoto(user, closet, Buffer.from(await photo.arrayBuffer()), new Date());
    const body: ModelPhotoResponse = { model_photo: true };
    return Response.json(body);
  });
}

// docs/api.md, Try-on: back to the demo model
export async function DELETE() {
  return handle(async () => {
    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to change your photo");
    await clearModelPhoto(user, closet);
    const body: ModelPhotoResponse = { model_photo: false };
    return Response.json(body);
  });
}
