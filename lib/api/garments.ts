import { z } from "zod";
import { GarmentCategory, Id } from "./common";

/** Largest photo POST /api/garments/{id}/photo accepts (the app shrinks photos well below this) */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/**
 * POST /api/garments/{id}/photo (multipart, field `photo`): stores the photo, removes the
 * background and returns the new photo_path (an app URL that redirects to a signed image)
 */
export const GarmentPhotoResponse = z.object({ photo_path: z.string() });
export type GarmentPhotoResponse = z.infer<typeof GarmentPhotoResponse>;

/** PATCH /api/garments/{id}: details the user typed; sets tags_source to "user" */
export const UpdateGarmentRequest = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    category: GarmentCategory.optional(),
  })
  .refine((b) => b.name !== undefined || b.category !== undefined, { message: "Send a name or a category" });
export type UpdateGarmentRequest = z.infer<typeof UpdateGarmentRequest>;

export const UpdateGarmentResponse = z.object({
  id: Id,
  name: z.string().nullable(),
  category: GarmentCategory.nullable(),
});
export type UpdateGarmentResponse = z.infer<typeof UpdateGarmentResponse>;
