export const DAY = 86_400_000;

export const RULES = {
  sprout: 2,
  flower: 3,
  fruit: 5,
  fruitMinDays: 2,
  witherAfterDays: 14,
};

export function deriveStage(plant, now = Date.now()) {
  const events = plant.events ?? [];
  const last = events.length ? events[events.length - 1].at : plant.createdAt;
  const idleDays = (now - last) / DAY;
  const ageDays = (now - plant.createdAt) / DAY;

  if (idleDays >= RULES.witherAfterDays) return "withered";
  if (events.length >= RULES.fruit && ageDays >= RULES.fruitMinDays) return "fruit";
  if (events.length >= RULES.flower) return "flower";
  if (events.length >= RULES.sprout) return "sprout";
  return "seed";
}
