import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = import.meta.dirname;
const DATA = path.join(DIR, "..", "data");
const placements = JSON.parse(fs.readFileSync(path.join(DATA, "placements.json"), "utf8"));

const DAY = 86_400_000;
const now = Date.now();
const ago = (days) => now - Math.round(days * DAY);
const newId = (prefix) => `${prefix}_${crypto.randomBytes(4).toString("hex")}`;

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync("solace", salt, 64).toString("hex");
const guest = {
  id: "u_guest",
  name: "Guest Gardener",
  email: "guest@solace.garden",
  passwordHash: `${salt}:${hash}`,
  guest: true,
  createdAt: ago(30),
};
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, "users.json"), JSON.stringify([guest], null, 2));

const GARDEN = [
  { category: "gratitude", title: "Morning light on the kitchen floor", body: "Thank you for the small things: the quiet mornings, the second cup of coffee, the way the light lands on the floor like it has nowhere else to be.", offsets: [12, 8, 3, 1] },
  { category: "gratitude", title: "For the friend who stayed", body: "I'm grateful that you stayed, when I didn't know how to ask someone to stay.", offsets: [9, 6, 4, 2, 0.5] },
  { category: "gratitude", title: "A small win", body: "I did the hard thing today. I want to remember that I can.", offsets: [2] },
  { category: "gratitude", title: "Rain on the roof", body: "Nothing to do, nowhere to be. Just the sound above me and a warm cup in my hands.", offsets: [5, 3, 1, 0.4, 0.1] },

  { category: "memory", title: "The house on Cedar Street", body: "I can still hear the screen door. I can still smell the rain on the porch.", offsets: [30, 28] },
  { category: "memory", title: "First snowfall", body: "We didn't have gloves, so we used socks. It was the best day.", offsets: [6, 4, 2] },
  { category: "memory", title: "Her laugh in the kitchen", body: "You laughed until you cried, and the whole house felt lighter.", offsets: [8, 5, 3, 1, 0.2] },
  { category: "memory", title: "Grandpa's workshop", body: "Sawdust, coffee, and the radio always on. He let me hold the sandpaper like it was important.", offsets: [11, 9, 7, 5] },

  { category: "hope", title: "Starting the new job", body: "I'm nervous. But I think I'm ready.", offsets: [4, 2] },
  { category: "hope", title: "Someday, a cabin by the water", body: "Small rooms, big windows, a boat that leaks a little. One day.", offsets: [10, 7, 5, 3, 1] },

  { category: "feeling", title: "A Letter to My Future Self", body: "I hope you're proud of yourself, even on the days you feel like you're not enough.", offsets: [4, 2.2, 0.6] },
  { category: "feeling", title: "To my younger self", body: "It gets better. Not all at once, but it does. You'll want to stay.", offsets: [15, 12, 10, 8] },
  { category: "feeling", title: "A letter I'm not sure I'll send", body: "There's so much I want to say, and I'm almost brave enough to say it.", offsets: [3, 1] },
  { category: "feeling", title: "To the version of me that's scared", body: "You don't have to be brave today. You just have to stay.", offsets: [2.5, 1.2, 0.3, 0.05] },

  { category: "anger", title: "The thing I never said", body: "I was so angry that day. I'm writing it here so I don't have to carry it anymore.", offsets: [11, 9, 6, 3] },

  { species: "foxglove", for: { name: "Mom", email: "", giveOn: now + 12 * DAY }, title: "For mom, when she's ready", body: "Thank you for every dinner you ate cold so we could eat ours warm.", offsets: [7, 5, 2, 1, 0.4] },
  { species: "foxglove", for: { name: "Brother", giveOn: now - 3 * DAY }, title: "For my brother, when he graduates", body: "You worked so hard for this. I'll be in the front row, ugly-crying.", offsets: [16, 13, 11, 9, 6] },
];

const counts = {};
const plants = GARDEN.map((entry) => {
  const placementKey = entry.category ?? "letter";
  const index = counts[placementKey] ?? 0;
  counts[placementKey] = index + 1;
  const slots = placements[placementKey] ?? placements.feeling;
  const slot = slots[index % slots.length];
  const forWhom = entry.for ?? null;

  const plant = {
    id: newId("p"),
    ownerId: guest.id,
    title: entry.title,
    body: entry.body,
    status: "growing",
    x: slot.x,
    y: slot.y,
    scale: slot.scale,
    seed: Math.floor(Math.random() * 997),
    createdAt: ago(Math.max(...entry.offsets)),
    events: entry.offsets.map((days, i) => ({
      type: i ? "tended" : "planted",
      note: i ? (i % 2 ? "Added a little more" : "Tended it again") : "Planted the seed",
      at: ago(days),
    })),
    gift: null,
    forWhom,
  };
  if (forWhom) {
    plant.species = entry.species;
  } else {
    plant.category = entry.category;
  }
  return plant;
});

fs.writeFileSync(path.join(DATA, "plants.json"), JSON.stringify(plants, null, 2));
console.log(`Seeded guest account (guest@solace.garden / solace) and ${plants.length} plants.`);
