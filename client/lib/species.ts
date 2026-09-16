import type { Category, Species } from "./types";
import { CATEGORIES } from "./categories";

export const SPECIES: Record<Species, { label: string; art: string; icon: string; glow: string }> = {
  peony: { label: "Peony", art: "gratitude.png", icon: "sun", glow: "#ffb86b" },
  "forget-me-not": { label: "Forget-me-not", art: "memory.png", icon: "moon", glow: "#8fb6ff" },
  cherry: { label: "Cherry blossom", art: "hope.png", icon: "flower", glow: "#ff9ec4" },
  rose: { label: "Rose", art: "anger.png", icon: "flame", glow: "#ff6b6b" },
  foxglove: { label: "Foxglove", art: "letter.png", icon: "envelope", glow: "#c9a6ff" },
  wisteria: { label: "Wisteria", art: "feeling.png", icon: "waves", glow: "#6fe3d4" },
};

export const SPECIES_KEYS = Object.keys(SPECIES) as Species[];

export const isSpecies = (value: string): value is Species => (SPECIES_KEYS as string[]).includes(value);

export const artOfSpecies = (species: Species) => `/assets/plants/${SPECIES[species].art}`;

export function speciesOf(plant: { species?: Species; category?: Category | string }): Species {
  if (plant.species) return plant.species;
  if (plant.category === "letter") return "foxglove";
  if (plant.category && plant.category in CATEGORIES) {
    return CATEGORIES[plant.category as Category].species;
  }
  return "wisteria";
}

export const metaOf = (plant: { species?: Species; category?: Category | string }) => SPECIES[speciesOf(plant)];

export const artOf = (plant: { species?: Species; category?: Category | string }) => artOfSpecies(speciesOf(plant));
