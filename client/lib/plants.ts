import { plainText } from "./text";
import type { Plant } from "./types";

type PlantText = Pick<Plant, "title" | "body" | "posts">;

/** The first thing worth reading on a plant: a letter's title, or its first post. */
export function plantText(plant: PlantText): string {
  if (plant.title) return plant.title;
  return plainText(plant.body.trim() || plant.posts?.[0]?.body || "");
}

export function plantHeadline(plant: PlantText, limit = 90): string {
  const text = plantText(plant);
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

export function postCount(plant: Pick<Plant, "posts">): number {
  return plant.posts?.length ?? 0;
}

/** Everything worth matching in a search, lowercased. */
export function plantHaystack(plant: Pick<Plant, "title" | "body" | "posts" | "events">): string {
  return [
    plant.title,
    plant.body,
    ...(plant.posts ?? []).map((post) => post.body),
    ...(plant.events ?? []).map((event) => event.note ?? ""),
  ]
    .join(" ")
    .toLowerCase();
}

/** When the plant was last written into (posts for feelings, notes for letters). */
export function lastWrittenAt(plant: Pick<Plant, "posts" | "events" | "createdAt">): number {
  const post = plant.posts?.[plant.posts.length - 1];
  if (post) return post.at;
  const event = plant.events?.[plant.events.length - 1];
  return event ? event.at : plant.createdAt;
}
