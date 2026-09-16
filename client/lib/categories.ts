import type { Category, Species, Stage } from "./types";

export const CATEGORIES: Record<Category, { label: string; icon: string; glow: string; species: Species }> = {
  gratitude: { label: "Gratitude", icon: "sun", glow: "#ffb86b", species: "peony" },
  memory: { label: "Memory", icon: "moon", glow: "#8fb6ff", species: "forget-me-not" },
  hope: { label: "Hope", icon: "flower", glow: "#ff9ec4", species: "cherry" },
  anger: { label: "Anger", icon: "flame", glow: "#ff6b6b", species: "rose" },
  feeling: { label: "Feeling", icon: "waves", glow: "#6fe3d4", species: "wisteria" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const STAGE_LABEL: Record<Stage, string> = {
  seed: "Seed",
  sprout: "Sprouting",
  flower: "Growing",
  fruit: "Ready to harvest",
  withered: "Withered",
};

export const isCategory = (value: string): value is Category =>
  (CATEGORY_KEYS as string[]).includes(value);
