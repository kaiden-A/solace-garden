"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { PlantArt } from "@/components/PlantArt";
import { RichText, RichTextEditor } from "@/components/RichText";
import WindScene from "@/components/WindScene";
import { apiFetch } from "@/lib/api-client";
import { CATEGORIES, STAGE_LABEL } from "@/lib/categories";
import { fineFocus } from "@/lib/focus";
import { postCount } from "@/lib/plants";
import { metaOf } from "@/lib/species";
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
  const [writeOpen, setWriteOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [grew, setGrew] = useState(false);
  const [newborn, setNewborn] = useState(false);
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

  useEffect(() => {
    // Arriving from a spawn: play the sprout-in once, then drop the flag.
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    setNewborn(true);
    const clear = setTimeout(() => router.replace(`/plants/${id}`, { scroll: false }), 6000);
    const hide = setTimeout(() => setNewborn(false), 6000);
    return () => {
      clearTimeout(clear);
      clearTimeout(hide);
    };
  }, [id, router]);

  const grow = (updated: PublicPlant) => {
    setPlant(updated);
    setDraft("");
    setWriteOpen(false);
    setGrew(true);
    setTimeout(() => setGrew(false), 950);
  };

  const tend = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await apiFetch(`/api/plants/${id}/tend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: draft }),
    });
    if (!res.ok) {
      toast("Couldn't tend it just now.");
      return;
    }
    grow((await res.json()) as PublicPlant);
    toast("Saved for them.");
  };

  const addPost = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await apiFetch(`/api/plants/${id}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    if (!res.ok) {
      toast("Couldn't write that just now.");
      return;
    }
    const result = (await res.json()) as { plant: PublicPlant; spawned: PublicPlant | null };
    if (result.spawned) {
      setDraft("");
      setComposerOpen(false);
      router.push(`/plants/${result.spawned.id}?new=1`);
      return;
    }
    grow(result.plant);
    setComposerOpen(false);
    toast("It grew a little.");
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
  const isLetter = Boolean(plant.forWhom);
  const chipLabel = isLetter
    ? meta.label
    : (CATEGORIES[plant.category ?? "feeling"] ?? CATEGORIES.feeling).label;
  const last = isLetter
    ? plant.events[plant.events.length - 1]?.at ?? plant.createdAt
    : plant.posts[plant.posts.length - 1]?.at ?? plant.createdAt;

  return (
    <div className="detail-screen scene plants">
      <div className="topbar">
        <div>
          <Link className="back" href="/garden">
            ← Back
          </Link>
        </div>
        <div className="actions">
          {isLetter && (
            <Link className="btn btn-ghost" href="/harvest">
              <Icon name="basket" /> Harvest
            </Link>
          )}
        </div>
      </div>

      <div className="detail">
        <div className="card detail-card">
          {isLetter ? (
            <h1>{plant.title}</h1>
          ) : (
            <div className="thread-head">
              <h1>{chipLabel}</h1>
              <span className="chip chip-stage" key={plant.stage}>
                <Icon name={meta.icon} /> {STAGE_LABEL[plant.stage]}
              </span>
            </div>
          )}
          {isLetter && (
            <span className="chip">
              <Icon name={meta.icon} /> {STAGE_LABEL[plant.stage]} · {chipLabel}
            </span>
          )}
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
            <Icon name="sprout" /> Planted on {fmtDate(plant.createdAt)} · <Icon name="droplet" />{" "}
            {isLetter ? "Last tended" : "Last written"} {fmtDate(last)}
            {isLetter ? "" : ` · ${postCount(plant)} ${postCount(plant) === 1 ? "post" : "posts"}`}
          </p>

          {isLetter ? (
            <>
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
            </>
          ) : (
            <>
              {newborn && (
                <p className="newborn-ribbon">
                  <Icon name="sparkle" /> A new seedling began
                </p>
              )}
              {plant.stage === "withered" && (
                <p className="quiet-line">
                  This one has been quiet for a while. Write again to wake it.
                </p>
              )}

              <div className={`composer${composerOpen ? " open" : ""}`}>
                {composerOpen ? (
                  <form className="composer-form" onSubmit={addPost}>
                    <RichTextEditor
                      value={draft}
                      onChange={setDraft}
                      rows={4}
                      autoFocus
                      placeholder="What do you feel right now?"
                    />
                    <div className="composer-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setDraft("");
                          setComposerOpen(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button className="btn btn-primary">Post it</button>
                    </div>
                  </form>
                ) : (
                  <button className="composer-line" onClick={() => setComposerOpen(true)}>
                    <Icon name="droplet" /> Write what you feel…
                  </button>
                )}
              </div>

              <div className="posts">
                {plant.posts
                  .map((post, index) => ({ post, index }))
                  .reverse()
                  .map(({ post, index }) => (
                    <article className="post card" key={index}>
                      <span className="post-date">{fmtDate(post.at)}</span>
                      <RichText text={post.body} />
                    </article>
                  ))}
              </div>
            </>
          )}
        </div>

        <aside className={`detail-art${isLetter ? " letter-art" : " thread-art"}`}>
          <div
            className={`art big on-scene stage-${plant.stage}${plant.stage === "withered" ? " wilted" : ""}${
              grew ? " grew" : ""
            }${newborn ? " born" : ""}`}
            style={{ "--glow": meta.glow } as React.CSSProperties}
          >
            <PlantArt plant={plant} alt="" />
          </div>

          {isLetter && (
            <>
              <button className="btn btn-primary" onClick={() => setWriteOpen((value) => !value)}>
                <Icon name="droplet" /> Write something for them
              </button>
              {writeOpen && (
                <form className="tend-form" onSubmit={tend}>
                  <textarea
                    rows={3}
                    placeholder="What do you feel for them right now?"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    ref={fineFocus}
                  />
                  <button className="btn btn-primary">Tend it</button>
                </form>
              )}
            </>
          )}

          {!isLetter && plant.status === "growing" && (
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
    </div>
  );
}
