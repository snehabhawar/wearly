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
 *   --from=2 restarts a look's chain at step 2, on the saved result of step 1.
 *   --segment asks FASHN to remove the model's own garment first (segmentation_free: false);
 *   use it when a new top keeps the length of what the model wears (a crop top).
 * Needs: FASHN_API_KEY in .env.local, a full-body photo at photos/tryon/model.jpg,
 * and Python with rembg for the crop.
 * Docs (checked 2026-11-11): https://docs.fashn.ai/api-reference/tryon-v1-6
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { looksFor, STYLED_GARMENTS, type TryOnLook } from "../lib/demo/tryon";
import { tryOn } from "../lib/fashn";

const MODEL_PHOTO = "photos/tryon/model.jpg";
const RAW_DIR = "photos/raw";
const STEP_DIR = "photos/tryon/steps"; // every FASHN output, for checking a chain step by step
// Output frame: 3:4, cropped around the person with a margin, head to toe
const OUT = { width: 750, height: 1000 };
const MARGIN = 0.06; // of the person's height, above and below
const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

type Category = "top" | "bottom" | "outer" | "one_piece";
const FASHN_CATEGORY: Record<Category, string> = { top: "tops", bottom: "bottoms", outer: "tops", one_piece: "one-pieces" };
const LAYER: Record<Category, number> = { bottom: 0, one_piece: 0, top: 1, outer: 2 };

const args = process.argv.slice(2);
const force = args.includes("--force");
const spend = args.includes("--yes");
const reframeOnly = args.includes("--reframe");
const segment = args.includes("--segment");
const fromStep = Number(args.find((a) => a.startsWith("--from="))?.slice("--from=".length) ?? 1);
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

  // A 3:4 box around the person plus a margin, never cutting them off
  const pad = Math.round((bottom - top) * MARGIN);
  let height = bottom - top + 2 * pad;
  let width = Math.round((height * OUT.width) / OUT.height);
  if (right - left + 2 * pad > width) {
    width = right - left + 2 * pad;
    height = Math.round((width * OUT.height) / OUT.width);
  }
  // Stay inside the image when the box fits; else grow the image by mirroring its edges
  const place = (center: number, size: number, max: number) =>
    size <= max ? Math.max(0, Math.min(Math.round(center - size / 2), max - size)) : Math.round(center - size / 2);
  const boxLeft = place((left + right) / 2, width, info.width);
  const boxTop = place((top + bottom) / 2, height, info.height);
  const ext = {
    left: Math.max(0, -boxLeft),
    top: Math.max(0, -boxTop),
    right: Math.max(0, boxLeft + width - info.width),
    bottom: Math.max(0, boxTop + height - info.height),
  };
  const grown = await sharp(src).extend({ ...ext, extendWith: "mirror" }).toBuffer();
  await sharp(grown)
    .extract({ left: boxLeft + ext.left, top: boxTop + ext.top, width, height })
    .resize(OUT.width, OUT.height)
    .webp({ quality: 82 })
    .toFile(out);
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
  const startAt = (j: (typeof jobs)[number]) => Math.min(Math.max(fromStep, 1), j.steps.length);
  const credits = todo.reduce((sum, j) => sum + j.steps.length - startAt(j) + 1, 0);

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
    const start = startAt(j);
    const resume = stepFile(j.out, start - 1);
    if (start > 1 && !existsSync(resume)) throw new Error(`--from=${start} needs ${resume} from an earlier run`);
    let current = start > 1 ? `data:image/png;base64,${readFileSync(resume).toString("base64")}` : model;
    for (const [i, step] of j.steps.entries()) {
      if (i + 1 < start) continue;
      process.stdout.write(`  ${path.basename(j.out)}: ${step.name}... `);
      const result = await tryOn(key, {
        model_image: current,
        garment_image: await dataUri(garmentPhoto(step.n)),
        category: FASHN_CATEGORY[step.category],
        ...(segment && { segmentation_free: false }),
      });
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
