"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicPlant } from "@/lib/types";

interface Pulse {
  total: number;
  ready: number;
  seeds: number;
}

export function GardenPulse() {
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) return;
        const res = await fetch("/api/plants");
        if (!res.ok) return;
        const plants = (await res.json()) as PublicPlant[];
        const now = Date.now();
        const ready = plants.filter(
          (plant) =>
            plant.forWhom &&
            !plant.gift &&
            (plant.stage === "fruit" || Boolean(plant.forWhom.giveOn && plant.forWhom.giveOn <= now)),
        ).length;
        const seeds = plants.filter((plant) => plant.stage === "seed" || plant.stage === "sprout").length;
        if (!cancelled) setPulse({ total: plants.length, ready, seeds });
      } catch {
        /* stay on the default button */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pulse">
      {pulse ? (
        <>
          <p className="pulse-line">Welcome back.</p>
          <p className="pulse-sub">
            {pulse.total} growing · {pulse.ready} ready to give · {pulse.seeds} seeds
          </p>
          <Link className="btn btn-primary pulse-btn" href="/garden">
            Return to your garden →
          </Link>
        </>
      ) : (
        <Link className="btn btn-primary pulse-btn" href="/garden">
          Enter Your Garden →
        </Link>
      )}
    </div>
  );
}
