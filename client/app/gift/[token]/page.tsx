"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { artOfSpecies, SPECIES } from "@/lib/species";
import type { GiftPayload } from "@/lib/types";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function GiftPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [gift, setGift] = useState<GiftPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/gifts/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: GiftPayload) => setGift(data))
      .catch(() => setFailed(true));
  }, [token]);

  if (failed) {
    return (
      <div className="gift-screen scene">
        <div className="gift-card card">
          <h1>This gift has drifted away.</h1>
          <p className="sub">The link may be mistyped, or the garden has moved on.</p>
          <Link className="btn btn-primary" href="/">
            Open Solace
          </Link>
        </div>
      </div>
    );
  }

  if (!gift) return <div className="gift-screen scene" />;

  const meta = SPECIES[gift.species] ?? SPECIES.foxglove;

  return (
    <div className="gift-screen scene">
      <div className="gift-card card">
        <div className="dome">
          <div className="art gift-art" style={{ "--glow": meta.glow } as React.CSSProperties}>
            <img src={artOfSpecies(gift.species)} alt="" />
          </div>
        </div>
        <h1>Someone grew this for you.</h1>
        <p className="sub">A little piece of their heart, just for you.</p>
        <div className="gift-body">
          <span className="chip">For: {gift.to}</span>
          {gift.title ? <h2>{gift.title}</h2> : null}
          <blockquote>{gift.body}</blockquote>
          {gift.note ? <p className="gift-note">{gift.note}</p> : null}
          {gift.letters.length > 0 ? (
            <div className="letter-log">
              <h3>Letters written for you</h3>
              <ul>
                {[...gift.letters].reverse().map((letter, index) => (
                  <li key={index}>
                    <span>{fmtDate(letter.at)}</span>
                    <p>{letter.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="from">
            <Icon name="sparkle" /> From: Someone who cares
          </p>
        </div>
        <Link className="btn btn-primary" href="/garden">
          Open Your Garden →
        </Link>
      </div>
    </div>
  );
}
