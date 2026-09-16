"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { artOf, metaOf } from "@/lib/species";
import type { PublicPlant } from "@/lib/types";
import { Icon } from "./Icon";

export function PlantSprite({
  plant,
  index,
  onOpen,
}: {
  plant: PublicPlant;
  index: number;
  onOpen: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const meta = metaOf(plant);
  const style = {
    left: `${(plant.x * 100).toFixed(2)}%`,
    top: `${(plant.y * 100).toFixed(2)}%`,
    zIndex: Math.round(plant.y * 1000),
    "--seed": plant.seed,
    "--scale": plant.scale,
    "--delay": `${Math.min(index, 40) * 45}ms`,
    "--glow": meta.glow,
  } as CSSProperties;

  return (
    <button
      className={`plant stage-${plant.stage}`}
      style={style}
      title={plant.title || "Untitled"}
      aria-label={plant.title || "Untitled"}
      onClick={onOpen}
    >
      {broken ? (
        <span className="icon-fallback">
          <Icon name={meta.icon} />
        </span>
      ) : (
        <img src={artOf(plant)} alt="" onError={() => setBroken(true)} />
      )}
    </button>
  );
}
