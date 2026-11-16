import { z } from "zod";
import { Id } from "./common";

/** POST /api/tryon: the garments to dress the model in (the styled one plus what it's paired with) */
export const StartTryOnRequest = z.object({ garment_ids: z.array(Id).min(1).max(3) });
export type StartTryOnRequest = z.infer<typeof StartTryOnRequest>;

export const TryOnStatus = z.enum(["queued", "running", "done", "failed"]);
export type TryOnStatus = z.infer<typeof TryOnStatus>;

/**
 * A try-on job, from POST /api/tryon (202, or 200 when the same outfit was already made)
 * and GET /api/tryon/{id}, which the app polls: each poll moves the job along.
 */
export const TryOnJob = z.object({
  job_id: Id,
  status: TryOnStatus,
  /** 1-based garment being dressed right now, out of `steps` */
  step: z.int().min(0),
  steps: z.int().min(1),
  /** App URL of the finished image (redirects to a short-lived signed URL) */
  image_url: z.string().nullable(),
  /** Why it failed, in words for the user */
  error: z.string().nullable(),
});
export type TryOnJob = z.infer<typeof TryOnJob>;

/** POST (multipart field `photo`) and DELETE /api/tryon/model-photo: the user's own model photo */
export const ModelPhotoResponse = z.object({ model_photo: z.boolean() });
export type ModelPhotoResponse = z.infer<typeof ModelPhotoResponse>;
