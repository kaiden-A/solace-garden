export type Category = "gratitude" | "memory" | "hope" | "anger" | "feeling";
export type Species = "peony" | "forget-me-not" | "cherry" | "rose" | "foxglove" | "wisteria";
export type Stage = "seed" | "sprout" | "flower" | "fruit" | "withered";
export type PlantStatus = "growing" | "given" | "released";

export interface PlantEvent {
  type: "planted" | "tended" | "given";
  note?: string;
  at: number;
}

export interface Gift {
  to: string;
  note: string;
  token: string;
  givenAt: number;
}

export interface ForWhom {
  name: string;
  email?: string;
  giveOn?: number;
}

export interface Plant {
  id: string;
  ownerId: string;
  title: string;
  body: string;
  category?: Category;
  species?: Species;
  status: PlantStatus;
  x: number;
  y: number;
  scale: number;
  seed: number;
  createdAt: number;
  events: PlantEvent[];
  gift: Gift | null;
  forWhom: ForWhom | null;
}

export interface PublicPlant extends Plant {
  stage: Stage;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  guest?: boolean;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  kind?: "member" | "guest";
}

export interface GiftPayload {
  title: string;
  body: string;
  species: Species;
  to: string;
  note: string;
  givenAt: number;
  forWhom: ForWhom | null;
  letters: { note: string; at: number }[];
}
