/**
 * FASHN API client (docs checked 2026-11-11: https://docs.fashn.ai). Plain TS, no Next imports:
 * used by POST /api/garments/{id}/photo and by scripts/generate-tryon.ts.
 *
 * Every model runs the same way: POST /v1/run, poll /v1/status/{id}, then download the
 * first output right away (output URLs expire after a few days).
 */

const API = "https://api.fashn.ai/v1";

export class FashnError extends Error {}

export type FashnOptions = {
  /** How often to poll, in ms */
  pollMs?: number;
  /** Give up after this long, in ms */
  timeoutMs?: number;
  /** Injected in tests */
  fetch?: typeof fetch;
};

/** Runs one FASHN prediction and returns its first output image */
export async function runFashn(
  key: string,
  modelName: string,
  inputs: Record<string, unknown>,
  { pollMs = 1500, timeoutMs = 60_000, fetch: f = fetch }: FashnOptions = {},
): Promise<Buffer> {
  const auth = { Authorization: `Bearer ${key}` };
  const run = await f(`${API}/run`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });
  const started = (await run.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!run.ok || !started.id) {
    throw new FashnError(`FASHN run failed (${run.status}): ${JSON.stringify(started.error ?? started)}`);
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const res = await f(`${API}/status/${started.id}`, { headers: auth });
    const s = (await res.json()) as { status: string; output?: string[]; error?: unknown };
    if (s.status === "completed" && s.output?.[0]) {
      const out = await f(s.output[0]);
      if (!out.ok) throw new FashnError(`Couldn't download the FASHN output (${out.status})`);
      return Buffer.from(await out.arrayBuffer());
    }
    if (s.status === "failed") throw new FashnError(`FASHN prediction failed: ${JSON.stringify(s.error)}`);
  }
  throw new FashnError(`FASHN prediction ${started.id} timed out`);
}

/** Background removal: a PNG of the main subject on transparency (1 credit) */
export function removeBackground(key: string, imageDataUri: string, options?: FashnOptions): Promise<Buffer> {
  return runFashn(key, "background-remove", { image: imageDataUri }, options);
}

/** Virtual try-on of one garment on a model image (1 credit) */
export function tryOn(
  key: string,
  inputs: { model_image: string; garment_image: string; category: string; segmentation_free?: boolean },
  options?: FashnOptions,
): Promise<Buffer> {
  return runFashn(key, "tryon-v1.6", { ...inputs, mode: "quality", output_format: "png" }, { timeoutMs: 180_000, ...options });
}
