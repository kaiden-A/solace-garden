"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const ACTIONS = [
  { icon: "sprout", label: "Plant Something", sub: "Write something you want to nurture.", href: "/plant" },
  { icon: "leaf", label: "Let Something Go", sub: "Write it down and throw it away.", href: "/release" },
  { icon: "flower", label: "Tend Your Garden", sub: "Return to things you've written before.", href: "/garden" },
  { icon: "basket", label: "Harvest Something", sub: "Turn something you've grown into something you can give.", href: "/harvest" },
  { icon: "gift", label: "Give Something", sub: "Send a piece of your garden to someone.", href: "/harvest" },
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("solace.seen")) setOpen(true);
  }, []);

  const close = () => {
    sessionStorage.setItem("solace.seen", "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal card">
        <button className="modal-x" onClick={close} title="Close">
          <Icon name="close" />
        </button>
        <h2>What would you like to do?</h2>
        <p className="sub">Every feeling has a place to grow.</p>
        <div className="action-grid">
          {ACTIONS.map((action) => (
            <Link key={action.label} className="action-card" href={action.href} onClick={close}>
              <span className="ac-icon">
                <Icon name={action.icon} />
              </span>
              <b>{action.label}</b>
              <small>{action.sub}</small>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
