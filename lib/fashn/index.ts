/**
 * FASHN API client (docs checked 2026-11-11: https://docs.fashn.ai). Plain TS, no Next imports:
 * used by POST /api/garments/{id}/photo, the live try-on jobs (lib/tryon) and scripts/generate-tryon.ts.
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

/** A prediction's state, as GET /v1/status/{id} reports it */
export type PredictionStatus =
  | { status: "pending" }
  | { status: "completed"; output: string }
  | { status: "failed"; error: string };

/** Starts one FASHN prediction and returns its id, without waiting for it */
export async function startPrediction(
  key: string,
  modelName: string,
  inputs: Record<string, unknown>,
  { fetch: f = fetch }: Pick<FashnOptions, "fetch"> = {},
): Promise<string> {
  const run = await f(`${API}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });
  const started = (await run.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!run.ok || !started.id) {
    throw new FashnError(`FASHN run failed (${run.status}): ${JSON.stringify(started.error ?? started)}`);
  }
  return started.id;
}

/** Asks once how a prediction is doing; `output` is its first image URL (temporary) */
export async function predictionStatus(
  key: string,
  id: string,
  { fetch: f = fetch }: Pick<FashnOptions, "fetch"> = {},
): Promise<PredictionStatus> {
  const res = await f(`${API}/status/${id}`, { headers: { Authorization: `Bearer ${key}` } });
  const s = (await res.json().catch(() => ({}))) as { status?: string; output?: string[]; error?: unknown };
  if (s.status === "completed" && s.output?.[0]) return { status: "completed", output: s.output[0] };
  if (s.status === "failed") return { status: "failed", error: JSON.stringify(s.error) };
  if (!res.ok) throw new FashnError(`FASHN status failed (${res.status})`);
  return { status: "pending" };
}

/** Downloads an output right away: FASHN's output URLs expire after a few days */
export async function downloadOutput(url: string, { fetch: f = fetch }: Pick<FashnOptions, "fetch"> = {}): Promise<Buffer> {
  const out = await f(url);
  if (!out.ok) throw new FashnError(`Couldn't download the FASHN output (${out.status})`);
  return Buffer.from(await out.arrayBuffer());
}

/** Runs one FASHN prediction to the end and returns its first output image */
export async function runFashn(
  key: string,
  modelName: string,
  inputs: Record<string, unknown>,
  { pollMs = 1500, timeoutMs = 60_000, fetch: f = fetch }: FashnOptions = {},
): Promise<Buffer> {
  const id = await startPrediction(key, modelName, inputs, { fetch: f });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const s = await predictionStatus(key, id, { fetch: f });
    if (s.status === "completed") return downloadOutput(s.output, { fetch: f });
    if (s.status === "failed") throw new FashnError(`FASHN prediction failed: ${s.error}`);
  }
  throw new FashnError(`FASHN prediction ${id} timed out`);
}

/** Background removal: a PNG of the main subject on transparency (1 credit) */
export function removeBackground(key: string, imageDataUri: string, options?: FashnOptions): Promise<Buffer> {
  return runFashn(key, "background-remove", { image: imageDataUri }, options);
}

export type TryOnInputs = { model_image: string; garment_image: string; category: string; segmentation_free?: boolean };

/** FASHN's try-on model and its fixed settings */
export const TRYON_MODEL = "tryon-v1.6";
const tryOnInputs = (inputs: TryOnInputs) => ({ ...inputs, mode: "quality", output_format: "png" });

/** Virtual try-on of one garment on a model image (1 credit) */
export function tryOn(key: string, inputs: TryOnInputs, options?: FashnOptions): Promise<Buffer> {
  return runFashn(key, TRYON_MODEL, tryOnInputs(inputs), { timeoutMs: 180_000, ...options });
}

/** Starts a try-on without waiting (1 credit); poll it with predictionStatus */
export function startTryOn(key: string, inputs: TryOnInputs, options?: Pick<FashnOptions, "fetch">): Promise<string> {
  return startPrediction(key, TRYON_MODEL, tryOnInputs(inputs), options);
}
