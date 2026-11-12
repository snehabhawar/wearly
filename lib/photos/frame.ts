import sharp from "sharp";

/**
 * Frames a background-removed garment the way the app shows every garment: trimmed to the
 * garment, centered on a transparent square with a margin, as a small WebP.
 * Used by scripts/prepare-photos.ts and POST /api/garments/{id}/photo.
 */

export const FRAME = {
  /** Output is size x size */
  size: 800,
  /** Empty margin around the garment, in px */
  padding: 40,
  /** Pixels at or below this alpha count as background when trimming */
  alphaCutoff: 24,
} as const;

type Box = { left: number; top: number; width: number; height: number };

/** The smallest box holding every pixel more opaque than the cutoff, or null if none */
export async function opaqueBox(input: Buffer | string): Promise<Box | null> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > FRAME.alphaCutoff) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** The framed WebP, or null when nothing is left after background removal */
export async function frameCutout(input: Buffer | string): Promise<Buffer | null> {
  const box = await opaqueBox(input);
  if (!box) return null;
  const inner = FRAME.size - 2 * FRAME.padding;
  const garment = await sharp(input)
    .extract(box)
    .resize(inner, inner, { fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.floor((FRAME.size - garment.info.width) / 2);
  const top = Math.floor((FRAME.size - garment.info.height) / 2);
  return sharp(garment.data)
    .extend({
      left,
      right: FRAME.size - garment.info.width - left,
      top,
      bottom: FRAME.size - garment.info.height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
}
