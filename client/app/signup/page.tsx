"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const guest = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/guest", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push("/garden");
    router.refresh();
  };

  return (
    <div className="auth-screen scene">
      <div className="auth-card card">
        <Link className="auth-brand" href="/">
          <Icon name="sprout" /> Solace
        </Link>
        <h1>Begin your garden</h1>
        <p className="sub">A quiet place that&apos;s only yours.</p>

        <div className="auth-form">
          <a className="btn btn-primary" href="/api/auth/signup?next=/garden">
            Create your garden with Elysiaa
          </a>
          {error && <p className="auth-error">{error}</p>}
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="btn btn-ghost" onClick={guest} disabled={busy}>
          <Icon name="leaf" /> {busy ? "Opening the gate…" : "Look around as guest"}
        </button>

        <p className="auth-alt">
          Already have one? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
