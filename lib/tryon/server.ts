import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { GarmentCategory, TryOnJob } from "@/lib/api";
import { downloadOutput, FashnError, predictionStatus, startTryOn } from "@/lib/fashn";
import type { Database, Json } from "@/lib/supabase/types";
import { dressingOrder, FASHN_CATEGORY, type OutfitPiece } from "./outfit";

/*
 * Live try-on jobs (docs/backend.md, FASHN try-on). A job chains one FASHN prediction per
 * garment, each on the previous result. Nothing runs in the background: every poll of
 * GET /api/tryon/{id} checks the current prediction and, when it's done, starts the next
 * one or stores the final image. So each request stays short, whatever the hosting limits.
 * Everything runs as the signed-in user, under RLS (ai_jobs, the garments and tryon buckets).
 */

type Db = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["ai_jobs"]["Row"];

const BUCKET = "tryon";
/** The demo model, served from public/ */
export const DEMO_MODEL_PATH = "/demo/tryon/model.jpg";
/** Images sent to FASHN: its working size, as JPEG */
const FASHN_SIZE = { width: 864, height: 1296 };
/** A job not finished after this long has failed (FASHN takes about 10–20 s per garment) */
const JOB_TIMEOUT_MS = 10 * 60_000;
/** How long a result's signed URL lives, in seconds */
const SIGNED_URL_SECONDS = 3600;
/** Marks a step that one poll is already finishing, so two polls never start the same step twice */
const CLAIMED = "claimed";

/** New try-ons a closet may start per 24 h; cached outfits don't count (TRYON_DAILY_LIMIT) */
export function dailyLimit(): number {
  const n = Number(process.env.TRYON_DAILY_LIMIT);
  return Number.isInteger(n) && n >= 0 ? n : 10;
}

type JobInput = { model: string; steps: { garment_id: string; category: GarmentCategory }[] };

export type TryOnContext = { key: string; origin: string; now: Date };
export type Closet = { id: string; model_photo_path: string | null };

export type StartResult =
  | { ok: true; job: TryOnJob; reused: boolean }
  | { ok: false; reason: "not_found" | "invalid" | "rate_limited" | "upstream"; message: string };

/** Paths of a closet's files in the tryon bucket */
export const tryonPaths = {
  result: (closetId: string, jobId: string) => `${closetId}/${jobId}.webp`,
  model: (closetId: string, version: number) => `${closetId}/model-${version}.jpg`,
};

