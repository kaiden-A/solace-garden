import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = import.meta.dirname;
const RAW = path.join(DIR, "..", "raw");
const OUT = path.join(DIR, "..", "public", "assets", "plants");
const CATEGORIES = ["gratitude", "memory", "hope", "anger", "letter", "feeling"];
const SIZE = 640;
// Levels below this are JPEG noise on the black backdrop, not glow: three of the
// raws carry a faint wash (alpha 9-15) across nearly the whole canvas, and
// squaring that instead of the plant is what used to shrink those flowers.
const THRESHOLD = 24; // plant + real glow
const SOLID = 32; // the plant itself, without the halo
// every flower's solid part should land at this height in the 640px output, so no
// view has to scale one species against another
const TARGET_SOLID_H = 595;
const MAX_SOLID_W = 604;
const GLOW_FIT = 0.988; // the glowing bbox (incl. the halo) stays inside the frame

for (const category of CATEGORIES) {
  const src = path.join(RAW, `${category}.jpg`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const keyed = Buffer.alloc(width * height * 4);

  const box = () => ({ minX: width, minY: height, maxX: -1, maxY: -1 });
  const grow = (b, x, y) => {
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
  };
  const full = box();
  const solid = box();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const a = Math.max(r, g, b);
      if (a > 0) {
        keyed[i] = Math.min(255, Math.round((r * 255) / a));
        keyed[i + 1] = Math.min(255, Math.round((g * 255) / a));
        keyed[i + 2] = Math.min(255, Math.round((b * 255) / a));
        keyed[i + 3] = a;
      }
      if (a > THRESHOLD) grow(full, x, y);
      if (a > SOLID) grow(solid, x, y);
    }
  }

  if (full.maxX < 0 || solid.maxX < 0) throw new Error(`${category}: empty image after keying`);

  const fullW = full.maxX - full.minX + 1;
  const fullH = full.maxY - full.minY + 1;
  const solidW = solid.maxX - solid.minX + 1;
  const solidH = solid.maxY - solid.minY + 1;

  // Grow the square until the solid plant is TARGET_SOLID_H tall (without getting
  // wider than MAX_SOLID_W) and the glow still fits.
  const side = Math.ceil(
    Math.max(
      (solidH * SIZE) / TARGET_SOLID_H,
      (solidW * SIZE) / MAX_SOLID_W,
      fullH / GLOW_FIT,
      fullW / GLOW_FIT,
    ),
  );

  const square = Buffer.alloc(side * side * 4);
  const offX = Math.floor((side - fullW) / 2);
  const offY = side - fullH; // the plant stands on the bottom edge of the frame

  for (let y = 0; y < fullH; y++) {
    const from = ((full.minY + y) * width + full.minX) * 4;
    const to = ((offY + y) * side + offX) * 4;
    keyed.copy(square, to, from, from + fullW * 4);
  }

  const dest = path.join(OUT, `${category}.png`);
  await sharp(square, { raw: { width: side, height: side, channels: 4 } })
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  const check = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = check.info.width;
  const h = check.info.height;
  const alphaAt = (x, y) => check.data[(y * w + x) * 4 + 3];
  const corners = [alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)];

  let outMinX = w, outMinY = h, outMaxX = -1, outMaxY = -1, coreMax = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alphaAt(x, y);
      if (a > SOLID) {
        if (x < outMinX) outMinX = x;
        if (x > outMaxX) outMaxX = x;
        if (y < outMinY) outMinY = y;
        if (y > outMaxY) outMaxY = y;
      }
      if (x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7 && a > coreMax) coreMax = a;
    }
  }
  const solidOut = `${outMaxX - outMinX + 1}x${outMaxY - outMinY + 1}`;
  const ok = corners.every((a) => a === 0) && coreMax > 100 && outMaxY >= h - 4;
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(
    `${ok ? "ok  " : "FAIL"} ${category.padEnd(10)} solid ${solidOut.padEnd(9)} ${kb}KB  ` +
      `corners=${corners.join(",")}  coreAlpha=${coreMax}`,
  );
  if (!ok) process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(`all sprites transparent, healthy and normalised (solid height ~${TARGET_SOLID_H}px)`);
}
