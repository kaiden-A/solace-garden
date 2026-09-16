"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, STAGE_LABEL } from "@/lib/categories";
import { SECTIONS } from "@/lib/sections";
import { artOf } from "@/lib/species";
import type { Category, PublicPlant } from "@/lib/types";
import { Fireflies } from "./Fireflies";
import { Icon } from "./Icon";
import { PlantSprite } from "./PlantSprite";
import { WelcomeModal } from "./WelcomeModal";

const GardenCanvas = dynamic(() => import("./GardenCanvas"), { ssr: false });

type Mode = "garden" | "seeds";

const VIEWS: Record<
  Mode,
  { title: string; sub: string; empty: string; keep: (plant: PublicPlant) => boolean }
> = {
  garden: {
    title: "Your Garden",
    sub: "Everything you've grown, at every stage.",
    empty: "Your garden is quiet.",
    keep: () => true,
  },
  seeds: {
    title: "Seeds",
    sub: "A thought that just began — nothing owed yet.",
    empty: "No seeds yet. Plant something and watch it begin.",
    keep: (plant) => plant.stage === "seed" || plant.stage === "sprout",
  },
};

export function GardenView({ mode }: { mode: Mode }) {
  const view = VIEWS[mode];
  const router = useRouter();
  const [plants, setPlants] = useState<PublicPlant[] | null>(null);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plants")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: PublicPlant[]) => setPlants(data))
      .catch(() => setFailed(true));
  }, []);

  const personal = useMemo(() => (plants ?? []).filter((plant) => !plant.forWhom), [plants]);
  const others = useMemo(
    () => (plants ?? []).filter((plant) => plant.forWhom && plant.status === "growing").length,
    [plants],
  );

  const visible = useMemo(() => personal.filter(view.keep), [personal, view]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((plant) => `${plant.title} ${plant.body}`.toLowerCase().includes(q));
  }, [visible, query]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const plant of filtered) {
      const key = plant.category ?? "feeling";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [filtered]);

  const focusedPlants = useMemo(
    () => (focused ? visible.filter((plant) => (plant.category ?? "feeling") === focused) : []),
    [focused, visible],
  );

  const openPlant = (id: string) => router.push(`/plants/${id}`);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{view.title}</h1>
          <p className="sub">{view.sub}</p>
        </div>
        <div className="actions">
          <input
            className="search"
            type="search"
            placeholder="Search your garden…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Link className="btn btn-primary" href="/plant">
            <Icon name="plus" /> Plant
          </Link>
        </div>
      </div>

      <div className="garden-canvas scene garden">
        {others > 0 && (
          <Link className="others-chip" href="/growing">
            <Icon name="heart" /> {others} growing for others →
          </Link>
        )}
        {canvasFailed ? (
          <>
            <div className="vignette" />
            <Fireflies />
            {filtered.map((plant, index) => (
              <PlantSprite key={plant.id} plant={plant} index={index} onOpen={() => openPlant(plant.id)} />
            ))}
          </>
        ) : (
          <GardenCanvas
            plants={filtered}
            focused={focused}
            onSelect={openPlant}
            onFocus={setFocused}
            onFail={() => setCanvasFailed(true)}
          />
        )}

        {Object.entries(SECTIONS).map(([category, rect]) => {
          const count = counts.get(category) ?? 0;
          if (query && count === 0) return null;
          const meta = CATEGORIES[category as Category] ?? CATEGORIES.feeling;
          return (
            <button
              key={category}
              className={`zone-badge${focused === category ? " on" : ""}`}
              style={{ left: `${(rect.x + rect.w / 2) * 100}%`, top: `${(rect.y + rect.h / 2 - 0.05) * 100}%` }}
              onClick={() => setFocused(focused === category ? null : category)}
            >
              <Icon name={meta.icon} /> {meta.label}
              <b>{count}</b>
            </button>
          );
        })}

        {focused && (
          <aside className="section-panel card">
            <header>
              <span className="chip">
                <Icon name={CATEGORIES[focused as Category]?.icon ?? "leaf"} />{" "}
                {CATEGORIES[focused as Category]?.label ?? focused}
              </span>
              <button className="icon-btn" onClick={() => setFocused(null)} title="Close">
                <Icon name="close" />
              </button>
            </header>
            {focusedPlants.length ? (
              <ul>
                {focusedPlants.map((plant) => (
                  <li key={plant.id}>
                    <button onClick={() => openPlant(plant.id)}>
                      <img src={artOf(plant)} alt="" />
                      <span>
                        <b>{plant.title || "Untitled"}</b>
                        <em>{STAGE_LABEL[plant.stage]}</em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sub">Nothing here matches.</p>
            )}
          </aside>
        )}

        {plants && visible.length === 0 && (
          <div className="empty-state">
            <p>{view.empty}</p>
            <Link className="btn btn-primary" href="/plant">
              <Icon name="sprout" /> Plant something
            </Link>
          </div>
        )}
        {plants && visible.length > 0 && filtered.length === 0 && (
          <div className="empty-state">
            <p>Nothing here matches that.</p>
          </div>
        )}
        {failed && (
          <div className="empty-state">
            <p>Couldn&apos;t reach the garden.</p>
          </div>
        )}
      </div>

      {mode === "garden" && <WelcomeModal />}
    </>
  );
}
