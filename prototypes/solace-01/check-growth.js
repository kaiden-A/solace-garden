import assert from "node:assert/strict";
import { deriveStage, RULES, DAY } from "./growth.js";

const now = Date.UTC(2026, 8, 16);
const plant = (ageDays, eventDaysAgo) => ({
  createdAt: now - ageDays * DAY,
  events: eventDaysAgo.map((d) => ({ type: "tended", at: now - d * DAY })),
});

assert.equal(deriveStage(plant(1, [1]), now), "seed", "fresh planting is a seed");
assert.equal(deriveStage(plant(3, [3, 1]), now), "sprout", "second tending sprouts");
assert.equal(deriveStage(plant(4, [4, 3, 2]), now), "flower", "third tending flowers");
assert.equal(deriveStage(plant(1, [1, 0.9, 0.8, 0.7, 0.6]), now), "flower", "young plant cannot fruit yet");
assert.equal(deriveStage(plant(3, [3, 2, 1, 0.9, 0.8]), now), "fruit", "five tendings + age = fruit");
assert.equal(deriveStage(plant(40, [40]), now), "withered", "untended for too long");
assert.equal(deriveStage(plant(20, [20, 15]), now), "withered", "withering overrides growth");

const revived = plant(20, [20, 19, 18, 17, 16]);
assert.equal(deriveStage(revived, now), "withered", "long idle wilts a mature plant");
revived.events.push({ type: "tended", at: now });
assert.equal(deriveStage(revived, now), "fruit", "tending revives it to its earned stage");

console.log("growth rules ok");
console.log("rules:", RULES);