/** POST /api/tryon: reuses the same outfit if it was made already, else starts a new job */
export async function startTryOnJob(user: Db, closet: Closet, garmentIds: string[], ctx: TryOnContext): Promise<StartResult> {
  const { data: garments, error } = await user
    .from("garments")
    .select("id, category, photo_path, cutout_path, status")
    .in("id", garmentIds);
  if (error) throw error;
  if (garments.length !== new Set(garmentIds).size) return { ok: false, reason: "not_found", message: "Those garments aren't all in your closet" };
  if (garments.some((g) => !g.photo_path)) return { ok: false, reason: "invalid", message: "Every garment needs a photo first" };
  if (garments.some((g) => !g.category)) return { ok: false, reason: "invalid", message: "Every garment needs a type first" };

  const order = dressingOrder(garments.map((g) => ({ garmentId: g.id, category: g.category as GarmentCategory })));
  if (!order.ok) return { ok: false, reason: "invalid", message: order.reason };

  // Same model photo + same garment photos = same picture
  const model = closet.model_photo_path ?? "demo";
  const cacheKey = createHash("sha256")
    .update([model, ...garments.map((g) => `${g.id}:${g.photo_path}`).sort()].join("|"))
    .digest("hex");

  const { data: earlier, error: earlierError } = await user
    .from("ai_jobs")
    .select("*")
    .eq("closet_id", closet.id)
    .eq("kind", "tryon")
    .eq("cache_key", cacheKey)
    .in("status", ["done", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (earlierError) throw earlierError;
  if (earlier && (earlier.status === "done" || !timedOut(earlier, ctx.now))) {
    return { ok: true, job: view(earlier), reused: true };
  }

  const since = new Date(ctx.now.getTime() - 24 * 3600_000).toISOString();
  const { count, error: countError } = await user
    .from("ai_jobs")
    .select("id", { count: "exact", head: true })
    .eq("closet_id", closet.id)
    .eq("kind", "tryon")
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= dailyLimit()) {
    return { ok: false, reason: "rate_limited", message: "That's all the new try-ons for today. Looks you've made already still open." };
  }

  const input: JobInput = { model, steps: order.steps.map((s) => ({ garment_id: s.garmentId, category: s.category })) };
  const { data: job, error: insertError } = await user
    .from("ai_jobs")
    .insert({
      closet_id: closet.id,
      kind: "tryon",
      provider: "fashn",
      status: "running",
      input: input as unknown as Json,
      output: { step: 0 },
      cache_key: cacheKey,
      provider_job_id: CLAIMED,
      created_at: ctx.now.toISOString(),
    })
    .select("*")
    .single();
  if (insertError) throw insertError;

  try {
    const modelImage = await loadModelImage(user, closet, ctx.origin);
    const predictionId = await startStep(user, ctx, order.steps[0], modelImage);
    const started = await update(user, job.id, { provider_job_id: predictionId });
    return { ok: true, job: view(started), reused: false };
  } catch (err) {
    console.error(err);
    await fail(user, job.id, ctx.now, err);
    return { ok: false, reason: "upstream", message: "We couldn't start the try-on just now. Try again in a moment." };
  }
}

/** GET /api/tryon/{id}: moves the job one step along if its current prediction is done */
export async function advanceTryOnJob(user: Db, closetId: string, jobId: string, ctx: TryOnContext): Promise<TryOnJob | null> {
  const { data: job, error } = await user
    .from("ai_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("closet_id", closetId)
    .eq("kind", "tryon")
    .maybeSingle();
  if (error) throw error;
  if (!job) return null;
  if (job.status !== "running") return view(job);
  if (timedOut(job, ctx.now)) return view(await fail(user, job.id, ctx.now, new FashnError("timed out")));
  // Another poll is finishing this step right now
  if (!job.provider_job_id || job.provider_job_id === CLAIMED) return view(job);

  const status = await predictionStatus(ctx.key, job.provider_job_id);
  if (status.status === "pending") return view(job);
  if (status.status === "failed") return view(await fail(user, job.id, ctx.now, new FashnError(status.error)));

  // Claim the finished step: only the poll whose update matches goes on
  const { data: claimed, error: claimError } = await user
    .from("ai_jobs")
    .update({ provider_job_id: CLAIMED })
    .eq("id", job.id)
    .eq("provider_job_id", job.provider_job_id)
    .select("*")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return view(job);

  const input = job.input as unknown as JobInput;
  const step = stepOf(job);
  try {
    if (step + 1 < input.steps.length) {
      // The next garment goes on top of this result (FASHN's temporary URL is fine as input)
      const next = input.steps[step + 1];
      const predictionId = await startStep(user, ctx, { garmentId: next.garment_id, category: next.category }, status.output);
      return view(await update(user, job.id, { provider_job_id: predictionId, output: { step: step + 1 } }));
    }
    const image = await sharp(await downloadOutput(status.output)).webp({ quality: 85 }).toBuffer();
    const path = tryonPaths.result(closetId, job.id);
    const { error: uploadError } = await user.storage.from(BUCKET).upload(path, image, { contentType: "image/webp", upsert: true });
    if (uploadError) throw uploadError;
    return view(
      await update(user, job.id, {
        status: "done",
        output_path: path,
        provider_job_id: null,
        output: { step: input.steps.length - 1 },
        finished_at: ctx.now.toISOString(),
      }),
    );
  } catch (err) {
    console.error(err);
    return view(await fail(user, job.id, ctx.now, err));
  }
}

/** GET /api/tryon/{id}/image: a short-lived signed URL for a finished job's image */
export async function signedTryOnUrl(user: Db, closetId: string, jobId: string): Promise<string | null> {
  const { data, error } = await user.from("ai_jobs").select("output_path").eq("id", jobId).eq("closet_id", closetId).maybeSingle();
  if (error) throw error;
  if (!data?.output_path) return null;
  return signed(user, data.output_path);
}

/** POST /api/tryon/model-photo: stores the user's own full-body photo and makes it the model */
export async function saveModelPhoto(user: Db, closet: Closet, photo: Buffer, now: Date): Promise<void> {
  const image = await sharp(photo)
    .rotate()
    .resize(FASHN_SIZE.width, FASHN_SIZE.height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  // A new path per photo, so try-ons cached on the old photo aren't reused
  const path = tryonPaths.model(closet.id, now.getTime());
  const { error } = await user.storage.from(BUCKET).upload(path, image, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  await setModelPhoto(user, closet, path);
}

/** DELETE /api/tryon/model-photo: back to the demo model */
export async function clearModelPhoto(user: Db, closet: Closet): Promise<void> {
  await setModelPhoto(user, closet, null);
}

/** GET /api/tryon/model-photo: a short-lived signed URL for the user's model photo, or null */
export async function signedModelPhotoUrl(user: Db, closet: Closet): Promise<string | null> {
  return closet.model_photo_path ? signed(user, closet.model_photo_path) : null;
}

// ---------- helpers ----------

async function setModelPhoto(user: Db, closet: Closet, path: string | null) {
  const { error } = await user.from("closets").update({ model_photo_path: path }).eq("id", closet.id);
  if (error) throw error;
  if (closet.model_photo_path && closet.model_photo_path !== path) {
    // Best effort: the old file is no longer used
    await user.storage.from(BUCKET).remove([closet.model_photo_path]);
  }
}

async function startStep(user: Db, ctx: TryOnContext, piece: OutfitPiece, modelImage: string): Promise<string> {
  const garmentImage = await loadGarmentImage(user, piece.garmentId, ctx.origin);
  return startTryOn(ctx.key, { model_image: modelImage, garment_image: garmentImage, category: FASHN_CATEGORY[piece.category] });
}

/** The model photo as a JPEG data URI: the user's own, else the demo model */
async function loadModelImage(user: Db, closet: Closet, origin: string): Promise<string> {
  if (closet.model_photo_path) return dataUri(await download(user, closet.model_photo_path));
  return dataUri(await fetchBytes(new URL(DEMO_MODEL_PATH, origin)));
}

/** A garment's photo as a JPEG data URI: from storage if taken in the app, else the demo file */
async function loadGarmentImage(user: Db, garmentId: string, origin: string): Promise<string> {
  const { data, error } = await user.from("garments").select("photo_path, cutout_path").eq("id", garmentId).single();
  if (error) throw error;
  if (data.cutout_path) {
    const { data: file, error: fileError } = await user.storage.from("garments").download(data.cutout_path);
    if (fileError) throw fileError;
    return dataUri(Buffer.from(await file.arrayBuffer()));
  }
  if (!data.photo_path) throw new Error(`Garment ${garmentId} has no photo`);
  return dataUri(await fetchBytes(new URL(data.photo_path, origin)));
}

async function download(user: Db, path: string): Promise<Buffer> {
  const { data, error } = await user.storage.from(BUCKET).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function fetchBytes(url: URL): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url.pathname} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Cutouts are transparent: flatten on white, at FASHN's working size */
async function dataUri(image: Buffer): Promise<string> {
  const jpeg = await sharp(image)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(FASHN_SIZE.width, FASHN_SIZE.height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function signed(user: Db, path: string): Promise<string> {
  const { data, error } = await user.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

async function update(user: Db, jobId: string, changes: Database["public"]["Tables"]["ai_jobs"]["Update"]): Promise<JobRow> {
  const { data, error } = await user.from("ai_jobs").update(changes).eq("id", jobId).select("*").single();
  if (error) throw error;
  return data;
}

function fail(user: Db, jobId: string, now: Date, err: unknown): Promise<JobRow> {
  const message = err instanceof Error ? err.message : String(err);
  return update(user, jobId, { status: "failed", error: message.slice(0, 500), provider_job_id: null, finished_at: now.toISOString() });
}

const timedOut = (job: JobRow, now: Date) => now.getTime() - new Date(job.created_at).getTime() > JOB_TIMEOUT_MS;

const stepOf = (job: JobRow) => {
  const step = (job.output as { step?: unknown } | null)?.step;
  return typeof step === "number" ? step : 0;
};

/** The API's view of a job: errors stay in the table, the user gets one warm sentence */
export function view(job: JobRow): TryOnJob {
  const steps = (job.input as unknown as JobInput).steps?.length || 1;
  return {
    job_id: job.id,
    status: job.status as TryOnJob["status"],
    step: job.status === "done" ? steps : Math.min(stepOf(job) + 1, steps),
    steps,
    image_url: job.status === "done" ? `/api/tryon/${job.id}/image` : null,
    error: job.status === "failed" ? "The try-on didn't work this time. Try again, or pick other pieces." : null,
  };
}
