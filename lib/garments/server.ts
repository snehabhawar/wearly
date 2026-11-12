import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { UpdateGarmentRequest } from "@/lib/api";
import { removeBackground } from "@/lib/fashn";
import { frameCutout } from "@/lib/photos/frame";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;

/** Private bucket from migration 20261111120000_garment_photos */
const BUCKET = "garments";
/** Originals are stored at most this size */
const ORIGINAL_MAX_PX = 1600;
/** How long a photo's signed URL lives, in seconds */
const SIGNED_URL_SECONDS = 3600;

/** Storage paths of a garment's photos: {closet_id}/{garment_id}/... */
export const photoPaths = (closetId: string, garmentId: string) => ({
  original: `${closetId}/${garmentId}/original.jpg`,
  cutout: `${closetId}/${garmentId}/cutout.webp`,
});

/** The app URL a garment's photo is served from; `v` changes with every new photo, so caches refresh */
export const photoUrl = (garmentId: string, version: number) => `/api/garments/${garmentId}/photo?v=${version}`;

export type SavePhotoResult =
  | { ok: true; photoPath: string }
  | { ok: false; reason: "not_found" | "no_garment_found" | "cutout_failed" };

/**
 * POST /api/garments/{id}/photo: keeps the original, removes the background with FASHN,
 * frames the cutout like every other garment and points photo_path at it.
 * Runs as the signed-in user: RLS on garments and on the storage bucket scopes everything.
 */
export async function saveGarmentPhoto(
  user: Db,
  garmentId: string,
  photo: Buffer,
  fashnKey: string,
  now: Date,
): Promise<SavePhotoResult> {
  const { data: garment, error } = await user.from("garments").select("id, closet_id").eq("id", garmentId).maybeSingle();
  if (error) throw error;
  if (!garment) return { ok: false, reason: "not_found" };

  const paths = photoPaths(garment.closet_id, garment.id);
  // Upright (phone EXIF), bounded, JPEG: what we keep and what FASHN gets
  const original = await sharp(photo)
    .rotate()
    .resize(ORIGINAL_MAX_PX, ORIGINAL_MAX_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  await upload(user, paths.original, original, "image/jpeg");

  let cutout: Buffer;
  try {
    cutout = await removeBackground(fashnKey, `data:image/jpeg;base64,${original.toString("base64")}`, { timeoutMs: 25_000 });
  } catch (err) {
    console.error(err);
    return { ok: false, reason: "cutout_failed" };
  }
  const framed = await frameCutout(cutout);
  if (!framed) return { ok: false, reason: "no_garment_found" };
  await upload(user, paths.cutout, framed, "image/webp");

  const photoPath = photoUrl(garment.id, now.getTime());
  const { error: updateError } = await user
    .from("garments")
    .update({ photo_path: photoPath, cutout_path: paths.cutout })
    .eq("id", garment.id);
  if (updateError) throw updateError;
  return { ok: true, photoPath };
}

/** GET /api/garments/{id}/photo: a short-lived signed URL for the cutout, or null */
export async function signedPhotoUrl(user: Db, garmentId: string): Promise<string | null> {
  const { data, error } = await user.from("garments").select("cutout_path").eq("id", garmentId).maybeSingle();
  if (error) throw error;
  if (!data?.cutout_path) return null;
  const signed = await user.storage.from(BUCKET).createSignedUrl(data.cutout_path, SIGNED_URL_SECONDS);
  if (signed.error) throw signed.error;
  return signed.data.signedUrl;
}

/** PATCH /api/garments/{id}: what the user typed wins over any future AI tags */
export async function updateGarment(user: Db, garmentId: string, changes: UpdateGarmentRequest) {
  const { data, error } = await user
    .from("garments")
    .update({ ...changes, tags_source: "user" })
    .eq("id", garmentId)
    .select("id, name, category")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upload(user: Db, path: string, body: Buffer, contentType: string) {
  const { error } = await user.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw error;
}
