"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";

function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/garden";
  const [error, setError] = useState(params.get("error") ?? "");
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
        <h1>Welcome back</h1>
        <p className="sub">Your garden has been waiting.</p>

        <div className="auth-form">
          <a className="btn btn-primary" href={`/api/auth/login?next=${encodeURIComponent(next)}`}>
            Continue with Elysiaa SSO
          </a>
          {error && <p className="auth-error">{error}</p>}
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="btn btn-ghost" onClick={guest} disabled={busy}>
          <Icon name="leaf" /> {busy ? "Opening the gate…" : "Enter as guest"}
        </button>

        <p className="auth-alt">
          New here? <Link href="/signup">Create your garden</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
