"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { plantHeadline } from "@/lib/plants";
import { metaOf } from "@/lib/species";
import type { PublicPlant } from "@/lib/types";
import { Icon } from "./Icon";
import { PlantArt } from "./PlantArt";

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
  const label = plantHeadline(plant, 60) || "A feeling";
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
      title={label}
      aria-label={label}
      onClick={onOpen}
    >
      {broken ? (
        <span className="icon-fallback">
          <Icon name={meta.icon} />
        </span>
      ) : (
        <PlantArt plant={plant} onFail={() => setBroken(true)} />
      )}
    </button>
  );
}
