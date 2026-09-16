"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import WindScene from "@/components/WindScene";
import { apiFetch } from "@/lib/api-client";
import { CATEGORIES, STAGE_LABEL } from "@/lib/categories";
import { fineFocus } from "@/lib/focus";
import { artOf, metaOf } from "@/lib/species";
import { toast } from "@/lib/toast";
import type { PublicPlant } from "@/lib/types";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function PlantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [plant, setPlant] = useState<PublicPlant | null>(null);
  const [failed, setFailed] = useState(false);
  const [tendOpen, setTendOpen] = useState(false);
  const [note, setNote] = useState("");
  const [grew, setGrew] = useState(false);
  const [windConfirm, setWindConfirm] = useState(false);
  const [windOpen, setWindOpen] = useState(false);

  useEffect(() => {
    apiFetch(`/api/plants/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: PublicPlant) => setPlant(data))
      .catch(() => setFailed(true));
  }, [id]);

  const tend = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await apiFetch(`/api/plants/${id}/tend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) {
      toast("Couldn't tend it just now.");
      return;
    }
    const updated = (await res.json()) as PublicPlant;
    setPlant(updated);
    setNote("");
    setTendOpen(false);
    setGrew(true);
    setTimeout(() => setGrew(false), 950);
    toast(plant?.forWhom ? "Saved for them." : "It grew a little.");
  };

  const beginWind = async () => {
    if (windOpen) return;
    setWindOpen(true);
    await apiFetch(`/api/plants/${id}/release`, { method: "POST" }).catch(() => {});
  };

  if (failed) {
    return (
      <>
        <div className="topbar">
          <div>
            <Link className="back" href="/garden">
              ← Back
            </Link>
          </div>
        </div>
        <div className="empty-state">
          <p>This one has drifted away.</p>
          <Link className="btn btn-primary" href="/garden">
            Back to the garden
          </Link>
        </div>
      </>
    );
  }

  if (!plant) {
    return (
      <>
        <div className="topbar">
          <div>
            <Link className="back" href="/garden">
              ← Back
            </Link>
          </div>
        </div>
      </>
    );
  }

  const meta = metaOf(plant);
  const chipLabel = plant.forWhom
    ? meta.label
    : (CATEGORIES[plant.category ?? "feeling"] ?? CATEGORIES.feeling).label;
  const last = plant.events[plant.events.length - 1]?.at ?? plant.createdAt;

  return (
    <>
      <div className="topbar">
        <div>
          <Link className="back" href="/garden">
            ← Back
          </Link>
        </div>
        <div className="actions">
          {plant.forWhom && (
            <Link className="btn btn-ghost" href="/harvest">
              <Icon name="basket" /> Harvest
            </Link>
          )}
        </div>
      </div>

      <div className="detail">
        <div className="card detail-card">
          <h1>{plant.title || "Untitled"}</h1>
          <span className="chip">
            <Icon name={meta.icon} /> {STAGE_LABEL[plant.stage]} · {chipLabel}
          </span>
          {plant.forWhom && (
            <span className="chip chip-for">
              <Icon name="heart" /> For: {plant.forWhom.name}
            </span>
          )}
          {plant.forWhom?.giveOn ? (
            <span className="chip chip-date">
              <Icon name="calendar" /> Give on {fmtDate(plant.forWhom.giveOn)}
            </span>
          ) : null}
          <p className="meta">
            <Icon name="sprout" /> Planted on {fmtDate(plant.createdAt)} · <Icon name="droplet" /> Last tended{" "}
            {fmtDate(last)}
          </p>
          <blockquote>{plant.body}</blockquote>

          <div className="log card">
            <h3>Growth Log</h3>
            <ul>
              {[...plant.events].reverse().map((event, index) => (
                <li key={index}>
                  <span>{fmtDate(event.at)}</span>
                  <span>{event.note || "Tended it again"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="detail-art">
          <div
            className={`art big stage-${plant.stage}${plant.stage === "withered" ? " wilted" : ""}${
              grew ? " grew" : ""
            }`}
            style={{ "--glow": meta.glow } as React.CSSProperties}
          >
            <img src={artOf(plant)} alt="" />
          </div>
          <button className="btn btn-primary" onClick={() => setTendOpen((value) => !value)}>
            <Icon name="droplet" /> {plant.forWhom ? "Write something for them" : "Add More"}
          </button>
          {tendOpen && (
            <form className="tend-form" onSubmit={tend}>
              <textarea
                rows={3}
                placeholder={plant.forWhom ? "What do you feel for them right now?" : "What changed since last time?"}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                ref={fineFocus}
              />
              <button className="btn btn-primary">Tend it</button>
            </form>
          )}
          {!plant.forWhom && plant.stage === "withered" && (
            <p className="quiet-hint">
              This one&apos;s been quiet for a while. Tend it back, or let the wind take it.
            </p>
          )}
          {!plant.forWhom && plant.status === "growing" && (
            <div className="let-wind">
              {windConfirm ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost hold-btn"
                    onPointerDown={(event) => event.currentTarget.classList.add("holding")}
                    onPointerUp={(event) => event.currentTarget.classList.remove("holding")}
                    onPointerLeave={(event) => event.currentTarget.classList.remove("holding")}
                    onPointerCancel={(event) => event.currentTarget.classList.remove("holding")}
                    onAnimationEnd={beginWind}
                  >
                    <span className="hold-fill" aria-hidden="true" />
                    <Icon name="wind" /> Hold to let go
                  </button>
                  <p className="hint">This can&apos;t be undone.</p>
                </>
              ) : (
                <button className="btn btn-ghost danger" onClick={() => setWindConfirm(true)}>
                  <Icon name="wind" /> Let the wind take it
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {windOpen && plant && <WindScene plant={plant} onDone={() => router.push("/garden")} />}
    </>
  );
}
