const ICONS: Record<string, string> = {
  sprout: "M12 21v-7|M12 14C12 10.7 9.8 9 6 9c0 3.3 2.2 5 6 5z|M12 14c0-3.3 2.2-5 6-5 0 3.3-2.2 5-6 5z",
  home: "M4 11.5 12 4l8 7.5|M6.5 10v9.5h11V10",
  seed: "M12 3.5c3.8 3.2 6 6.2 6 9.2a6 6 0 0 1-12 0c0-3 2.2-6 6-9.2z|M12 11v8",
  flower:
    "M12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z|M12 9.6V5.5|M12 14.4v4.1|M9.6 12H5.5|M14.4 12h4.1|m10.3 10.3-2.9-2.9|m13.7 13.7 2.9 2.9|m13.7 10.3 2.9-2.9|m10.3 13.7-2.9 2.9",
  leaf: "M20 4C11 4 5 9 5 16c0 2 .8 4 .8 4S11 19 14.5 15.5C18 12 20 8 20 4z|M5.8 19.2C8 13 12 9.4 16.5 7.5",
  basket: "M5 10h14l-1.6 8.5a1.5 1.5 0 0 1-1.5 1.5H8.1a1.5 1.5 0 0 1-1.5-1.5z|M8.5 10a3.5 3.5 0 0 1 7 0",
  gift: "M4 9.5h16v10.5H4z|M4 13.5h16|M12 9.5V20|M12 9.5C10.5 9.5 8 9 8 7a2 2 0 0 1 4-.7A2 2 0 0 1 16 7c0 2-2.5 2.5-4 2.5z",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M12 3v2|M12 19v2|M3 12h2|M19 12h2|M5.6 5.6 7 7|M17 17l1.4 1.4|M18.4 5.6 17 7|M7 17l-1.4 1.4",
  flame: "M12 3.5c.6 3 4.5 5.2 4.5 9a4.5 4.5 0 0 1-9 0c0-2.4 1.3-3.9 2.6-5.3.7-.7 1.5-2 1.9-3.7z",
  envelope: "M3.5 6h17v12h-17z|m4.5 7.5 7.5 5.5 7.5-5.5",
  waves: "M3 9c2.6-2.2 5.2-2.2 7.8 0s5.2 2.2 7.8 0|M3 15c2.6-2.2 5.2-2.2 7.8 0s5.2 2.2 7.8 0",
  droplet: "M12 3.5c3.4 3.9 5.5 6.6 5.5 9.4a5.5 5.5 0 0 1-11 0c0-2.8 2.1-5.5 5.5-9.4z",
  plus: "M12 5v14|M5 12h14",
  close: "M6 6l12 12|M18 6 6 18",
  sparkle: "M12 3.5 14 9.5l6 2.5-6 2.5-2 6-2-6-4-2.5 6-2.5z",
  heart: "M12 20C7.2 16.2 4.5 13.4 4.5 10.3A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.7c0 3.1-2.7 5.9-7.5 9.7z",
  logout: "M14 4h5v16h-5|M4 12h10|m9 8-4 4 4 4",
  calendar: "M4 6.5h16V20H4z|M4 10.5h16|M8 3.5v3|M16 3.5v3",
  wind: "M3 8h11a3 3 0 1 0-3-3|M3 12h15a3 3 0 1 1-3 3|M3 16h8",
  music: "M8 17V5l10-2v12|M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0z|M18 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  play: "M8 5.5 18.5 12 8 18.5z",
  pause: "M7 5.5h3.4v13H7z|M13.6 5.5H17v13h-3.6z",
  prev: "M19 5.5 9.5 12 19 18.5z|M6 5.5h2.2v13H6z",
  next: "M5 5.5 14.5 12 5 18.5z|M15.8 5.5H18v13h-2.2z",
  repeat: "m17 2 4 4-4 4|M3 11v-1a4 4 0 0 1 4-4h14|m7 22-4-4 4-4|M21 13v1a4 4 0 0 1-4 4H3",
  "repeat-one": "m17 2 4 4-4 4|M3 11v-1a4 4 0 0 1 4-4h14|m7 22-4-4 4-4|M21 13v1a4 4 0 0 1-4 4H3|M11 10h1v4",
  share: "M18 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z|M6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z|M18 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z|m8.2 11 7.6-4.2|m8.2 13 7.6 4.2",
  download: "M12 4v11|m7.5 10.5 4.5 4.5 4.5-4.5|M5 20h14",
  up: "M12 19.5V5|m6 10.5 6-6 6 6",
  down: "M12 4.5V19|m6 13.5 6 6 6-6",
  trash: "M5 7h14|M10 7V4.5h4V7|m7.5 7 1 12.5h7l1-12.5|M10 11v6|M14 11v6",
};

const FILLED = new Set(["play", "pause", "prev", "next"]);

export function Icon({ name, className = "icon" }: { name: string; className?: string }) {
  const spec = ICONS[name] ?? ICONS.leaf;
  const filled = FILLED.has(name);
  const html = spec
    .split("|")
    .map((d) => `<path d="${d}"/>`)
    .join("");
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? undefined : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
