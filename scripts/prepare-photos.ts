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
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { frameCutout } from "../lib/photos/frame";

const RAW_DIR = "photos/raw";
const CUTOUT_DIR = "photos/cutouts";
const OUT_DIR = "public/demo/garments";
const MAX_HANGER = 24;

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

async function frame(photo: Photo): Promise<void> {
  const framed = await frameCutout(photo.cutout);
  if (!framed) {
    console.warn(`  hanger ${photo.hanger}: nothing left after background removal; retake the photo on a plainer background.`);
    return;
  }
  writeFileSync(photo.out, framed);
  const kb = Math.round(framed.length / 1024);
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
