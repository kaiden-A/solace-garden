import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "shots");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const name = process.argv[2] ?? "cherry";
const times = [0.05, 0.5, 1, 2, 3, 4.5];

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

const src = `/assets/release/${name}.mp4`;
const meta = await page.evaluate(async (source) => {
  const video = document.createElement("video");
  video.src = source;
  video.muted = true;
  video.playsInline = true;
  video.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;z-index:9999;";
  video.id = "inspect-video";
  document.body.appendChild(video);
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("failed to load video"));
    setTimeout(() => reject(new Error("metadata timeout")), 20000);
  });
  await new Promise((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = 0.001;
  });
  return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
}, src);

console.log(`clip: ${name}.mp4  ${meta.width}x${meta.height}  ${meta.duration.toFixed(2)}s`);
console.log(`size: ${Math.round(fs.statSync(path.join(ROOT, "public", "assets", "release", `${name}.mp4`)).size / 1024)}KB`);

for (const time of times) {
  const seek = Math.min(time, Math.max(0.05, meta.duration - 0.05));
  await page.evaluate(async (target) => {
    const video = document.getElementById("inspect-video");
    if (!video) return;
    await new Promise((resolve) => {
      const done = () => resolve();
      video.addEventListener("seeked", done, { once: true });
      video.currentTime = target;
      setTimeout(done, 4000);
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, seek);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const element = await page.$("#inspect-video");
  if (!element) continue;
  const file = path.join(OUT, `clip-${name}-${String(time).replace(".", "_")}s.png`);
  await element.screenshot({ path: file });
  console.log(`frame @ ${seek.toFixed(2)}s -> ${path.basename(file)}`);
}

await browser.close();
