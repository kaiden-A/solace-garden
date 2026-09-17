"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { RichTextEditor } from "@/components/RichText";
import { apiFetch } from "@/lib/api-client";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import { postCount } from "@/lib/plants";
import { artOfSpecies } from "@/lib/species";
import { toast } from "@/lib/toast";
import type { Category, PublicPlant } from "@/lib/types";

type Destination =
  | { kind: "first" }
  | { kind: "quiet"; plant: PublicPlant }
  | { kind: "full"; plant: PublicPlant }
  | { kind: "growing"; plant: PublicPlant };

export default function PlantPage() {
  const router = useRouter();
  const [plants, setPlants] = useState<PublicPlant[] | null>(null);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("gratitude");
  const [busy, setBusy] = useState(false);
  const [moment, setMoment] = useState<"idle" | "grew" | "born">("idle");

  useEffect(() => {
    fetch("/api/plants")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PublicPlant[]) => setPlants(data))
      .catch(() => setPlants([]));
  }, []);

  const label = CATEGORIES[category].label;

  const destination = useMemo<Destination | null>(() => {
    if (!plants) return null;
    const mine = plants.filter(
      (plant) => !plant.forWhom && plant.category === category && plant.status === "growing",
    );
    if (!mine.length) return { kind: "first" };
    const newest = mine.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    if (newest.stage === "fruit") return { kind: "full", plant: newest };
    if (newest.stage === "withered") return { kind: "quiet", plant: newest };
    return { kind: "growing", plant: newest };
  }, [plants, category]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) {
      toast("Write something first.");
      return;
    }
    setBusy(true);
    const res = await apiFetch(`/api/feelings/${category}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      setBusy(false);
      toast("Couldn't water that just now.");
      return;
    }
    const result = (await res.json()) as { plant: PublicPlant; spawned: PublicPlant | null };
    const target = result.spawned ?? result.plant;
    setMoment(result.spawned ? "born" : "grew");
    setTimeout(() => {
      router.push(`/plants/${target.id}${result.spawned ? "?new=1" : ""}`);
    }, 1500);
  };

  return (
    <div className="form-screen scene plants">
      <div className="form-card card">
        <h1>Water a plant</h1>
        <p className="sub">Say what you feel. It goes to your newest plant of that feeling.</p>
        <form onSubmit={submit}>
          <div className="cat-grid">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`cat-chip${category === key ? " on" : ""}`}
                onClick={() => setCategory(key)}
                disabled={moment !== "idle"}
              >
                <Icon name={CATEGORIES[key].icon} /> {CATEGORIES[key].label}
              </button>
            ))}
          </div>

          {destination && moment === "idle" && (
            <p className="dest-line" key={`${category}-${destination.kind}`}>
              {destination.kind === "first" && (
                <>
                  <Icon name="seed" /> Your first {label} seed — this will plant it.
                </>
              )}
              {destination.kind === "quiet" && (
                <>
                  <Icon name="droplet" /> Your {label} plant has been quiet — this will wake it.
                </>
              )}
              {destination.kind === "full" && (
                <>
                  <Icon name="sparkle" /> Your {label} plant has grown full — this will begin a new
                  seedling.
                </>
              )}
              {destination.kind === "growing" && (
                <>
                  <Icon name="sprout" /> Goes to your {label} plant · {postCount(destination.plant)}{" "}
                  {postCount(destination.plant) === 1 ? "post" : "posts"}
                </>
              )}
            </p>
          )}

          <RichTextEditor
            value={body}
            onChange={setBody}
            rows={7}
            autoFocus
            placeholder="What would you like to water today?"
          />
          <button className="btn btn-primary" disabled={busy || moment !== "idle"}>
            <Icon name="droplet" /> Water it
          </button>
        </form>
        <p className="hint center">
          Growing this for someone? <Link href="/grow">Grow one for them →</Link>
        </p>
      </div>
      <div className={`art form-art sample on-scene ${moment}`}>
        <img src={artOfSpecies(CATEGORIES[category].species)} alt="" />
        {moment !== "idle" && (
          <span className="art-caption">
            {moment === "born" ? "A new seedling began" : "It grew a little"}
          </span>
        )}
      </div>
    </div>
  );
}
