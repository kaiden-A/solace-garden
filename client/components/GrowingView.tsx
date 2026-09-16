"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { apiFetch } from "@/lib/api-client";
import { STAGE_LABEL } from "@/lib/categories";
import { artOf, SPECIES, speciesOf } from "@/lib/species";
import type { PublicPlant } from "@/lib/types";
import { Icon } from "./Icon";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function GrowingView() {
  const router = useRouter();
  const [plants, setPlants] = useState<PublicPlant[] | null>(null);

  useEffect(() => {
    apiFetch("/api/plants")
      .then((res) => res.json())
      .then((data: PublicPlant[]) => setPlants(data.filter((plant) => plant.forWhom)))
      .catch(() => setPlants([]));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Growing</h1>
          <p className="sub">Plants you&apos;re growing for someone, tended over time.</p>
        </div>
        <div className="actions">
          <Link className="btn btn-primary" href="/grow">
            <Icon name="plus" /> Grow for someone
          </Link>
        </div>
      </div>

      <div className="grid">
        {plants && plants.length === 0 && (
          <p className="sub">
            No one yet. Plant something for a person, tend it as you feel it, and give it when the time comes.
          </p>
        )}

        {(plants ?? []).map((plant) => {
          const meta = SPECIES[speciesOf(plant)];
          const last = plant.events[plant.events.length - 1]?.at ?? plant.createdAt;
          return (
            <article
              key={plant.id}
              className="card growing-card"
              onClick={() => router.push(`/plants/${plant.id}`)}
            >
              <div className="arch">
                <div
                  className={`art harvest-art stage-${plant.stage}`}
                  style={{ "--glow": meta.glow } as CSSProperties}
                >
                  <img src={artOf(plant)} alt="" loading="lazy" decoding="async" />
                </div>
              </div>
              <span className="chip chip-for">
                <Icon name="heart" /> For: {plant.forWhom?.name}
              </span>
              <h3>{plant.title || "Untitled"}</h3>
              <p className="preview">
                {meta.label} · {STAGE_LABEL[plant.stage]} · Last tended {fmtDate(last)}
              </p>
              <button className="btn btn-ghost">
                Open <Icon name="sparkle" />
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
