import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = import.meta.dirname;
const RAW = path.join(DIR, "..", "raw");
const OUT = path.join(DIR, "..", "public", "assets", "plants");
const SPECIES = ["gratitude", "memory", "hope", "anger", "letter", "feeling"];

// One raw per stage. Each stage is normalised to its own solid height inside the
// 640px square, so the art itself carries the size difference between a seed, a
// seedling and a bloom; the game can then draw every stage at one width.
const STAGES = [
  { stage: "seed", raw: (s) => `${s}-seed.jpg`, solidH: 150, solidW: 300 },
  { stage: "sprout", raw: (s) => `${s}-sprout.jpg`, solidH: 320, solidW: 430 },
  { stage: "flower", raw: (s) => `${s}.jpg`, solidH: 595, solidW: 604 },
];

const SIZE = 640;
// Levels below this are JPEG noise on the black backdrop, not glow: three of the
// raws carry a faint wash (alpha 9-15) across nearly the whole canvas, and
// squaring that instead of the plant is what used to shrink those flowers.
const THRESHOLD = 24; // plant + real glow
const SOLID = 32; // the plant itself, without the halo
const GLOW_FIT = 0.988; // the glowing bbox (incl. the halo) stays inside the frame

let failures = 0;

for (const species of SPECIES) {
  for (const { stage, raw, solidH, solidW } of STAGES) {
    const name = `${species}-${stage}`;
    const src = path.join(RAW, raw(species));
    if (!fs.existsSync(src)) {
      console.log(`skip ${name.padEnd(18)} no raw (${raw(species)})`);
      continue;
    }

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

    if (full.maxX < 0 || solid.maxX < 0) {
      console.log(`FAIL ${name.padEnd(18)} empty image after keying`);
      failures++;
      continue;
    }

    const fullW = full.maxX - full.minX + 1;
    const fullH = full.maxY - full.minY + 1;
    const solidWpx = solid.maxX - solid.minX + 1;
    const solidHpx = solid.maxY - solid.minY + 1;

    // Grow the square until the solid plant is solidH tall (without getting wider
    // than solidW). The halo above the plant has to fit; the halo below it is
    // clipped, because the plant itself stands on the bottom edge.
    const topReach = solid.maxY - full.minY + 1;
    const side = Math.ceil(
      Math.max(
        (solidHpx * SIZE) / solidH,
        (solidWpx * SIZE) / solidW,
        topReach / GLOW_FIT,
        fullW / GLOW_FIT,
      ),
    );

    const square = Buffer.alloc(side * side * 4);
    const offX = Math.floor((side - fullW) / 2);
    const offY = side - 1 - (solid.maxY - full.minY);

    for (let y = full.minY; y <= full.maxY; y++) {
      const destY = offY + (y - full.minY);
      if (destY < 0 || destY >= side) continue; // the halo below the ground clips
      const from = (y * width + full.minX) * 4;
      const to = (destY * side + offX) * 4;
      keyed.copy(square, to, from, from + fullW * 4);
    }

    const dest = path.join(OUT, `${name}.png`);
    await sharp(square, { raw: { width: side, height: side, channels: 4 } })
      .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(dest);

    const check = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = check.info.width;
    const h = check.info.height;
    const alphaAt = (x, y) => check.data[(y * w + x) * 4 + 3];
    const corners = [alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)];

    let outMinX = w, outMinY = h, outMaxX = -1, outMaxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = alphaAt(x, y);
        if (a > SOLID) {
          if (x < outMinX) outMinX = x;
          if (x > outMaxX) outMaxX = x;
          if (y < outMinY) outMinY = y;
          if (y > outMaxY) outMaxY = y;
        }
      }
    }
    // Sample the middle of the plant itself - a seed sits low in the frame, so
    // the middle of the image says nothing about it.
    let coreMax = 0;
    for (let y = Math.round(outMinY + (outMaxY - outMinY) * 0.35); y <= Math.round(outMinY + (outMaxY - outMinY) * 0.65); y++) {
      for (let x = Math.round(outMinX + (outMaxX - outMinX) * 0.35); x <= Math.round(outMinX + (outMaxX - outMinX) * 0.65); x++) {
        if (alphaAt(x, y) > coreMax) coreMax = alphaAt(x, y);
      }
    }
    const solidOut = `${outMaxX - outMinX + 1}x${outMaxY - outMinY + 1}`;
    const ok =
      corners.every((a) => a === 0) &&
      coreMax > 100 &&
      outMaxY >= h - 4 &&
      outMaxX - outMinX >= 12 &&
      outMaxY - outMinY >= 40;
    const kb = Math.round(fs.statSync(dest).size / 1024);
    console.log(
      `${ok ? "ok  " : "FAIL"} ${name.padEnd(18)} solid ${solidOut.padEnd(9)} ${kb}KB  ` +
        `corners=${corners.join(",")}  coreAlpha=${coreMax}`,
    );
    if (!ok) failures++;
  }
}

if (failures) {
  console.log(`${failures} sprite(s) failed the checks`);
  process.exitCode = 1;
} else {
  console.log("all sprites transparent, healthy and normalised");
}
