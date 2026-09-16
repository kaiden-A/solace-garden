"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/api-client";
import { STAGE_LABEL } from "@/lib/categories";
import { mailtoFor } from "@/lib/mailto";
import { artOf, SPECIES, speciesOf } from "@/lib/species";
import { toast } from "@/lib/toast";
import type { PublicPlant } from "@/lib/types";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function HarvestPage() {
  const [plants, setPlants] = useState<PublicPlant[] | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [harvesting, setHarvesting] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [giving, setGiving] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch("/api/plants")
      .then((res) => res.json())
      .then((data: PublicPlant[]) => setPlants(data))
      .catch(() => setPlants([]));
  }, []);

  const now = Date.now();
  const isReady = (plant: PublicPlant) =>
    plant.stage === "fruit" || Boolean(plant.forWhom?.giveOn && plant.forWhom.giveOn <= now);

  const forSomeone = (plants ?? []).filter(
    (plant) => plant.forWhom && !plant.gift && !kept.includes(plant.id),
  );
  const ready = forSomeone.filter(isReady);
  const soon = forSomeone.filter((plant) => !isReady(plant));

  const harvest = (plant: PublicPlant) => {
    setHarvesting(plant.id);
    setTimeout(() => {
      setHarvesting(null);
      setPicked((current) => ({ ...current, [plant.id]: true }));
      toast("Harvested. It's yours to give now.");
    }, 1400);
  };

  const give = async (event: React.FormEvent, plant: PublicPlant) => {
    event.preventDefault();
    const res = await apiFetch(`/api/plants/${plant.id}/give`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, note }),
    });
    if (!res.ok) {
      toast("Couldn't wrap that gift just now.");
      return;
    }
    const updated = (await res.json()) as PublicPlant;
    const token = updated.gift?.token ?? "";
    setDone((current) => ({ ...current, [plant.id]: `${window.location.origin}/gift/${token}` }));
    setGiving(null);
    setTo("");
    setNote("");
    toast("Gift wrapped.");
  };

  const copy = (url: string) => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast("Link copied."))
      .catch(() => toast("Copy it from the box above."));
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Harvest</h1>
          <p className="sub">Pieces grown for someone — ready when their time comes.</p>
        </div>
      </div>

      <div className="grid">
        {plants && ready.length === 0 && (
          <p className="sub">
            Nothing is ready to give yet. Keep tending the plants below — their time will come.
          </p>
        )}

        {ready.map((plant) => {
          const meta = SPECIES[speciesOf(plant)];
          const url = done[plant.id];
          const isHarvesting = harvesting === plant.id;
          const isPicked = Boolean(picked[plant.id]);
          const dateArrived = Boolean(
            plant.forWhom?.giveOn && plant.forWhom.giveOn <= now && plant.stage !== "fruit",
          );
          const preview = plant.body.length > 150 ? `${plant.body.slice(0, 150)}…` : plant.body;
          return (
            <article key={plant.id} className={`card harvest-card${isHarvesting ? " harvesting" : ""}`}>
              {isHarvesting && <span className="harvest-burst" aria-hidden="true" />}
              <div className="arch">
                <div className="art harvest-art stage-fruit" style={{ "--glow": meta.glow } as CSSProperties}>
                  <img src={artOf(plant)} alt="" />
                </div>
              </div>
              <span className="chip chip-for">
                <Icon name="heart" /> For: {plant.forWhom?.name}
              </span>
              {plant.forWhom?.giveOn ? (
                <span className="chip chip-date">
                  <Icon name="calendar" /> {fmtDate(plant.forWhom.giveOn)}
                </span>
              ) : null}
              <h3>{plant.title || "Untitled"}</h3>
              <p className="preview">{isPicked ? "Your piece is ready." : preview}</p>

              {url ? (
                <div className="gift-done">
                  <p>Your gift is ready.</p>
                  <input className="copy-input" readOnly value={url} />
                  <div className="row">
                    <button className="btn btn-primary" onClick={() => copy(url)}>
                      Copy link
                    </button>
                    {plant.forWhom?.email ? (
                      <a
                        className="btn btn-ghost"
                        href={mailtoFor({ email: plant.forWhom.email, to: plant.forWhom.name, url })}
                      >
                        <Icon name="envelope" /> Email it
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : giving === plant.id ? (
                <form className="give-form" onSubmit={(event) => give(event, plant)}>
                  <input placeholder="Who is it for?" value={to} onChange={(event) => setTo(event.target.value)} autoFocus />
                  <input placeholder="Add a note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
                  <button className="btn btn-primary">Create the gift</button>
                </form>
              ) : isHarvesting ? (
                <div className="row">
                  <button className="btn btn-primary" disabled>
                    <Icon name="sparkle" /> Harvesting…
                  </button>
                </div>
              ) : isPicked ? (
                <div className="row">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setGiving(plant.id);
                      setTo(plant.forWhom?.name ?? "");
                    }}
                  >
                    <Icon name="gift" /> Give This
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setKept((current) => [...current, plant.id]);
                      toast("It stays with you.");
                    }}
                  >
                    <Icon name="heart" /> Keep It
                  </button>
                </div>
              ) : (
                <div className="row">
                  <button className="btn btn-primary" onClick={() => harvest(plant)}>
                    <Icon name="basket" /> {dateArrived ? "It's the day" : "Harvest"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setKept((current) => [...current, plant.id]);
                      toast("It stays with you.");
                    }}
                  >
                    <Icon name="heart" /> Keep It
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {soon.length > 0 && (
        <div className="soon-list">
          <h3>Still growing</h3>
          <ul>
            {soon.map((plant) => (
              <li key={plant.id}>
                <span>{plant.title || "Untitled"}</span>
                <em>
                  For {plant.forWhom?.name}
                  {plant.forWhom?.giveOn
                    ? ` · give on ${fmtDate(plant.forWhom.giveOn)}`
                    : ` · ${STAGE_LABEL[plant.stage]}`}
                </em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
