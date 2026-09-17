// Scene-plate preview: signs in a throwaway guest and screenshots the big
// single-plant views so the environment panel can be judged at real sizes.
//
//   node tools/shots-scene.mjs                        # 1423x735, 1440x900, 390x844
//   node tools/shots-scene.mjs 1423x735 1024x768
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const DIR = import.meta.dirname;
const ROOT = path.join(DIR, "..");
const OUT = path.join(ROOT, "shots", "scene-preview");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const BROWSER =
  process.env.BROWSER_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const sizes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["1423x735", "1440x900", "390x844"];

const guest = await fetch(`${BASE}/api/auth/guest`, { method: "POST" });
const pair = (guest.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(";")[0])
  .find((c) => c.startsWith("solace_session="));
if (!pair) throw new Error(`guest sign-in failed (${guest.status})`);
const [cookieName, cookieValue] = pair.split("=");

const plants = await (await fetch(`${BASE}/api/plants`, { headers: { cookie: pair } })).json();
const pick = (category) =>
  plants.find((p) => p.category === category && p.stage === "flower") ??
  plants.find((p) => p.category === category);
const gratitude = pick("gratitude");
const hope = pick("hope");
const memory = pick("memory");
const anger = pick("anger");
console.log(
  `guest ok; gratitude="${gratitude?.title}" (${gratitude?.stage}), hope="${hope?.title}", ` +
    `memory="${memory?.title}", anger="${anger?.title}"`,
);

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: ["--hide-scrollbars", "--enable-unsafe-swiftshader", "--mute-audio"],
});

for (const size of sizes) {
  const [width, height] = size.split("x").map(Number);
  const dir = path.join(OUT, size);
  fs.mkdirSync(dir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => sessionStorage.setItem("solace.seen", "1"));
  const cdp = await page.createCDPSession();
  await cdp.send("Network.setCookie", {
    name: cookieName,
    value: cookieValue,
    domain: "localhost",
    path: "/",
  });

  const shoot = async (name, route, waitMs = 1800) => {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, waitMs));
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    console.log(`  ${size}/${name}.png`);
  };

  await shoot("01-detail-gratitude", `/plants/${gratitude.id}`, 2200);
  if (width < 900) {
    // on phones the art sits below the card, so check the panel there too
    await page.evaluate(() => {
      document.querySelector(".detail-art")?.scrollIntoView({ block: "end" });
      const view = document.querySelector(".view");
      if (view) view.scrollTop = view.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: path.join(dir, "01b-detail-gratitude-bottom.png") });
    console.log(`  ${size}/01b-detail-gratitude-bottom.png`);
  }
  if (hope) await shoot("02-detail-hope", `/plants/${hope.id}`, 2200);
  if (memory) await shoot("05-detail-memory", `/plants/${memory.id}`, 2200);
  if (anger) await shoot("06-detail-anger", `/plants/${anger.id}`, 2200);
  await shoot("03-composer-gratitude", "/plant", 1500);
  // the composer scrolls on short windows: the painting must stay put
  await page.evaluate(() => {
    const view = document.querySelector(".view");
    if (view) view.scrollTop = 260;
  });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(dir, "03b-composer-scrolled.png") });
  console.log(`  ${size}/03b-composer-scrolled.png`);
  await shoot("04-grow", "/grow", 1500);
  await shoot("07-garden", "/garden", 4200);
  await shoot("08-growing", "/growing", 2000);
  await page.close();
}

await browser.close();
console.log(`shots in ${OUT}`);
