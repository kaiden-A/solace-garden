import type { Category, Species, Stage } from "./types";
import { CATEGORIES } from "./categories";

export const SPECIES: Record<Species, { label: string; slug: string; icon: string; glow: string }> = {
  peony: { label: "Peony", slug: "gratitude", icon: "sun", glow: "#ffb86b" },
  "forget-me-not": { label: "Forget-me-not", slug: "memory", icon: "moon", glow: "#8fb6ff" },
  cherry: { label: "Cherry blossom", slug: "hope", icon: "flower", glow: "#ff9ec4" },
  rose: { label: "Rose", slug: "anger", icon: "flame", glow: "#ff6b6b" },
  foxglove: { label: "Foxglove", slug: "letter", icon: "envelope", glow: "#c9a6ff" },
  wisteria: { label: "Wisteria", slug: "feeling", icon: "waves", glow: "#6fe3d4" },
};

export const SPECIES_KEYS = Object.keys(SPECIES) as Species[];

export const isSpecies = (value: string): value is Species => (SPECIES_KEYS as string[]).includes(value);

/** The three drawn stages; fruit and withered wear the bloom. */
export const artStages = ["seed", "sprout", "flower"] as const;
export type ArtStage = (typeof artStages)[number];

const ART_STAGE: Record<Stage, ArtStage> = {
  seed: "seed",
  sprout: "sprout",
  flower: "flower",
  fruit: "flower",
  withered: "flower",
};

export const artOfSpecies = (species: Species, stage: Stage = "flower") =>
  `/assets/plants/${SPECIES[species].slug}-${ART_STAGE[stage]}.png`;

export const flowerArtOf = (species: Species) => `/assets/plants/${SPECIES[species].slug}-flower.png`;

export function speciesOf(plant: { species?: Species; category?: Category | string }): Species {
  if (plant.species) return plant.species;
  if (plant.category === "letter") return "foxglove";
  if (plant.category && plant.category in CATEGORIES) {
    return CATEGORIES[plant.category as Category].species;
  }
  return "wisteria";
}

export const metaOf = (plant: { species?: Species; category?: Category | string }) => SPECIES[speciesOf(plant)];

export const artOf = (plant: { species?: Species; category?: Category | string; stage?: Stage }) =>
  artOfSpecies(speciesOf(plant), plant.stage);
