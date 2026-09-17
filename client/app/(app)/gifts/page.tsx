"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/api-client";
import { plantHeadline } from "@/lib/plants";
import { metaOf } from "@/lib/species";
import { mailtoFor } from "@/lib/mailto";
import { toast } from "@/lib/toast";
import type { PublicPlant } from "@/lib/types";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function GiftsPage() {
  const [plants, setPlants] = useState<PublicPlant[] | null>(null);

  useEffect(() => {
    apiFetch("/api/plants")
      .then((res) => res.json())
      .then((data: PublicPlant[]) => setPlants(data))
      .catch(() => setPlants([]));
  }, []);

  const gifts = (plants ?? []).filter((plant) => plant.gift);

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => toast("Link copied.")).catch(() => {});
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Gifts</h1>
          <p className="sub">Pieces of your garden you&apos;ve given away.</p>
        </div>
      </div>

      <div className="grid">
        {plants && gifts.length === 0 && (
          <p className="sub">Nothing given yet. When something is ready, you&apos;ll know.</p>
        )}

        {gifts.map((plant) => {
          const meta = metaOf(plant);
          const url = `${window.location.origin}/gift/${plant.gift?.token}`;
          return (
            <article key={plant.id} className="card">
              <span className="chip">
                <Icon name={meta.icon} /> For {plant.gift?.to}
              </span>
              <h3 style={{ marginTop: 10 }}>{plantHeadline(plant) || "A gift"}</h3>
              <p className="preview">Given {fmtDate(plant.gift?.givenAt ?? 0)}</p>
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
                    <Icon name="envelope" /> Email
                  </a>
                ) : null}
                <Link className="btn btn-ghost" href={`/gift/${plant.gift?.token}`}>
                  Open gift
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
