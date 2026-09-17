"use client";

import { useEffect, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { artOf, flowerArtOf, speciesOf } from "@/lib/species";
import type { Category, Species, Stage } from "@/lib/types";

type PlantLike = { species?: Species; category?: Category | string; stage?: Stage };

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onError"> {
  plant: PlantLike;
  alt?: string;
  /** Both the stage art and the bloom failed to load. */
  onFail?: () => void;
}

/**
 * A plant's art for its current stage (seed, sprout, bloom). Until the stage
 * files exist it quietly falls back to the bloom, so nothing ever renders broken.
 */
export function PlantArt({ plant, alt = "", onFail, ...rest }: Props) {
  const primary = artOf(plant);
  const bloom = flowerArtOf(speciesOf(plant));
  const [step, setStep] = useState(0);

  useEffect(() => setStep(0), [primary]);

  if (step > 1) return null;
  return (
    <img
      {...rest}
      src={step === 0 ? primary : bloom}
      alt={alt}
      onError={() => {
        if (step === 0) setStep(1);
        else {
          setStep(2);
          onFail?.();
        }
      }}
    />
  );
}
