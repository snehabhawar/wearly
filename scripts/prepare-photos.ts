/**
 * Turns garment photos into the demo cutouts the app shows.
 *
 *   photos/raw/NN.jpg  ->  photos/cutouts/NN.png  ->  public/demo/garments/NN.webp
 *
 * NN is the hanger number (a file name must start with it: "01.jpg", "8-coat.png").
 * Step 1 removes the background with rembg (Python, scripts/remove-bg.py), cached in
 * photos/cutouts/ so only new or changed photos run the model again.
 * Step 2 trims to the garment, centers it on a square transparent canvas and saves a
 * small WebP for the app.
 *
 * Usage: pnpm photos:prepare [--force] [--model=birefnet-general-lite]
 * Needs: Python with rembg (pip install "rembg[cpu]"); set PYTHON if it isn't `python`.
 * photos/ is gitignored; only the WebP files in public/demo/garments/ are committed.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAW_DIR = "photos/raw";
const CUTOUT_DIR = "photos/cutouts";
const OUT_DIR = "public/demo/garments";
const MAX_HANGER = 24;

const CANVAS = 800; // output is CANVAS x CANVAS
const PADDING = 40; // empty margin around the garment, in px
const ALPHA_CUTOFF = 24; // pixels at or below this alpha count as background when trimming
const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?)$/i;

const args = process.argv.slice(2);
const force = args.includes("--force");
const model = args.find((a) => a.startsWith("--model="))?.slice("--model=".length) ?? "birefnet-general-lite";
const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

type Photo = { hanger: number; raw: string; cutout: string; out: string };

function findPhotos(): Photo[] {
  if (!existsSync(RAW_DIR)) {
    console.error(`No ${RAW_DIR}/ folder. Put photos there, named by hanger number (01.jpg ... 18.jpg).`);
    process.exit(1);
  }

  const photos = new Map<number, Photo>();
  for (const file of readdirSync(RAW_DIR).sort()) {
    if (!IMAGE_EXT.test(file)) continue;
    const match = /^(\d{1,2})(?!\d)/.exec(file);
    const hanger = match ? Number(match[1]) : NaN;
    if (!(hanger >= 1 && hanger <= MAX_HANGER)) {
      console.warn(`Skipping ${file}: its name must start with a hanger number from 1 to ${MAX_HANGER}.`);
      continue;
    }
    const existing = photos.get(hanger);
    if (existing) {
      console.error(`Two photos for hanger ${hanger}: ${path.basename(existing.raw)} and ${file}. Keep one.`);
      process.exit(1);
    }
    const nn = String(hanger).padStart(2, "0");
    photos.set(hanger, {
      hanger,
      raw: path.join(RAW_DIR, file),
      cutout: path.join(CUTOUT_DIR, `${nn}.png`),
      out: path.join(OUT_DIR, `${nn}.webp`),
    });
  }
  return [...photos.values()].sort((a, b) => a.hanger - b.hanger);
}

/** True when the cached cutout is missing or older than its photo. */
function needsCutout(photo: Photo): boolean {
  return force || !existsSync(photo.cutout) || statSync(photo.cutout).mtimeMs < statSync(photo.raw).mtimeMs;
}

function removeBackgrounds(photos: Photo[]): void {
  if (photos.length === 0) return;
  console.log(`Removing backgrounds from ${photos.length} photo(s) with ${model} (the first run downloads the model)...`);
  const result = spawnSync(python, ["scripts/remove-bg.py", model, ...photos.flatMap((p) => [p.raw, p.cutout])], {
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error(
      result.error
        ? `Couldn't run ${python}: ${result.error.message}. Install Python, or set PYTHON to its path.`
        : `Background removal failed. Is rembg installed? Run: ${python} -m pip install "rembg[cpu]"`,
    );
    process.exit(1);
  }
}

/** The smallest box holding every pixel more opaque than ALPHA_CUTOFF, or null if none. */
async function opaqueBox(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > ALPHA_CUTOFF) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function frame(photo: Photo): Promise<void> {
  const box = await opaqueBox(photo.cutout);
  if (!box) {
    console.warn(`  hanger ${photo.hanger}: nothing left after background removal; retake the photo on a plainer background.`);
    return;
  }
  const inner = CANVAS - 2 * PADDING;
  const garment = await sharp(photo.cutout)
    .extract(box)
    .resize(inner, inner, { fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.floor((CANVAS - garment.info.width) / 2);
  const top = Math.floor((CANVAS - garment.info.height) / 2);
  await sharp(garment.data)
    .extend({
      left,
      right: CANVAS - garment.info.width - left,
      top,
      bottom: CANVAS - garment.info.height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(photo.out);

  const kb = Math.round(statSync(photo.out).size / 1024);
  console.log(`  hanger ${photo.hanger}: ${photo.out} (${kb} KB)`);
}

async function main(): Promise<void> {
  const photos = findPhotos();
  if (photos.length === 0) {
    console.log(`No photos in ${RAW_DIR}/. Name them by hanger number, e.g. 01.jpg.`);
    return;
  }
  mkdirSync(CUTOUT_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  removeBackgrounds(photos.filter(needsCutout));

  console.log("Framing cutouts for the app...");
  for (const photo of photos) await frame(photo);
  console.log(`Done: ${photos.length} photo(s). Hangers: ${photos.map((p) => p.hanger).join(", ")}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
