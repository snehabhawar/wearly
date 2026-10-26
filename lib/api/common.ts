import { z } from "zod";

/*
 * Shared building blocks for the API contract between the frontend, the backend
 * and the hub firmware. Route handlers validate with these schemas and the UI
 * imports their types, so both sides break at compile time when the contract changes.
 */

// Row ids. z.guid() rather than z.uuid(): the seeded fixed ids
// (00000000-...-0000000000c1) aren't RFC version-4 UUIDs.
export const Id = z.guid();

/** A calendar date in the closet's timezone: YYYY-MM-DD */
export const LocalDate = z.iso.date();

/** An instant as an ISO 8601 string with offset, e.g. Postgres timestamptz */
export const Timestamp = z.iso.datetime({ offset: true });

/** Hangers are addressed by the number engraved on the pod, unique per closet */
export const HangerNumber = z.int().min(1);

/** Garment categories, which are also the plan slots */
export const GarmentCategory = z.enum(["top", "bottom", "outer", "one_piece"]);
export type GarmentCategory = z.infer<typeof GarmentCategory>;

export const GarmentStatus = z.enum(["active", "let_go", "rehomed", "missing"]);
export type GarmentStatus = z.infer<typeof GarmentStatus>;

/** The fixed light vocabulary (docs/api.md, Light vocabulary). Color and pattern always travel together. */
export const Light = z.discriminatedUnion("color", [
  z.object({ color: z.literal("purple"), pattern: z.literal("steady") }),
  z.object({ color: z.literal("amber"), pattern: z.literal("breathe") }),
  z.object({ color: z.literal("white"), pattern: z.literal("blink2") }),
  z.object({ color: z.literal("off"), pattern: z.literal("off") }),
]);
export type Light = z.infer<typeof Light>;

export const ErrorCode = z.enum([
  "invalid_body",
  "invalid_query",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "upstream_error",
  "internal_error",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Every non-2xx response has this body */
export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
