import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

const DIR = import.meta.dirname;
const RAW = path.join(DIR, "..", "raw");
const OUT = path.join(DIR, "..", "public", "assets", "plants");
const CATEGORIES = ["gratitude", "memory", "hope", "anger", "letter", "feeling"];
const SIZE = 640;
const THRESHOLD = 8;
const MARGIN = 1.04;

for (const category of CATEGORIES) {
  const src = path.join(RAW, `${category}.jpg`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const keyed = Buffer.alloc(width * height * 4);
  let minX = width, minY = height, maxX = -1, maxY = -1;

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
      if (a > THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) throw new Error(`${category}: empty image after keying`);

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.round(Math.max(bw, bh) * MARGIN);
  const square = Buffer.alloc(side * side * 4);
  const offX = Math.floor((side - bw) / 2);
  const offY = side - bh;

  for (let y = 0; y < bh; y++) {
    const from = ((minY + y) * width + minX) * 4;
    const to = ((offY + y) * side + offX) * 4;
    keyed.copy(square, to, from, from + bw * 4);
  }

  const dest = path.join(OUT, `${category}.png`);
  await sharp(square, { raw: { width: side, height: side, channels: 4 } })
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  const check = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => check.data[(y * check.info.width + x) * 4 + 3];
  const w = check.info.width;
  const h = check.info.height;
  const corners = [alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)];
  let coreMax = 0;
  for (let y = h * 0.3; y < h * 0.7; y += 2) {
    for (let x = w * 0.3; x < w * 0.7; x += 2) {
      const a = alphaAt(Math.round(x), Math.round(y));
      if (a > coreMax) coreMax = a;
    }
  }
  const ok = corners.every((a) => a === 0) && coreMax > 100;
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`${ok ? "ok  " : "FAIL"} ${category}.png  ${w}x${h}  ${kb}KB  corners=${corners.join(",")}  coreAlpha=${coreMax}`);
  if (!ok) process.exitCode = 1;
}

if (!process.exitCode) console.log("all sprites transparent and healthy");
