"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { fineFocus } from "@/lib/focus";
import { flowerArtOf } from "@/lib/species";
import { toast } from "@/lib/toast";
import { Icon } from "./Icon";
import { makeDotTexture, makeRadialTexture, makeStreakTexture, makeTouchScrollable, pixiResolution, scaledCount } from "./pixi-utils";

interface SceneApi {
  setHolding: (holding: boolean) => void;
  release: () => void;
}

function fallbackEmbers() {
  const overlay = document.createElement("div");
  overlay.className = "release-overlay";
  for (let i = 0; i < 36; i++) {
    const ember = document.createElement("span");
    ember.className = "ember";
    const size = 3 + Math.random() * 5;
    ember.style.left = `${38 + Math.random() * 24}%`;
    ember.style.bottom = `${8 + Math.random() * 24}%`;
    ember.style.width = `${size}px`;
    ember.style.height = `${size}px`;
    ember.style.background = Math.random() > 0.4 ? "#ffc07a" : "#ffe4b0";
    ember.style.animationDelay = `${Math.random() * 0.8}s`;
    ember.style.animationDuration = `${2 + Math.random() * 2}s`;
    overlay.appendChild(ember);
  }
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 5200);
}

export default function ReleaseScene() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"form" | "releasing" | "done">("form");
  const [fallback, setFallback] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let app: any = null;
    let cleanup: (() => void) | null = null;

    const boot = async () => {
      try {
        const PIXI = await import("pixi.js");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        app = new PIXI.Application();
        await app.init({
          antialias: true,
          backgroundAlpha: 0,
          resizeTo: host,
          autoDensity: true,
          resolution: pixiResolution(),
        });
        if (disposed) {
          app.destroy(true);
          return;
        }
        host.appendChild(app.canvas);
        makeTouchScrollable(app);
        app.stage.sortableChildren = true;
        app.stage.alpha = 0;

        const loaded = await PIXI.Assets.load([
          "/assets/bg-rain.jpg",
          "/assets/bg-dusk.jpg",
          flowerArtOf("rose"),
        ]);
        if (disposed) return;

        const rain = new PIXI.Sprite(loaded["/assets/bg-rain.jpg"]);
        rain.anchor.set(0.5);
        app.stage.addChild(rain);

        const dusk = new PIXI.Sprite(loaded["/assets/bg-dusk.jpg"]);
        dusk.anchor.set(0.5);
        dusk.alpha = 0;
        dusk.zIndex = 500;
        app.stage.addChild(dusk);

        const glowTexture = makeRadialTexture(PIXI, [
          [0, "rgba(255, 160, 120, 0.45)"],
          [1, "rgba(255, 160, 120, 0)"],
        ]);
        const glow = new PIXI.Sprite(glowTexture);
        glow.anchor.set(0.5, 0.62);
        glow.blendMode = "add";
        glow.zIndex = 99;
        app.stage.addChild(glow);

        const plant = new PIXI.Sprite(loaded[flowerArtOf("rose")]);
        plant.anchor.set(0.5, 1);
        plant.zIndex = 100;
        app.stage.addChild(plant);

        const streakTexture = makeStreakTexture(PIXI, app.renderer, 0xcfd8ff, 1.6, 16, 0.5);
        interface Drop {
          sprite: any;
          speed: number;
          bx: number;
          by: number;
        }
        const drops: Drop[] = [];
        const dropCount = reduced ? 24 : scaledCount(80, app.screen.width, app.screen.height);
        for (let i = 0; i < dropCount; i++) {
          const sprite = new PIXI.Sprite(streakTexture);
          sprite.alpha = 0.3 + Math.random() * 0.3;
          sprite.rotation = 0.1;
          app.stage.addChild(sprite);
          drops.push({ sprite, speed: 480 + Math.random() * 420, bx: Math.random(), by: Math.random() });
        }

        const emberTextures = [
          makeDotTexture(PIXI, app.renderer, 0xffc07a, 2.2),
          makeDotTexture(PIXI, app.renderer, 0xffe4b0, 1.6),
          makeDotTexture(PIXI, app.renderer, 0x9a8fb0, 1.8),
        ];
        interface Ember {
          sprite: any;
          vx: number;
          vy: number;
          life: number;
          max: number;
        }
        const embers: Ember[] = [];

        let holding = false;
        let releasing = false;
        let releaseTime = 0;
        let elapsed = 0;

        const layout = () => {
          const width = app.screen.width;
          const height = app.screen.height;
          rain.scale.set(Math.max(width / rain.texture.width, height / rain.texture.height));
          rain.position.set(width / 2, height / 2);
          dusk.scale.set(Math.max(width / dusk.texture.width, height / dusk.texture.height));
          dusk.position.set(width / 2, height / 2);
          const plantScale = Math.min(width * 0.22, 300) / plant.texture.width;
          plant.scale.set(plantScale);
          plant.position.set(width * 0.72, height * 0.84);
          glow.scale.set(plantScale * 1.3);
          glow.position.set(width * 0.72, height * 0.82);
        };
        layout();

        const spawnEmbers = () => {
          const cx = app.screen.width * 0.72;
          const cy = app.screen.height * 0.8;
          const count = reduced ? 30 : scaledCount(130, app.screen.width, app.screen.height);
          for (let i = 0; i < count; i++) {
            const sprite = new PIXI.Sprite(emberTextures[i % emberTextures.length]);
            sprite.blendMode = "add";
            sprite.position.set(cx + (Math.random() - 0.5) * 90, cy + (Math.random() - 0.5) * 80);
            sprite.alpha = 0;
            sprite.zIndex = 200;
            app.stage.addChild(sprite);
            embers.push({
              sprite,
              vx: (Math.random() - 0.5) * 60,
              vy: -(40 + Math.random() * 90),
              life: -i * 0.012,
              max: 2.6 + Math.random() * 1.6,
            });
          }
        };

        sceneRef.current = {
          setHolding: (value: boolean) => {
            holding = value;
          },
          release: () => {
            if (releasing) return;
            releasing = true;
            releaseTime = elapsed;
            spawnEmbers();
          },
        };

        let lastWidth = app.screen.width;
        let lastHeight = app.screen.height;

        app.ticker.add((ticker: any) => {
          const dt = Math.min(0.05, ticker.deltaMS / 1000);
          elapsed += dt;
          app.stage.alpha = Math.min(1, app.stage.alpha + dt * 1.6);

          if (app.screen.width !== lastWidth || app.screen.height !== lastHeight) {
            lastWidth = app.screen.width;
            lastHeight = app.screen.height;
            layout();
          }

          const tremble = holding ? 0.05 : 0.012;
          plant.rotation = Math.sin(elapsed * (holding ? 24 : 0.8)) * tremble;
          const targetGlow = releasing ? 0 : holding ? 0.85 : 0.4;
          glow.alpha += (targetGlow - glow.alpha) * 0.08;

          if (releasing) {
            const t = elapsed - releaseTime;
            plant.alpha = Math.max(0, 1 - t / 1.4);
            plant.scale.set(plant.scale.x * (1 + dt * 0.06));
            rain.alpha = Math.max(0, 1 - t / 2.2);
            dusk.alpha = Math.min(1, Math.max(0, (t - 0.6) / 3));
          }

          for (const drop of drops) {
            drop.by += (drop.speed * dt) / Math.max(1, app.screen.height);
            if (drop.by > 1.05) {
              drop.by = -0.05;
              drop.bx = Math.random();
            }
            if (rain.alpha > 0.02) {
              drop.sprite.visible = true;
              drop.sprite.alpha = rain.alpha * (0.3 + (drop.speed % 100) / 400);
              drop.sprite.position.set(
                drop.bx * app.screen.width + Math.sin(elapsed + drop.bx * 10) * 8,
                drop.by * app.screen.height,
              );
            } else {
              drop.sprite.visible = false;
            }
          }

          for (let i = embers.length - 1; i >= 0; i--) {
            const ember = embers[i];
            ember.life += dt;
            if (ember.life < 0) continue;
            if (ember.life > ember.max) {
              ember.sprite.destroy();
              embers.splice(i, 1);
              continue;
            }
            const progress = ember.life / ember.max;
            ember.vy -= 8 * dt;
            ember.sprite.x += (ember.vx + Math.sin(elapsed * 2 + i) * 12) * dt;
            ember.sprite.y += ember.vy * dt;
            ember.sprite.alpha = Math.sin(Math.min(1, progress) * Math.PI) * 0.9;
          }
        });

        cleanup = () => {
          sceneRef.current = null;
        };
      } catch (error) {
        console.error("release scene failed", error);
        if (!disposed) setFallback(true);
      }
    };
    void boot();

    return () => {
      disposed = true;
      try {
        cleanup?.();
        app?.destroy(true, { children: true, texture: false });
      } catch {
        /* ignore */
      }
      app = null;
    };
  }, []);

  const beginRelease = async () => {
    if (startedRef.current) return;
    if (!text.trim()) {
      toast("Write something first.");
      return;
    }
    startedRef.current = true;
    setPhase("releasing");
    sceneRef.current?.setHolding(false);
    sceneRef.current?.release();
    if (fallback) fallbackEmbers();

    await apiFetch("/api/plants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: text, category: "anger", release: true }),
    }).catch(() => {});

    setTimeout(() => setPhase("done"), 2300);
    setTimeout(() => router.push("/garden"), 10000);
  };

  const holdStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (phase !== "form") return;
    event.currentTarget.classList.add("holding");
    sceneRef.current?.setHolding(true);
  };

  const holdEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove("holding");
    sceneRef.current?.setHolding(false);
  };

  return (
    <div className="release-stage scene rain">
      <div className="release-pixi" ref={hostRef} style={{ display: fallback ? "none" : "block" }} />
      <div className="release-ui">
        {phase === "form" && (
          <div className="form-card card release-card">
            <h1>Let Something Go</h1>
            <p className="sub">Write it out. Then watch it go.</p>
            <textarea
              rows={7}
              placeholder="What do you want to release?"
              value={text}
              onChange={(event) => setText(event.target.value)}
              ref={fineFocus}
            />
            <button
              type="button"
              className="btn btn-ghost hold-btn"
              onPointerDown={holdStart}
              onPointerUp={holdEnd}
              onPointerLeave={holdEnd}
              onPointerCancel={holdEnd}
              onAnimationEnd={beginRelease}
            >
              <span className="hold-fill" aria-hidden="true" />
              <Icon name="leaf" /> Hold to release
            </button>
            <p className="hint">Press and hold until it&apos;s gone.</p>
          </div>
        )}

        {phase === "done" && (
          <div className="release-done">
            <h1>You let it go.</h1>
            <p className="sub">Whatever it was, it&apos;s lighter now.</p>
            <button className="btn btn-primary" onClick={() => router.push("/garden")}>
              Back to your garden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
