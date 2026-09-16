import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const DIR = import.meta.dirname;
const ROOT = path.join(DIR, "..");
const OUT = path.join(ROOT, "shots");
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const BROWSER = process.env.BROWSER_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const users = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "users.json"), "utf8"));
const guest = users.find((u) => u.guest);
const plants = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plants.json"), "utf8"));
const firstPlant = plants[0];
const letterPlant = plants.find((p) => p.forWhom) ?? plants[0];

fs.mkdirSync(OUT, { recursive: true });

const giveRes = await fetch(`${BASE}/api/plants/${letterPlant.id}/give`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: `solace_session=${guest.id}` },
  body: JSON.stringify({ to: "Mom", note: "Read it when you are ready." }),
});
const gifted = await giveRes.json();
const token = gifted?.gift?.token;

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: ["--hide-scrollbars", "--enable-unsafe-swiftshader", "--mute-audio"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => sessionStorage.setItem("solace.seen", "1"));

const client = await page.createCDPSession();
await client.send("Network.setCookie", {
  name: "solace_session",
  value: guest.id,
  domain: "localhost",
  path: "/",
});

const messages = [];
page.on("console", (msg) => {
  const type = msg.type();
  if (type === "warning" || type === "error") messages.push(`[${type}] ${msg.text()}`);
});

const shoot = async (name, route, waitMs = 2200) => {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`shot ${name} (${route})`);
};

await shoot("01-landing", "/", 1500);
await page.evaluate(() => {
  const button = document.querySelector(".home-music button[title='Music']");
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 700));
await page.screenshot({ path: path.join(OUT, "22-home-music.png") });
await page.keyboard.press("Escape");
console.log("shot 22-home-music (interaction)");
await shoot("02-login", "/login", 1000);
await shoot("03-signup", "/signup", 1000);
await shoot("04-garden", "/garden", 4200);
await shoot("05-seeds", "/seeds", 4200);
await shoot("06-growing", "/growing", 4200);
await shoot("07-plant", "/plant", 1200);
await shoot("21-grow", "/grow", 1200);
await shoot("08-release", "/release", 1400);
await shoot("09-detail", `/plants/${firstPlant.id}`, 1800);
await shoot("10-detail-for-someone", `/plants/${letterPlant.id}`, 1800);
await shoot("11-harvest", "/harvest", 1800);
await shoot("12-gifts", "/gifts", 1800);
if (token) await shoot("13-gift", `/gift/${token}`, 1800);
await shoot("14-dev-mockup", "/dev/mockup", 4200);

const withered = plants.find((p) => p.title.includes("Cedar") && !p.forWhom);
if (withered) await shoot("17-detail-withered", `/plants/${withered.id}`, 1600);

const personal = plants.find((p) => !p.forWhom);
if (personal) {
  await page.goto(`${BASE}/plants/${personal.id}`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 1600));
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Let the wind take it"),
    );
    if (!button) return false;
    button.click();
    return true;
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const point = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Hold to let go"),
    );
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  if (clicked && point) {
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await new Promise((resolve) => setTimeout(resolve, 2400));
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 2800));
    await page.screenshot({ path: path.join(OUT, "15-wind.png") });
    await new Promise((resolve) => setTimeout(resolve, 4200));
    await page.screenshot({ path: path.join(OUT, "16-wind-done.png") });
    console.log("shot 15-wind / 16-wind-done (interaction)");
  }
}

await page.goto(`${BASE}/garden`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((resolve) => setTimeout(resolve, 2400));
await page.evaluate(() => {
  const button = document.querySelector('button[title="Music"]');
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 700));
await page.screenshot({ path: path.join(OUT, "19-music-modal.png") });
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll(".music-modal .tabs button")];
  const youtube = tabs.find((tab) => tab.textContent?.includes("YouTube"));
  youtube?.click();
});
await new Promise((resolve) => setTimeout(resolve, 600));
await page.screenshot({ path: path.join(OUT, "20-music-yt.png") });
console.log("shot 19-music-modal / 20-music-yt (interaction)");

const anonContext = await browser.createBrowserContext().catch(() => null);
if (anonContext) {
  const anonPage = await anonContext.newPage();
  await anonPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await anonPage.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 2600));
  await anonPage.screenshot({ path: path.join(OUT, "18-landing-loggedout.png") }).catch(() => {});
  console.log("shot 18-landing-loggedout");
  await anonContext.close().catch(() => {});
}

await browser.close();

execFileSync(process.execPath, [path.join(ROOT, "scripts", "seed.mjs")], { stdio: "ignore" });
console.log("reseeded clean demo data");

const unique = [...new Set(messages)];
console.log(`\nconsole warnings/errors (${unique.length} unique):`);
for (const message of unique.slice(0, 20)) console.log(`  ${message.slice(0, 160)}`);
