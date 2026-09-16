"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setBusy(false);
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

        <form className="auth-form" onSubmit={submit}>
          <input
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (4+ characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Planting…" : "Create my garden"}
          </button>
        </form>

        <p className="auth-alt">
          Already have one? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
