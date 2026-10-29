import type { z } from "zod";
import type { ErrorBody, ErrorCode } from "@/lib/api";

/*
 * Helpers for /api/* route handlers. Web-standard Request/Response only, so lib/ stays free of Next imports.
 */

const STATUS: Record<ErrorCode, number> = {
  invalid_body: 400,
  invalid_query: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  upstream_error: 502,
  internal_error: 500,
};

/** Every non-2xx response has the ErrorBody shape (lib/api/common.ts) */
export function errorResponse(code: ErrorCode, message: string, details?: Record<string, unknown>): Response {
  const body: ErrorBody = { error: { code, message, ...(details && { details }) } };
  return Response.json(body, { status: STATUS[code] });
}

/** Parses and validates a JSON body, or returns the 400 to send back */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: errorResponse("invalid_body", "Body must be JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse("invalid_body", "Body doesn't match the schema", { issues: parsed.error.issues }),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Runs a handler and turns an unexpected throw into a logged 500 */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    console.error(error);
    return errorResponse("internal_error", "Something went wrong on our side");
  }
}
