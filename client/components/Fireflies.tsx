import { makeFireflies } from "@/lib/fireflies";

export function Fireflies({ count = 16 }: { count?: number }) {
  const flies = makeFireflies(count);
  return (
    <div className="fireflies" aria-hidden="true">
      {flies.map((fly, i) => (
        <span
          key={i}
          className="firefly"
          style={
            {
              left: `${fly.left.toFixed(1)}%`,
              top: `${fly.top.toFixed(1)}%`,
              "--dur": `${fly.dur.toFixed(1)}s`,
              "--size": `${fly.size.toFixed(1)}px`,
              animationDelay: `${fly.delay.toFixed(1)}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
