/**
 * Pre-generates the Style it try-on images with FASHN, once, before the demo.
 * The app itself never calls FASHN in the MVP; it only shows the files this writes.
 *
 *   photos/tryon/model.jpg + garment photos  ->  FASHN  ->  public/demo/tryon/NN-x.webp
 *
 * Looks come from lib/demo/tryon.ts. FASHN dresses one garment per call, so each look
 * chains calls: bottoms first, then tops, then outerwear, each on the previous result.
 * Garment photos: photos/raw/NN.* if present, else public/demo/garments/NN.webp.
 *
 * The final image is cropped to 3:4 around the person (found with rembg, as in
 * prepare-photos), so the outfit fills the Style it frame.
 *
 * Usage: pnpm tryon:generate [18 | 18-a ...] [--force] [--yes] [--reframe]
 *   18 = every look of garment 18; 18-a = just that look.
 *   Without --yes it only prints the plan and the credits it would use (no API calls).
 *   --reframe redoes only the crop from the saved FASHN result (free).
 * Needs: FASHN_API_KEY in .env.local, a full-body photo at photos/tryon/model.jpg,
 * and Python with rembg for the crop.
 * Docs (checked 2026-11-11): https://docs.fashn.ai/api-reference/tryon-v1-6
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { looksFor, STYLED_GARMENTS, type TryOnLook } from "../lib/demo/tryon";

const API = "https://api.fashn.ai/v1";
const MODEL_PHOTO = "photos/tryon/model.jpg";
const RAW_DIR = "photos/raw";
const STEP_DIR = "photos/tryon/steps"; // every FASHN output, for checking a chain step by step
// Output frame: 3:4, cropped around the person with a margin, head to toe
const OUT = { width: 750, height: 1000 };
const MARGIN = 0.06; // of the person's height, above and below
const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const POLL_MS = 2000;
const TIMEOUT_MS = 180_000;

type Category = "top" | "bottom" | "outer" | "one_piece";
const FASHN_CATEGORY: Record<Category, string> = { top: "tops", bottom: "bottoms", outer: "tops", one_piece: "one-pieces" };
const LAYER: Record<Category, number> = { bottom: 0, one_piece: 0, top: 1, outer: 2 };

const args = process.argv.slice(2);
const force = args.includes("--force");
const spend = args.includes("--yes");
const reframeOnly = args.includes("--reframe");
// "18" picks every look of garment 18, "18-a" one look
const only = args.filter((a) => /^\d+(-[a-z])?$/.test(a)).map((a) => {
  const [n, look] = a.split("-");
  return { garment: Number(n), look };
});

/** Seed number of a seeded garment ID (…0000000002NN) */
const seedNumber = (garmentId: string) => Number(garmentId.slice(-2));
const nn = (n: number) => String(n).padStart(2, "0");

/** Garment categories and names from supabase/seed.sql, so they aren't repeated here */
function seedGarments(): Map<number, { name: string; category: Category }> {
  const sql = readFileSync("supabase/seed.sql", "utf8");
  const out = new Map<number, { name: string; category: Category }>();
  for (const m of sql.matchAll(/^\s*\((\d+),\s*'([^']+)',\s*'(top|bottom|outer|one_piece)'/gm)) {
    out.set(Number(m[1]), { name: m[2], category: m[3] as Category });
  }
  return out;
}

function garmentPhoto(n: number): string {
  const raw = existsSync(RAW_DIR) ? readdirSync(RAW_DIR).find((f) => new RegExp(`^0?${n}(?!\\d)`).test(f)) : undefined;
  if (raw) return path.join(RAW_DIR, raw);
  const cutout = `public/demo/garments/${nn(n)}.webp`;
  if (existsSync(cutout)) return cutout;
  throw new Error(`No photo for garment ${n}: add photos/raw/${nn(n)}.jpg`);
}

/** A JPEG data URI, scaled down to FASHN's working size so uploads stay small */
async function dataUri(file: string): Promise<string> {
  const buf = await sharp(file).rotate().flatten({ background: "#ffffff" }).resize(864, 1296, { fit: "inside" }).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function fashn(key: string, modelImage: string, garmentImage: string, category: string): Promise<Buffer> {
  const run = await fetch(`${API}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_name: "tryon-v1.6",
      inputs: { model_image: modelImage, garment_image: garmentImage, category, mode: "quality", output_format: "png" },
    }),
  });
  const started = (await run.json()) as { id?: string; error?: unknown };
  if (!run.ok || !started.id) throw new Error(`FASHN run failed (${run.status}): ${JSON.stringify(started.error ?? started)}`);

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`${API}/status/${started.id}`, { headers: { Authorization: `Bearer ${key}` } });
    const s = (await res.json()) as { status: string; output?: string[]; error?: unknown };
    if (s.status === "completed" && s.output?.[0]) {
      // Output URLs expire after a few days: download right away
      return Buffer.from(await (await fetch(s.output[0])).arrayBuffer());
    }
    if (s.status === "failed") throw new Error(`FASHN prediction failed: ${JSON.stringify(s.error)}`);
  }
  throw new Error(`FASHN prediction ${started.id} timed out`);
}

function plan(garmentId: string, look: TryOnLook, garments: ReturnType<typeof seedGarments>) {
  const pieces = [seedNumber(garmentId), ...look.with.map(seedNumber)].map((n) => {
    const g = garments.get(n);
    if (!g) throw new Error(`Garment ${n} isn't in supabase/seed.sql`);
    return { n, ...g };
  });
  return pieces.sort((a, b) => LAYER[a.category] - LAYER[b.category]);
}

