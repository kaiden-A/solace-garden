import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = import.meta.dirname;
const ROOT = path.join(DIR, "..");
const SRC = path.join(ROOT, "public", "assets", "plants");
const OUT = path.join(ROOT, "public", "video-frames");

const SPECIES = [
  { id: "peony", file: "gratitude.png" },
  { id: "forget-me-not", file: "memory.png" },
  { id: "cherry", file: "hope.png" },
  { id: "rose", file: "anger.png" },
  { id: "foxglove", file: "letter.png" },
  { id: "wisteria", file: "feeling.png" },
];

const WIDTH = 1920;
const HEIGHT = 1080;
const PLANT_HEIGHT = 0.78;
const BASE_Y = 0.92;

fs.mkdirSync(OUT, { recursive: true });

for (const species of SPECIES) {
  const source = path.join(SRC, species.file);
  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) throw new Error(`cannot read ${species.file}`);

  const targetHeight = Math.round(HEIGHT * PLANT_HEIGHT);
  const targetWidth = Math.round((meta.width / meta.height) * targetHeight);
  const resized = await sharp(source).resize(targetWidth, targetHeight).png().toBuffer();

  const left = Math.round(WIDTH / 2 - targetWidth / 2);
  const top = Math.round(HEIGHT * BASE_Y - targetHeight);

  const dest = path.join(OUT, `${species.id}.jpg`);
  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .jpeg({ quality: 92 })
    .toFile(dest);

  const bytes = fs.statSync(dest).size;
  console.log(`${species.id}.jpg  ${WIDTH}x${HEIGHT}  plant ${targetWidth}x${targetHeight} at (${left}, ${top})  ${Math.round(bytes / 1024)}KB`);
}

console.log("\nUpload these as the FIRST FRAME in your image-to-video tool (16:9 mode!).");
console.log("The plant fills most of the frame on purpose — the app scales the clip down to match.");
console.log("Prompts and settings: tools/wind-clip-prompts.md");
