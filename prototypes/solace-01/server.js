import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { deriveStage } from "./growth.js";

const DIR = import.meta.dirname;
const DATA_FILE = path.join(DIR, "data", "plants.json");
const PORT = process.env.PORT || 3000;

export const CATEGORIES = ["gratitude", "memory", "hope", "anger", "letter", "feeling"];

export const ZONES = {
  gratitude: { x: 0.2, y: 0.6, w: 0.13, h: 0.12 },
  memory: { x: 0.02, y: 0.62, w: 0.11, h: 0.2 },
  hope: { x: 0.46, y: 0.52, w: 0.12, h: 0.1 },
  letter: { x: 0.62, y: 0.52, w: 0.14, h: 0.12 },
  anger: { x: 0.36, y: 0.74, w: 0.14, h: 0.14 },
  feeling: { x: 0.82, y: 0.48, w: 0.12, h: 0.2 },
};

export function scatter(category) {
  const z = ZONES[category] ?? ZONES.feeling;
  return {
    x: +(z.x + Math.random() * z.w).toFixed(3),
    y: +(z.y + Math.random() * z.h).toFixed(3),
  };
}

export function newId(prefix = "p") {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

let db = { plants: [] };
if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error(`plants.json is unreadable (${err.message}) — starting a fresh garden`);
  }
}

export const store = db;

export function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

const withStage = (plant, now = Date.now()) => ({ ...plant, stage: deriveStage(plant, now) });
const find = (id) => db.plants.find((p) => p.id === id);

const app = express();
app.use(express.json());
app.use(express.static(path.join(DIR, "public")));

app.get("/api/plants", (_req, res) => {
  const now = Date.now();
  res.json(db.plants.filter((p) => p.status !== "released").map((p) => withStage(p, now)));
});

app.post("/api/plants", (req, res) => {
  const { title = "", body = "", category = "feeling", release = false } = req.body ?? {};
  if (!String(body).trim()) return res.status(400).json({ error: "Write something first." });
  const safeCategory = CATEGORIES.includes(category) ? category : "feeling";
  const now = Date.now();
  const plant = {
    id: newId(),
    title: String(title).trim(),
    body: String(body).trim(),
    category: safeCategory,
    status: release ? "released" : "growing",
    ...scatter(safeCategory),
    seed: Math.floor(Math.random() * 997),
    createdAt: now,
    events: [{ type: "planted", note: "Planted the seed", at: now }],
    gift: null,
  };
  db.plants.push(plant);
  save();
  res.status(201).json(withStage(plant, now));
});

app.get("/api/plants/:id", (req, res) => {
  const plant = find(req.params.id);
  if (!plant || plant.status === "released") return res.status(404).json({ error: "Not found." });
  res.json(withStage(plant));
});

app.post("/api/plants/:id/tend", (req, res) => {
  const plant = find(req.params.id);
  if (!plant || plant.status === "released") return res.status(404).json({ error: "Not found." });
  const now = Date.now();
  const note = String(req.body?.note ?? "").trim();
  plant.events.push({ type: "tended", note: note || "Tended it again", at: now });
  save();
  res.json(withStage(plant, now));
});

app.post("/api/plants/:id/release", (req, res) => {
  const plant = find(req.params.id);
  if (!plant) return res.status(404).json({ error: "Not found." });
  plant.status = "released";
  save();
  res.json({ ok: true });
});

app.post("/api/plants/:id/give", (req, res) => {
  const plant = find(req.params.id);
  if (!plant || plant.status === "released") return res.status(404).json({ error: "Not found." });
  const now = Date.now();
  plant.status = "given";
  plant.gift = {
    to: String(req.body?.to ?? "").trim() || "Someone",
    note: String(req.body?.note ?? "").trim(),
    token: newId("g"),
    givenAt: now,
  };
  plant.events.push({ type: "given", note: `Given to ${plant.gift.to}`, at: now });
  save();
  res.json(withStage(plant, now));
});

app.get("/api/gifts/:token", (req, res) => {
  const plant = db.plants.find((p) => p.gift?.token === req.params.token);
  if (!plant) return res.status(404).json({ error: "Not found." });
  res.json({
    title: plant.title,
    body: plant.body,
    category: plant.category,
    to: plant.gift.to,
    note: plant.gift.note,
    givenAt: plant.gift.givenAt,
  });
});

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  app.listen(PORT, () => console.log(`Solace is listening on http://localhost:${PORT}`));
}

export { app };
