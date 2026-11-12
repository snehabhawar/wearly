import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FRAME, frameCutout, opaqueBox } from "./frame";

/** A transparent canvas with one opaque rectangle */
async function canvasWithBox(w: number, h: number, box: { left: number; top: number; width: number; height: number }) {
  const rect = await sharp({
    create: { width: box.width, height: box.height, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rect, left: box.left, top: box.top }])
    .png()
    .toBuffer();
}

describe("garment framing", () => {
  it("finds the opaque area", async () => {
    const img = await canvasWithBox(300, 200, { left: 50, top: 20, width: 100, height: 150 });
    expect(await opaqueBox(img)).toEqual({ left: 50, top: 20, width: 100, height: 150 });
  });

  it("returns null when nothing is left", async () => {
    const clear = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    expect(await frameCutout(clear)).toBeNull();
  });

  it("centers the garment on a square with a margin", async () => {
    const img = await canvasWithBox(300, 200, { left: 50, top: 20, width: 100, height: 150 });
    const out = await frameCutout(img);
    const meta = await sharp(out!).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([FRAME.size, FRAME.size, "webp"]);
    const box = await opaqueBox(out!);
    // Tall garment: it fills the inner height, centered horizontally
    expect(box!.height).toBeGreaterThan(FRAME.size - 2 * FRAME.padding - 4);
    expect(Math.abs(box!.left + box!.width / 2 - FRAME.size / 2)).toBeLessThan(4);
  });
});
