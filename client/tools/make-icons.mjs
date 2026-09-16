import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const DIR = import.meta.dirname;
const ROOT = path.join(DIR, "..");
const OUT = path.join(ROOT, "public", "icons");
const BROWSER = process.env.BROWSER_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const svg = fs.readFileSync(path.join(ROOT, "app", "icon.svg"), "utf8");
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();

const render = async (file, size, padding) => {
  const inner = Math.round(size * (1 - padding * 2));
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;width:100%;height:100%;background:#131120;display:grid;place-items:center}svg{width:${inner}px;height:${inner}px}</style>${svg}`,
  );
  await new Promise((resolve) => setTimeout(resolve, 120));
  await page.screenshot({ path: file });
  console.log(`wrote ${path.relative(ROOT, file)} (${size}x${size})`);
};

await render(path.join(OUT, "icon-192.png"), 192, 0.12);
await render(path.join(OUT, "icon-512.png"), 512, 0.12);
await render(path.join(OUT, "maskable-512.png"), 512, 0.22);
await render(path.join(ROOT, "app", "apple-icon.png"), 180, 0.12);

await browser.close();
