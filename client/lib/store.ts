import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Category, Plant, PublicPlant, Species, User } from "./types";
import { deriveStage } from "./growth";
import { isCategory } from "./categories";
import { isSpecies } from "./species";
import placementData from "@/data/placements.json";

export type Placement = { x: number; y: number; scale: number };
const PLACEMENTS = placementData as Record<Category, Placement[]>;

const DATA_DIR = path.join(process.cwd(), "data");
const PLANTS_FILE = path.join(DATA_DIR, "plants.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function readRows<T>(file: string): T[] {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

function writeRows(file: string, rows: unknown) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}

export const newId = (prefix = "p") => `${prefix}_${crypto.randomBytes(4).toString("hex")}`;

export const publicPlant = (plant: Plant): PublicPlant => ({ ...plant, stage: deriveStage(plant) });

export function listPlants(ownerId: string): Plant[] {
  return readRows<Plant>(PLANTS_FILE).filter((p) => p.ownerId === ownerId);
}

export function getPlant(id: string): Plant | undefined {
  return readRows<Plant>(PLANTS_FILE).find((p) => p.id === id);
}

export function savePlant(updated: Plant) {
  const rows = readRows<Plant>(PLANTS_FILE);
  const index = rows.findIndex((p) => p.id === updated.id);
  if (index === -1) return;
  rows[index] = updated;
  writeRows(PLANTS_FILE, rows);
}

function place(category: Category, all: Plant[]): Placement {
  const slots = PLACEMENTS[category] ?? PLACEMENTS.feeling;
  const count = all.filter((p) => p.category === category).length;
  const slot = slots[count % slots.length];
  const jitter = count >= slots.length ? 0.035 : 0;
  return {
    x: +(slot.x + (Math.random() - 0.5) * jitter).toFixed(3),
    y: +(slot.y + (Math.random() - 0.5) * jitter).toFixed(3),
    scale: slot.scale,
  };
}

export function createPlant(
  ownerId: string,
  input: {
    title?: string;
    body: string;
    category?: string;
    species?: string;
    release?: boolean;
    forWhom?: { name?: string; email?: string; giveOn?: number | string } | null;
  },
): Plant {
  const rows = readRows<Plant>(PLANTS_FILE);
  const now = Date.now();
  const name = String(input.forWhom?.name ?? "").trim();
  const email = String(input.forWhom?.email ?? "").trim();
  const giveOn = input.forWhom?.giveOn ? new Date(input.forWhom.giveOn).getTime() : NaN;
  const isPerson = Boolean(name);

  const category: Category =
    !isPerson && input.category && isCategory(input.category) ? input.category : "feeling";
  const species: Species | undefined = isPerson
    ? input.species && isSpecies(input.species)
      ? input.species
      : "foxglove"
    : undefined;

  const plant: Plant = {
    id: newId(),
    ownerId,
    title: String(input.title ?? "").trim(),
    body: String(input.body).trim(),
    status: input.release ? "released" : "growing",
    ...place(category, rows),
    seed: Math.floor(Math.random() * 997),
    createdAt: now,
    events: [{ type: "planted", note: "Planted the seed", at: now }],
    gift: null,
    forWhom: isPerson
      ? { name, email: email || undefined, giveOn: Number.isFinite(giveOn) ? giveOn : undefined }
      : null,
  };
  if (isPerson) {
    plant.species = species;
  } else {
    plant.category = category;
  }
  rows.push(plant);
  writeRows(PLANTS_FILE, rows);
  return plant;
}

export function tendPlant(id: string, note?: string): Plant | undefined {
  const plant = getPlant(id);
  if (!plant) return undefined;
  plant.events.push({ type: "tended", note: String(note ?? "").trim() || "Tended it again", at: Date.now() });
  savePlant(plant);
  return plant;
}

export function releasePlant(id: string): Plant | undefined {
  const plant = getPlant(id);
  if (!plant) return undefined;
  plant.status = "released";
  savePlant(plant);
  return plant;
}

export function givePlant(id: string, to?: string, note?: string): Plant | undefined {
  const plant = getPlant(id);
  if (!plant) return undefined;
  const now = Date.now();
  plant.status = "given";
  plant.gift = {
    to: String(to ?? "").trim() || "Someone",
    note: String(note ?? "").trim(),
    token: newId("g"),
    givenAt: now,
  };
  plant.events.push({ type: "given", note: `Given to ${plant.gift.to}`, at: now });
  savePlant(plant);
  return plant;
}

export function findGift(token: string): Plant | undefined {
  return readRows<Plant>(PLANTS_FILE).find((p) => p.gift?.token === token);
}

export function findUserByEmail(email: string): User | undefined {
  return readRows<User>(USERS_FILE).find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return readRows<User>(USERS_FILE).find((u) => u.id === id);
}

export function createUser(input: { name: string; email: string; passwordHash: string; guest?: boolean }): User {
  const rows = readRows<User>(USERS_FILE);
  const user: User = {
    id: newId("u"),
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    guest: input.guest,
    createdAt: Date.now(),
  };
  rows.push(user);
  writeRows(USERS_FILE, rows);
  return user;
}

export function guestUser(): User | undefined {
  return readRows<User>(USERS_FILE).find((u) => u.guest);
}
