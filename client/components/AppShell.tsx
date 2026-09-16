"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicUser } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Icon } from "./Icon";
import { MusicMini } from "./Music";
import { Toaster } from "./Toaster";

const NAV = [
  { route: "garden", label: "Garden", icon: "sprout" },
  { route: "seeds", label: "Seeds", icon: "seed" },
  { route: "growing", label: "Growing", icon: "flower" },
  { route: "release", label: "Let go", icon: "leaf" },
  { route: "harvest", label: "Harvest", icon: "basket" },
  { route: "gifts", label: "Gifts", icon: "gift" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.split("/")[1] ?? "";
  const [me, setMe] = useState<PublicUser | null>(null);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe)
      .catch(() => {});
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast("You stepped out of the garden.");
    window.location.href = "/login";
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Icon name="sprout" /> <span>Solace</span>
        </Link>
        <nav className="side-nav">
          <Link href="/">
            <Icon name="home" /> Home
          </Link>
          {NAV.map((item) => (
            <Link key={item.route} className={active === item.route ? "on" : ""} href={`/${item.route}`}>
              <Icon name={item.icon} /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          {me && (
            <div className="user-row">
              <span className="avatar">{me.name.slice(0, 1).toUpperCase()}</span>
              <span className="user-name">{me.name}</span>
              <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out">
                <Icon name="logout" />
              </button>
            </div>
          )}
          {me?.kind === "guest" && (
            <Link
              href="/signup"
              style={{ display: "block", margin: "6px 2px 10px", fontSize: 12, opacity: 0.75 }}
            >
              Sign in to keep this garden →
            </Link>
          )}
          <MusicMini />
        </div>
      </aside>
      <main className="main">
        <div className="view" key={pathname}>
          {children}
        </div>
      </main>
      <nav className="tabbar" aria-label="Primary">
        {NAV.map((item) => (
          <Link key={item.route} className={active === item.route ? "on" : ""} href={`/${item.route}`}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <Toaster />
    </div>
  );
}
