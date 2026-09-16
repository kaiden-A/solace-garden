import path from "node:path";
import sharp from "sharp";

const DIR = import.meta.dirname;
const ASSETS = path.join(DIR, "..", "public", "assets");
const WIDTH = 768;

const hash = (x, y, seed) => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
};

const smoothNoise = (x, y, cell, seed) => {
  const xi = Math.floor(x / cell);
  const yi = Math.floor(y / cell);
  const xf = (x - xi * cell) / cell;
  const yf = (y - yi * cell) / cell;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};

const JOBS = [
  { src: "garden.jpg", out: "garden-wind.png", water: false },
  { src: "bg-dusk.jpg", out: "bg-dusk-wind.png", water: true },
];

for (const job of JOBS) {
  const { data, info } = await sharp(path.join(ASSETS, job.src))
    .resize(WIDTH)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const out = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.3 * r + 0.6 * g + 0.1 * b;

      const isVeg = g > r * 1.03 && g > b * 1.03 && luma > 30;
      const veg = isVeg ? Math.min(1, (luma - 30) / 70) : 0;

      let water = 0;
      if (job.water && y > height * 0.6 && b >= r - 12 && b >= g - 18 && luma > 70) {
        water = 0.5;
      }

      const broad = (smoothNoise(x, y, 26, 1) - 0.5) * 2;
      const fine = (smoothNoise(x, y * 0.55, 9, 2) - 0.5) * 2;
      const windX = broad * 0.75 + fine * 0.25;
      const windY = (smoothNoise(x, y, 34, 3) - 0.5) * 0.5;
      const ripple = (smoothNoise(x, y * 1.4, 18, 5) - 0.5) * 2;

      out[i] = Math.round(128 + windX * 78 * veg);
      out[i + 1] = Math.round(128 + windY * 78 * veg + ripple * 30 * water);
      out[i + 2] = 128;
      out[i + 3] = 255;
    }
  }

  const dest = path.join(ASSETS, job.out);
  await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  const check = await sharp(dest).raw().toBuffer({ resolveWithObject: true });
  let redMin = 255;
  let redMax = 0;
  let greenMin = 255;
  let greenMax = 0;
  for (let i = 0; i < check.data.length; i += 4) {
    if (check.data[i] < redMin) redMin = check.data[i];
    if (check.data[i] > redMax) redMax = check.data[i];
    if (check.data[i + 1] < greenMin) greenMin = check.data[i + 1];
    if (check.data[i + 1] > greenMax) greenMax = check.data[i + 1];
  }
  console.log(`${job.out}: ${width}x${height} red ${redMin}-${redMax}, green ${greenMin}-${greenMax} (128 = still)`);
}
