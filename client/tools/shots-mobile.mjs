import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const DIR = import.meta.dirname;
const ROOT = path.join(DIR, "..");
const OUT = path.join(ROOT, "shots", "mobile");
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const BROWSER = process.env.BROWSER_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const RESEED = process.env.RESEED !== "0";
const ALLOW_ISSUES = process.env.ALLOW_ISSUES === "1";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;

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

const DEVICES = {
  iphone14: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  android: { width: 360, height: 800, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  se320: { width: 320, height: 568, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const ROUTES = {
  full: [
    ["01-landing", "/", 1500],
    ["02-login", "/login", 1000],
    ["03-signup", "/signup", 1000],
    ["04-garden", "/garden", 4200],
    ["05-seeds", "/seeds", 4200],
    ["06-growing", "/growing", 1600],
    ["07-plant", "/plant", 1200],
    ["08-grow", "/grow", 1200],
    ["09-release", "/release", 1600],
    ["10-detail", `/plants/${firstPlant.id}`, 1800],
    ["11-harvest", "/harvest", 1800],
    ["12-gifts", "/gifts", 1800],
    ["13-gift", token ? `/gift/${token}` : null, 1800],
  ],
  medium: [
    ["01-landing", "/", 1500],
    ["04-garden", "/garden", 4200],
    ["06-growing", "/growing", 1600],
    ["07-plant", "/plant", 1200],
    ["08-grow", "/grow", 1200],
    ["10-detail", `/plants/${firstPlant.id}`, 1800],
    ["11-harvest", "/harvest", 1800],
    ["09-release", "/release", 1600],
  ],
  small: [
    ["01-landing", "/", 1500],
    ["04-garden", "/garden", 4200],
    ["07-plant", "/plant", 1200],
    ["11-harvest", "/harvest", 1800],
    ["10-detail", `/plants/${firstPlant.id}`, 1800],
  ],
  landscape: [
    ["01-landing", "/", 1500],
    ["04-garden", "/garden", 4200],
    ["09-release", "/release", 1600],
    ["10-detail", `/plants/${firstPlant.id}`, 1800],
  ],
};

const SCOPE = { iphone14: "full", android: "medium", se320: "small", landscape: "landscape" };

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: ["--hide-scrollbars", "--enable-unsafe-swiftshader", "--mute-audio"],
});

const messages = [];
const report = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const audit = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth > vw + 1;
    const clipped = (el) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true;
        p = p.parentElement;
      }
      return false;
    };
    const wide = [];
    if (overflow) {
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1 || clipped(el)) continue;
        const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
        wide.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
        if (wide.length >= 8) break;
      }
    }
    const small = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("button, a, input, select, textarea, [role='button']")) {
      if (el.closest("[aria-hidden='true']")) continue;
      const s = getComputedStyle(el);
      if (s.pointerEvents === "none" || s.visibility === "hidden" || s.display === "none") continue;
      if (el.tagName === "INPUT" && el.type === "range") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width >= 40 && r.height >= 40) continue;
      const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
      const label = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 22);
      const key = `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} ${Math.round(r.width)}x${Math.round(r.height)}${label ? ` "${label}"` : ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      small.push(key);
      if (small.length >= 12) break;
    }
    return { overflow, scrollWidth: document.documentElement.scrollWidth, vw, wide, small };
  });

const shootDevice = async (name, device) => {
  const page = await browser.newPage();
  await page.setViewport(device);
  await page.evaluateOnNewDocument(() => sessionStorage.setItem("solace.seen", "1"));

  const client = await page.createCDPSession();
  await client.send("Network.setCookie", {
    name: "solace_session",
    value: guest.id,
    domain: "localhost",
    path: "/",
  });

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "warning" || type === "error") messages.push(`[${type}] ${msg.text()}`);
  });
  page.on("pageerror", (error) => messages.push(`[pageerror] ${error.message}`));

  report[name] = [];

  for (const [label, route, waitMs] of ROUTES[SCOPE[name]]) {
    if (!route) continue;
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(waitMs);
    await page.screenshot({ path: path.join(OUT, `${name}-${label}.png`) });
    const result = await audit(page);
    report[name].push({ label, ...result });
    console.log(
      `shot ${name}-${label} (${route})${result.overflow ? ` OVERFLOW ${result.scrollWidth}>${result.vw}` : ""} targets<40: ${result.small.length}`,
    );
  }

  if (name === "iphone14") {
    const welcome = await browser.newPage();
    await welcome.setViewport(device);
    const welcomeClient = await welcome.createCDPSession();
    await welcomeClient.send("Network.setCookie", {
      name: "solace_session",
      value: guest.id,
      domain: "localhost",
      path: "/",
    });
    await welcome.goto(`${BASE}/garden`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(2600);
    await welcome.evaluate(() => sessionStorage.removeItem("solace.seen"));
    await welcome.reload({ waitUntil: "networkidle2" });
    await sleep(2000);
    await welcome.screenshot({ path: path.join(OUT, "iphone14-14-welcome.png") });
    console.log("shot iphone14-14-welcome (interaction)");
    await welcome.close();

    await page.goto(`${BASE}/garden`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(3600);
    const badge = await page.$(".zone-badge");
    if (badge) {
      await badge.click();
      await sleep(600);
      await page.screenshot({ path: path.join(OUT, "iphone14-15-section-panel.png") });
      console.log("shot iphone14-15-section-panel (interaction)");
    }
    const musicButton = await page.$('button[title="Music"]');
    if (musicButton) {
      await musicButton.click();
      await sleep(700);
      await page.screenshot({ path: path.join(OUT, "iphone14-16-music-modal.png") });
      console.log("shot iphone14-16-music-modal (interaction)");
      await page.keyboard.press("Escape");
    }

    await page.goto(`${BASE}/garden`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(3200);
    const canvas = await page.$(".garden-canvas");
    if (canvas) {
      const box = await canvas.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + Math.min(200, box.height * 0.3);
      const touchAction = await page.evaluate(() => {
        const target = document.querySelector(".garden-pixi canvas");
        return target ? getComputedStyle(target).touchAction : null;
      });
      const scrollable = await page.evaluate(
        () => document.scrollingElement.scrollHeight > window.innerHeight + 20,
      );
      const before = await page.evaluate(() => window.scrollY);
      const touch = await page.touchscreen.touchStart(x, y);
      for (let step = 1; step <= 6; step += 1) await touch.move(x, y - step * 30);
      await touch.end();
      await sleep(500);
      const after = await page.evaluate(() => window.scrollY);
      const scrollOk = after > before + 20;
      const pass = Boolean(touchAction?.includes("pan-y")) && (!scrollable || scrollOk);
      report.scrollTest = { touchAction, scrollable, before, after, scrollOk, pass };
      console.log(
        `touch-action on garden canvas: ${touchAction} | page ${scrollable ? "scrollable" : "fits viewport"} | drag before=${before} after=${after} -> ${pass ? "PASS" : "FAIL"}`,
      );
    }
  }

  await page.close();
};

for (const [name, device] of Object.entries(DEVICES)) {
  if (ONLY && !ONLY.has(name)) continue;
  await shootDevice(name, device);
}

await browser.close();

if (RESEED) {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "seed.mjs")], { stdio: "ignore" });
  console.log("reseeded clean demo data");
}

console.log("\n=== MOBILE AUDIT ===");
let overflowCount = 0;
let smallTargetCount = 0;
for (const [device, rows] of Object.entries(report)) {
  if (device === "scrollTest") continue;
  for (const row of rows) {
    if (row.overflow) overflowCount += 1;
    smallTargetCount += row.small.length;
    if (row.overflow) {
      console.log(`OVERFLOW ${device}-${row.label} (${row.scrollWidth}px > ${row.vw}px)`);
      for (const item of row.wide) console.log(`  ${item}`);
    }
    if (row.small.length) {
      console.log(`small targets ${device}-${row.label}:`);
      for (const item of row.small) console.log(`  ${item}`);
    }
  }
}
console.log(`${overflowCount} overflowing pages, ${smallTargetCount} undersized target rows`);

const unique = [...new Set(messages)];
console.log(`\nconsole warnings/errors (${unique.length} unique):`);
for (const message of unique.slice(0, 20)) console.log(`  ${message.slice(0, 160)}`);

if (report.scrollTest) {
  console.log(`\nscroll-over-canvas: ${report.scrollTest.pass ? "PASS" : "FAIL"} (touch-action ${report.scrollTest.touchAction})`);
}

if (!ALLOW_ISSUES && (overflowCount > 0 || unique.length > 0)) {
  process.exitCode = 1;
}
