import { store, save, scatter, newId } from "./server.js";

const DAY = 86_400_000;
const now = Date.now();
const ago = (days) => now - Math.round(days * DAY);

const GARDEN = [
  ["gratitude", "Morning light on the kitchen floor", "Thank you for the small things: the quiet mornings, the second cup of coffee, the way the light lands on the floor like it has nowhere else to be.", [12, 8, 3, 1]],
  ["gratitude", "For the friend who stayed", "I'm grateful that you stayed, when I didn't know how to ask someone to stay.", [9, 6, 4, 2, 0.5]],
  ["gratitude", "A small win", "I did the hard thing today. I want to remember that I can.", [2]],

  ["memory", "The house on Cedar Street", "I can still hear the screen door. I can still smell the rain on the porch.", [30, 28]],
  ["memory", "First snowfall", "We didn't have gloves, so we used socks. It was the best day.", [6, 4, 2]],
  ["memory", "Her laugh in the kitchen", "You laughed until you cried, and the whole house felt lighter.", [8, 5, 3, 1, 0.2]],

  ["hope", "Starting the new job", "I'm nervous. But I think I'm ready.", [4, 2]],
  ["hope", "Someday, a cabin by the water", "Small rooms, big windows, a boat that leaks a little. One day.", [10, 7, 5, 3, 1]],

  ["letter", "A Letter to My Future Self", "I hope you're proud of yourself, even on the days you feel like you're not enough.", [4, 2.2, 0.6]],
  ["letter", "To my younger self", "It gets better. Not all at once, but it does. You'll want to stay.", [15, 12, 10, 8]],
  ["letter", "For mom, when she's ready", "Thank you for every dinner you ate cold so we could eat ours warm.", [7, 5, 2, 1, 0.4]],
  ["letter", "A letter I'm not sure I'll send", "There's so much I want to say, and I'm almost brave enough to say it.", [3, 1]],

  ["anger", "The thing I never said", "I was so angry that day. I'm writing it here so I don't have to carry it anymore.", [11, 9, 6, 3]],
];

store.plants = GARDEN.map(([category, title, body, offsets]) => ({
  id: newId(),
  title,
  body,
  category,
  status: "growing",
  ...scatter(category),
  seed: Math.floor(Math.random() * 997),
  createdAt: ago(Math.max(...offsets)),
  events: offsets.map((d, i) => ({
    type: i ? "tended" : "planted",
    note: i ? (i % 2 ? "Added a little more" : "Tended it again") : "Planted the seed",
    at: ago(d),
  })),
  gift: null,
}));

save();
console.log(`Seeded ${store.plants.length} demo plants into data/plants.json`);
