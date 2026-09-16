"use client";

import { useEffect, useRef, useState } from "react";
import { artOf, metaOf, speciesOf } from "@/lib/species";
import type { PublicPlant, Species } from "@/lib/types";
import { Icon } from "./Icon";
import { makeDotTexture, makePetalTexture, makeStreakTexture } from "./pixi-utils";

const CLIP_TWEAKS: Partial<Record<Species, { scale?: number; offsetY?: number }>> = {};

interface SceneApi {
  setHolding: (holding: boolean) => void;
  release: () => void;
  videoEnded: () => void;
  videoFailed: () => void;
}

export default function WindScene({ plant, onDone }: { plant: PublicPlant; onDone: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [fallback, setFallback] = useState(false);
  const species = speciesOf(plant);
  const glow = metaOf(plant).glow;
  const clipUrl = `/assets/release/${species}.mp4`;
  const tweak = CLIP_TWEAKS[species] ?? {};
  const videoStyle = {
    transform: `${tweak.scale ? `scale(${tweak.scale}) ` : ""}${
      tweak.offsetY ? `translateY(${tweak.offsetY}px)` : ""
    }`.trim() || undefined,
  };

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
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        if (disposed) {
          app.destroy(true);
          return;
        }
        host.appendChild(app.canvas);
        app.stage.sortableChildren = true;
        app.stage.alpha = 0;

        const loaded = await PIXI.Assets.load(["/assets/bg-dusk.jpg", artOf(plant)]);
        if (disposed) return;

        const scene = new PIXI.Sprite(loaded["/assets/bg-dusk.jpg"]);
        scene.anchor.set(0.5);
        scene.tint = 0x9b93b5;
        scene.zIndex = 0;
        app.stage.addChild(scene);

        const shade = new PIXI.Graphics().rect(0, 0, 10, 10).fill({ color: 0x0a0818, alpha: 0.4 });
        shade.zIndex = 1;
        app.stage.addChild(shade);

        const sprite = new PIXI.Sprite(loaded[artOf(plant)]);
        sprite.anchor.set(0.5, 1);
        sprite.zIndex = 10;
        app.stage.addChild(sprite);

        const streakTexture = makeStreakTexture(PIXI, app.renderer, 0xdfe6ff, 1.4, 26, 0.35);
        interface Gust {
          sprite: any;
          speed: number;
          bx: number;
          by: number;
        }
        const gusts: Gust[] = [];
        const gustCount = reduced ? 0 : 26;
        for (let i = 0; i < gustCount; i++) {
          const gustSprite = new PIXI.Sprite(streakTexture);
          gustSprite.rotation = 0.06;
          app.stage.addChild(gustSprite);
          gusts.push({ sprite: gustSprite, speed: 700 + Math.random() * 700, bx: Math.random(), by: Math.random() });
        }

        const petalTexture = makePetalTexture(PIXI, app.renderer, parseInt(glow.slice(1), 16), 3, 5);
        const moteTexture = makeDotTexture(PIXI, app.renderer, 0xfff0d0, 1.6, 0.9);
        interface Trail {
          sprite: any;
          vx: number;
          vy: number;
          vr: number;
          life: number;
          max: number;
        }
        const trails: Trail[] = [];

        let width = app.screen.width;
        let height = app.screen.height;
        const base = { x: width / 2, y: height * 0.8 };
        let plantScale = 1;

        const layout = () => {
          width = app.screen.width;
          height = app.screen.height;
          scene.scale.set(Math.max(width / scene.texture.width, height / scene.texture.height));
          scene.position.set(width / 2, height / 2);
          shade.clear().rect(0, 0, width, height).fill({ color: 0x0a0818, alpha: 0.4 });
          plantScale = Math.min(width * 0.2, 240) / sprite.texture.width;
          sprite.scale.set(plantScale);
          base.x = width / 2;
          base.y = height * 0.8;
          sprite.position.set(base.x, base.y);
        };
        layout();

        const spawnEmbers = () => {
          const count = reduced ? 0 : 90;
          for (let i = 0; i < count; i++) {
            const isPetal = Math.random() > 0.45;
            const trailSprite = new PIXI.Sprite(isPetal ? petalTexture : moteTexture);
            trailSprite.blendMode = isPetal ? "normal" : "add";
            trailSprite.position.set(sprite.x + (Math.random() - 0.5) * 90, sprite.y - Math.random() * 90);
            trailSprite.alpha = 0;
            trailSprite.zIndex = 20;
            app.stage.addChild(trailSprite);
            trails.push({
              sprite: trailSprite,
              vx: 60 + Math.random() * 130,
              vy: -30 - Math.random() * 90,
              vr: (Math.random() - 0.5) * 5,
              life: -i * 0.01,
              max: 1.6 + Math.random() * 1.6,
            });
          }
        };

        const spawnTrail = () => {
          const isPetal = Math.random() > 0.4;
          const trailSprite = new PIXI.Sprite(isPetal ? petalTexture : moteTexture);
          trailSprite.blendMode = isPetal ? "normal" : "add";
          trailSprite.position.set(sprite.x + (Math.random() - 0.5) * 40, sprite.y - Math.random() * 80);
          trailSprite.alpha = 0;
          trailSprite.zIndex = 20;
          app.stage.addChild(trailSprite);
          trails.push({
            sprite: trailSprite,
            vx: 60 + Math.random() * 120,
            vy: -30 - Math.random() * 60,
            vr: (Math.random() - 0.5) * 5,
            life: 0,
            max: 1.6 + Math.random() * 1.4,
          });
        };

        const liftStart = reduced ? 0.5 : 1.6;
        const liftDuration = reduced ? 1.8 : 3.4;
        let finished = false;
        let started = false;
        let elapsed = 0;
        let videoMode: "idle" | "pending" | "on" | "off" = "idle";
        let videoEndTime = 0;
        let videoBroken = false;
        let holding = false;

        const startRelease = () => {
          const video = videoRef.current;
          if (!reduced && video && !videoBroken) {
            videoMode = "pending";
            video.style.opacity = "0";
            video
              .play()
              .then(() => {
                videoMode = "on";
                video.style.opacity = "1";
              })
              .catch(() => {
                videoMode = "off";
              });
          } else {
            videoMode = "off";
          }
        };

        sceneRef.current = {
          setHolding: (value: boolean) => {
            holding = value;
          },
          release: () => {
            if (started) return;
            started = true;
            startRelease();
          },
          videoEnded: () => {
            if (videoMode !== "on") return;
            videoEndTime = elapsed;
            videoMode = "off";
            if (videoRef.current) videoRef.current.style.opacity = "0";
            spawnEmbers();
          },
          videoFailed: () => {
            videoBroken = true;
          },
        };

        app.ticker.add((ticker: any) => {
          const dt = Math.min(0.05, ticker.deltaMS / 1000);
          elapsed += dt;
          app.stage.alpha = Math.min(1, app.stage.alpha + dt * 1.8);

          if (app.screen.width !== width || app.screen.height !== height) layout();

          if (!started && elapsed > liftStart) {
            started = true;
            startRelease();
          }

          const gustFadeStart = videoEndTime ? videoEndTime + 1.2 : liftStart + 2.6;
          for (const gust of gusts) {
            gust.bx += (gust.speed * dt) / Math.max(1, width);
            if (gust.bx > 1.1) {
              gust.bx = -0.1;
              gust.by = Math.random();
            }
            const fade = elapsed < gustFadeStart ? 1 : Math.max(0, 1 - (elapsed - gustFadeStart) / 1.6);
            gust.sprite.alpha = fade * 0.5;
            gust.sprite.position.set(gust.bx * width, gust.by * height);
          }

          if (started) {
            if (videoMode === "pending") {
              sprite.rotation = Math.sin(elapsed * 1.4) * 0.03;
            } else if (videoMode === "on") {
              sprite.alpha = Math.max(0, 1 - (elapsed - liftStart) / 0.4);
              sprite.rotation = Math.sin(elapsed * 0.9) * 0.015;
            } else if (videoEndTime) {
              sprite.alpha = Math.max(0, sprite.alpha - dt * 2);
            } else {
              const k = Math.min(1, (elapsed - liftStart) / liftDuration);
              const ease = 1 - Math.pow(1 - k, 2.2);
              sprite.y = base.y - ease * height * 0.5;
              sprite.x = base.x + ease * width * 0.16;
              sprite.rotation = k * 0.55;
              sprite.alpha = 1 - Math.max(0, (k - 0.5) / 0.5);
              if (!reduced && elapsed < liftStart + liftDuration + 1.2 && Math.random() < dt * 34) {
                spawnTrail();
              }
            }
          } else {
            sprite.rotation = Math.sin(elapsed * 0.9) * 0.015;
          }

          for (let i = trails.length - 1; i >= 0; i--) {
            const trail = trails[i];
            trail.life += dt;
            if (trail.life < 0) continue;
            if (trail.life > trail.max) {
              trail.sprite.destroy();
              trails.splice(i, 1);
              continue;
            }
            trail.vy -= 14 * dt;
            trail.sprite.x += (trail.vx + Math.sin(elapsed * 2 + i) * 18) * dt;
            trail.sprite.y += trail.vy * dt;
            trail.sprite.rotation += trail.vr * dt;
            trail.sprite.alpha = Math.sin(Math.min(1, trail.life / trail.max) * Math.PI) * 0.85;
          }

          const doneAt =
            videoMode === "on" && !videoEndTime
              ? Infinity
              : videoEndTime
                ? videoEndTime + 1.4
                : liftStart + liftDuration + 0.9;
          if (!finished && (elapsed > doneAt || elapsed > 14)) {
            finished = true;
            setPhase("done");
          }
        });

        cleanup = () => {
          sceneRef.current = null;
        };
      } catch (error) {
        console.error("wind scene failed", error);
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
  }, [plant, glow]);

  useEffect(() => {
    if (!fallback) return;
    const video = videoRef.current;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (delay: number) => {
      timers.push(setTimeout(() => setPhase("done"), delay));
    };
    if (video) {
      const onEnded = () => {
        video.style.opacity = "0";
        finish(1300);
      };
      video.addEventListener("ended", onEnded);
      timers.push(
        setTimeout(() => {
          video
            .play()
            .then(() => {
              video.style.opacity = "1";
            })
            .catch(() => finish(600));
        }, 700),
      );
      return () => {
        video.removeEventListener("ended", onEnded);
        timers.forEach(clearTimeout);
      };
    }
    finish(2200);
    return () => timers.forEach(clearTimeout);
  }, [fallback]);

  return (
    <div className="wind-overlay scene">
      <div className="wind-pixi" ref={hostRef} style={{ display: fallback ? "none" : "block" }} />
      <video
        ref={videoRef}
        className="wind-video"
        style={videoStyle}
        src={clipUrl}
        muted
        playsInline
        preload="none"
        onEnded={() => sceneRef.current?.videoEnded()}
        onError={() => sceneRef.current?.videoFailed()}
      />
      {phase === "done" && (
        <div className="release-done wind-done">
          <Icon name="wind" className="icon wind-icon" />
          <h1 style={{ textShadow: `0 0 40px ${glow}` }}>The wind carried it away.</h1>
          <p className="sub">Whatever it was — good or hard — it&apos;s not yours to carry anymore.</p>
          <button className="btn btn-primary" onClick={onDone}>
            Back to your garden
          </button>
        </div>
      )}
    </div>
  );
}
