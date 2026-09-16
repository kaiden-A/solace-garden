"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/api-client";
import { fineFocus } from "@/lib/focus";
import { artOfSpecies, SPECIES, SPECIES_KEYS } from "@/lib/species";
import { toast } from "@/lib/toast";
import type { Species } from "@/lib/types";

export default function GrowPage() {
  const router = useRouter();
  const [species, setSpecies] = useState<Species>("foxglove");
  const [forName, setForName] = useState("");
  const [forEmail, setForEmail] = useState("");
  const [giveOn, setGiveOn] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!forName.trim()) {
      toast("Who is this for?");
      return;
    }
    if (!body.trim()) {
      toast("Write something first.");
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/plants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        species,
        forWhom: { name: forName, email: forEmail, giveOn: giveOn || undefined },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Couldn't plant that just now.");
      return;
    }
    const plant = (await res.json()) as { id: string };
    router.push(`/plants/${plant.id}`);
    toast("Planted for them. Tend it over time.");
  };

  return (
    <div className="form-screen">
      <div className="form-card card">
        <h1>Grow for Someone</h1>
        <p className="sub">Pick a plant, tend it over time, and give it when their time comes.</p>
        <form onSubmit={submit}>
          <input
            placeholder="Who is it for?"
            value={forName}
            onChange={(event) => setForName(event.target.value)}
            ref={fineFocus}
            autoComplete="name"
            enterKeyHint="next"
          />
          <div className="for-fields">
            <input
              type="email"
              placeholder="Their email (optional)"
              value={forEmail}
              onChange={(event) => setForEmail(event.target.value)}
              autoComplete="email"
              enterKeyHint="next"
            />
            <label className="date-field">
              <span>
                <Icon name="calendar" /> Give on (optional)
              </span>
              <input type="date" value={giveOn} onChange={(event) => setGiveOn(event.target.value)} />
            </label>
          </div>
          <div className="cat-grid">
            {SPECIES_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`cat-chip${species === key ? " on" : ""}`}
                onClick={() => setSpecies(key)}
              >
                <Icon name="flower" /> {SPECIES[key].label}
              </button>
            ))}
          </div>
          <textarea
            rows={6}
            placeholder={
              forName.trim() ? `What do you want to say to ${forName.trim()}?` : "What do you want to say?"
            }
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <input
            placeholder="Add a title (optional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            enterKeyHint="done"
          />
          <button className="btn btn-primary" disabled={busy}>
            <Icon name="sprout" /> Plant it for them
          </button>
        </form>
        <p className="hint center">
          Just for yourself? <Link href="/plant">Plant something →</Link>
        </p>
      </div>
      <div className="art form-art sample">
        <img src={artOfSpecies(species)} alt="" />
      </div>
    </div>
  );
}
