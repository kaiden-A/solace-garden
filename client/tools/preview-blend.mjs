import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "shots");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const name = process.argv[2] ?? "cherry";

const variants = [
  { id: "raw", filter: "none", mask: "none" },
  { id: "crushed", filter: "contrast(1.8) brightness(0.62) saturate(0.9)", mask: "none" },
  {
    id: "crushed-masked",
    filter: "contrast(1.8) brightness(0.62) saturate(0.9)",
    mask: "linear-gradient(#000 0 0)",
  },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

for (const variant of variants) {
  await page.evaluate(
    async (source, v) => {
      document.body.innerHTML = "";
      document.body.style.cssText = "margin:0;background:#000;overflow:hidden;";

      const backdrop = document.createElement("div");
      backdrop.style.cssText =
        "position:fixed;inset:0;background:url('/assets/bg-dusk.jpg') center/cover no-repeat;";
      document.body.appendChild(backdrop);

      const shade = document.createElement("div");
      shade.style.cssText = "position:fixed;inset:0;background:rgba(10,8,24,0.4);";
      document.body.appendChild(shade);

      const video = document.createElement("video");
      video.src = source;
      video.muted = true;
      video.playsInline = true;
      video.id = "blend-video";
      const filter = v.filter === "none" ? "" : `filter:${v.filter};`;
      const mask =
        v.mask === "none"
          ? ""
          : "mask-image:radial-gradient(140% 120% at 50% 45%, #000 78%, transparent 100%);";
      video.style.cssText = `position:fixed;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:screen;${filter}${mask}opacity:0.95;`;
      document.body.appendChild(video);

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
        setTimeout(resolve, 8000);
      });
      await new Promise((resolve) => {
        video.addEventListener("seeked", resolve, { once: true });
        video.currentTime = 2;
        setTimeout(resolve, 5000);
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
    `/assets/release/${name}.mp4`,
    variant,
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.screenshot({ path: path.join(OUT, `preview-${name}-${variant.id}.png`) });
  console.log(`preview-${name}-${variant.id}.png`);
}

await browser.close();