/** Where step `i` (1-based) of a look's chain is saved */
const stepFile = (out: string, i: number) => path.join(STEP_DIR, `${path.basename(out, ".webp")}-${i}.png`);

/** Crops a FASHN result to 3:4 around the person and writes the app's WebP */
async function frame(src: string, out: string): Promise<void> {
  const mask = src.replace(/\.png$/, ".mask.png");
  const run = spawnSync(python, ["scripts/remove-bg.py", "birefnet-general-lite", src, mask], { stdio: "inherit" });
  if (run.error || run.status !== 0) throw new Error(`Couldn't find the person in ${src}. Is rembg installed?`);

  const { data, info } = await sharp(mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = info.height, bottom = -1, left = info.width, right = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 24) {
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        left = Math.min(left, x); right = Math.max(right, x);
      }
    }
  }
  if (bottom < 0) throw new Error(`No person found in ${src}`);

  const pad = Math.round((bottom - top) * MARGIN);
  const height = Math.min(info.height, bottom - top + 2 * pad);
  const width = Math.min(info.width, Math.round((height * OUT.width) / OUT.height));
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
  const box = {
    left: clamp(Math.round((left + right) / 2 - width / 2), info.width - width),
    top: clamp(top - pad, info.height - height),
    width,
    height,
  };
  await sharp(src).extract(box).resize(OUT.width, OUT.height, { fit: "cover" }).webp({ quality: 82 }).toFile(out);
}

async function main() {
  const garments = seedGarments();
  const picked = (id: string, look: TryOnLook) =>
    only.length === 0 || only.some((o) => o.garment === seedNumber(id) && (!o.look || o.look === look.id));
  const jobs = STYLED_GARMENTS.flatMap((id) =>
    looksFor(id)
      .filter((look) => picked(id, look))
      .map((look) => ({ look, out: path.join("public", look.image), steps: plan(id, look, garments) })),
  );
  if (reframeOnly) {
    for (const j of jobs) {
      const last = stepFile(j.out, j.steps.length);
      if (!existsSync(last)) {
        console.log(`${j.out}: no saved FASHN result (${last}), skipping`);
        continue;
      }
      await frame(last, j.out);
      console.log(`  -> ${j.out}`);
    }
    return;
  }

  const todo = jobs.filter((j) => force || !existsSync(j.out));
  const credits = todo.reduce((sum, j) => sum + j.steps.length, 0);

  for (const j of jobs) {
    const done = !todo.includes(j);
    console.log(`${j.out}${done ? " (exists, skipping)" : ""}\n    ${j.steps.map((s) => `${s.n} ${s.name}`).join("  ->  ")}`);
  }
  console.log(`\n${todo.length} image(s), ${credits} FASHN credit(s) (about $${(credits * 0.075).toFixed(2)}).`);
  if (todo.length === 0) return;
  if (!spend) {
    console.log("Dry run. Add --yes to call FASHN and spend those credits.");
    return;
  }

  const key = process.env.FASHN_API_KEY;
  if (!key) throw new Error("Set FASHN_API_KEY in .env.local (app.fashn.ai/api).");
  if (!existsSync(MODEL_PHOTO)) throw new Error(`Add a full-body photo at ${MODEL_PHOTO}.`);
  mkdirSync(STEP_DIR, { recursive: true });
  mkdirSync("public/demo/tryon", { recursive: true });

  const model = await dataUri(MODEL_PHOTO);
  for (const j of todo) {
    let current = model;
    let result: Buffer | null = null;
    for (const [i, step] of j.steps.entries()) {
      process.stdout.write(`  ${path.basename(j.out)}: ${step.name}... `);
      result = await fashn(key, current, await dataUri(garmentPhoto(step.n)), FASHN_CATEGORY[step.category]);
      await sharp(result).toFile(stepFile(j.out, i + 1));
      current = `data:image/png;base64,${result.toString("base64")}`;
      console.log("done");
    }
    await frame(stepFile(j.out, j.steps.length), j.out);
    console.log(`  -> ${j.out}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
