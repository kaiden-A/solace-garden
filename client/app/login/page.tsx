"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { fineFocus } from "@/lib/focus";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/garden";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push(next);
    router.refresh();
  };

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

        <form className="auth-form" onSubmit={submit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            ref={fineFocus}
            autoComplete="email"
            enterKeyHint="next"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            enterKeyHint="go"
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "One moment…" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="btn btn-ghost" onClick={guest} disabled={busy}>
          <Icon name="leaf" /> Enter as guest
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
      <LoginForm />
    </Suspense>
  );
}
