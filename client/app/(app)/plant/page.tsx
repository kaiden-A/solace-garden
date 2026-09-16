"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/api-client";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import { artOfSpecies } from "@/lib/species";
import { toast } from "@/lib/toast";
import type { Category } from "@/lib/types";

export default function PlantPage() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("gratitude");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) {
      toast("Write something first.");
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/plants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, category }),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Couldn't plant that just now.");
      return;
    }
    const plant = (await res.json()) as { id: string };
    router.push(`/plants/${plant.id}`);
    toast("Planted. Take care of it.");
  };

  return (
    <div className="form-screen">
      <div className="form-card card">
        <h1>Plant Something</h1>
        <p className="sub">Write what&apos;s in your heart. Let it take root.</p>
        <form onSubmit={submit}>
          <div className="cat-grid">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`cat-chip${category === key ? " on" : ""}`}
                onClick={() => setCategory(key)}
              >
                <Icon name={CATEGORIES[key].icon} /> {CATEGORIES[key].label}
              </button>
            ))}
          </div>
          <textarea
            rows={7}
            placeholder="What would you like to plant today?"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            autoFocus
          />
          <input
            placeholder="Add a title (optional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="btn btn-primary" disabled={busy}>
            <Icon name="sprout" /> Plant
          </button>
        </form>
        <p className="hint center">
          Growing this for someone? <Link href="/grow">Grow one for them →</Link>
        </p>
      </div>
      <div className="art form-art sample">
        <img src={artOfSpecies(CATEGORIES[category].species)} alt="" />
      </div>
    </div>
  );
}
