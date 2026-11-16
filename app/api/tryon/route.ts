import { cookies } from "next/headers";
import { StartTryOnRequest } from "@/lib/api";
import { errorResponse, handle, readJson } from "@/lib/http";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createServerSupabase } from "@/lib/supabase/server";
import { startTryOnJob } from "@/lib/tryon/server";

// Loads the photos and starts the first FASHN prediction (a few seconds)
export const maxDuration = 30;

// docs/api.md, Try-on: dress the model in these garments, or reuse the same outfit made earlier
export async function POST(request: Request) {
  return handle(async () => {
    const user = createServerSupabase(await cookies());
    const closet = await getCurrentCloset(user);
    if (!closet) return errorResponse("unauthorized", "Sign in to try things on");

    const body = await readJson(request, StartTryOnRequest);
    if (!body.ok) return body.response;

    const key = process.env.FASHN_API_KEY;
    if (!key) return errorResponse("upstream_error", "Try-on isn't set up on this server (FASHN_API_KEY)");

    const result = await startTryOnJob(user, closet, body.data.garment_ids, {
      key,
      origin: new URL(request.url).origin,
      now: new Date(),
    });
    if (!result.ok) {
      const code = { not_found: "not_found", invalid: "invalid_body", rate_limited: "rate_limited", upstream: "upstream_error" } as const;
      return errorResponse(code[result.reason], result.message);
    }
    return Response.json(result.job, { status: result.reused && result.job.status === "done" ? 200 : 202 });
  });
}
