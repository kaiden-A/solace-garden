"use client";

import { useEffect, useRef, useState } from "react";
import { registerToastListener } from "@/lib/toast";

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    registerToastListener((next) => {
      setMessage(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), 2600);
    });
    return () => registerToastListener(null);
  }, []);

  return (
    <div className={`toast${message ? " show" : ""}`} aria-live="polite">
      {message}
    </div>
  );
}
