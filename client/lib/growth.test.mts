import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveStage, DAY } from "./growth.ts";

const now = Date.UTC(2026, 8, 16);
const plant = (ageDays: number, eventDaysAgo: number[]) => ({
  createdAt: now - ageDays * DAY,
  events: eventDaysAgo.map((d) => ({ type: "tended" as const, at: now - d * DAY })),
});

test("fresh planting is a seed", () => {
  assert.equal(deriveStage(plant(1, [1]), now), "seed");
});

test("second tending sprouts, third flowers", () => {
  assert.equal(deriveStage(plant(3, [3, 1]), now), "sprout");
  assert.equal(deriveStage(plant(4, [4, 3, 2]), now), "flower");
});

test("fruit needs tendings and age", () => {
  assert.equal(deriveStage(plant(1, [1, 0.9, 0.8, 0.7, 0.6]), now), "flower");
  assert.equal(deriveStage(plant(3, [3, 2, 1, 0.9, 0.8]), now), "fruit");
});

test("neglect withers, tending revives to the earned stage", () => {
  assert.equal(deriveStage(plant(40, [40]), now), "withered");
  const revived = plant(20, [20, 19, 18, 17, 16]);
  assert.equal(deriveStage(revived, now), "withered");
  revived.events.push({ type: "tended", at: now });
  assert.equal(deriveStage(revived, now), "fruit");
});
