"use client";

import { useEffect, useRef } from "react";
import { artOf, artOfSpecies, metaOf, SPECIES_KEYS } from "@/lib/species";
import { SECTIONS } from "@/lib/sections";
import type { PublicPlant } from "@/lib/types";
import { isCoarsePointer, makeDotTexture, makeRadialTexture, makeTouchScrollable, pixiResolution, scaledCount } from "./pixi-utils";

interface GardenCanvasProps {
  plants: PublicPlant[];
  focused: string | null;
  onSelect: (id: string) => void;
  onFocus: (category: string | null) => void;
  onFail: () => void;
}

interface Entry {
  sprite: any;
  glow: any;
  plant: PublicPlant;
  alive: number;
  phase: number;
  hovered: boolean;
  pressed: boolean;
  hitArea: any;
}

interface Particle {
  sprite: any;
  speed: number;
  phase: number;
  amp: number;
  rot: number;
  bx?: number;
  by?: number;
}

const STAGE_WIDTH: Record<string, number> = { seed: 18, sprout: 38, flower: 108, fruit: 124, withered: 84 };

export default function GardenCanvas({ plants, focused, onSelect, onFocus, onFail }: GardenCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const syncRef = useRef<((list: PublicPlant[], focused: string | null) => void) | null>(null);
  const propsRef = useRef({ onSelect, onFocus, onFail });
  propsRef.current = { onSelect, onFocus, onFail };

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
        const coarse = isCoarsePointer();
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
          "/assets/garden.jpg",
          "/assets/garden-wind.png",
          ...SPECIES_KEYS.map(artOfSpecies),
        ]);
        if (disposed) return;

        const scene = new PIXI.Sprite(loaded["/assets/garden.jpg"]);
        scene.anchor.set(0.5);
        scene.eventMode = "static";
        scene.on("pointertap", () => propsRef.current.onFocus(null));
        app.stage.addChild(scene);

        const windSprite = new PIXI.Sprite(loaded["/assets/garden-wind.png"]);
        windSprite.anchor.set(0.5);
        app.stage.addChild(windSprite);
        scene.filters = [new PIXI.DisplacementFilter({ sprite: windSprite, scale: reduced ? 0 : 7 })];

        const glowTexture = makeRadialTexture(PIXI, [
          [0, "rgba(255, 216, 158, 0.5)"],
          [1, "rgba(255, 216, 158, 0)"],
        ]);

        interface SectionState {
          glow: any;
          hit: any;
          target: number;
          value: number;
        }
        const sections = new Map<string, SectionState>();
        for (const key of Object.keys(SECTIONS)) {
          const glow = new PIXI.Sprite(glowTexture);
          glow.anchor.set(0.5);
          glow.blendMode = "add";
          glow.alpha = 0;
          app.stage.addChild(glow);

          const hit = new PIXI.Graphics().rect(0, 0, 10, 10).fill({ color: 0xffffff, alpha: 0.001 });
          hit.eventMode = "static";
          hit.cursor = "pointer";
          const state: SectionState = { glow, hit, target: 0, value: 0 };
          hit.on("pointerover", () => {
            state.target = 1;
          });
          hit.on("pointerout", () => {
            state.target = 0;
          });
          hit.on("pointertap", () => {
            propsRef.current.onFocus(currentFocus === key ? null : key);
          });
          app.stage.addChild(hit);
          sections.set(key, state);
        }
        let currentFocus: string | null = null;

        const entries = new Map<string, Entry>();

        const layout = () => {
          const width = app.screen.width;
          const height = app.screen.height;
          const scale = Math.max(width / scene.texture.width, height / scene.texture.height);
          scene.scale.set(scale);
          scene.position.set(width / 2, height / 2);
          windSprite.width = scene.width * 1.25;
          windSprite.height = scene.height;
          windSprite.position.set(width / 2, height / 2);
          for (const [key, state] of sections) {
            const rect = SECTIONS[key] ?? SECTIONS.feeling;
            state.glow.position.set((rect.x + rect.w / 2) * width, (rect.y + rect.h / 2) * height);
            state.glow.width = rect.w * width * 1.3;
            state.glow.height = rect.h * height * 1.3;
            state.hit.clear().rect(rect.x * width, rect.y * height, rect.w * width, rect.h * height).fill({ color: 0xffffff, alpha: 0.001 });
          }
        };
        layout();

        const sync = (list: PublicPlant[], focus: string | null) => {
          currentFocus = focus;
          const seen = new Set<string>();
          for (const plant of list) {
            seen.add(plant.id);
            let entry = entries.get(plant.id);
            if (!entry) {
              const sprite = new PIXI.Sprite(loaded[artOf(plant)]);
              sprite.anchor.set(0.5, 1);
              sprite.eventMode = "static";
              sprite.cursor = "pointer";
              sprite.on("pointerover", () => {
                entry!.hovered = true;
              });
              sprite.on("pointerout", () => {
                entry!.hovered = false;
              });
              sprite.on("pointerdown", () => {
                entry!.pressed = true;
              });
              for (const type of ["pointerup", "pointerupoutside", "pointercancel"]) {
                sprite.on(type, () => {
                  entry!.pressed = false;
                });
              }
              sprite.on("pointertap", () => propsRef.current.onSelect(plant.id));
              app.stage.addChild(sprite);

              const hitArea = new PIXI.Rectangle(0, 0, 1, 1);
              if (coarse) sprite.hitArea = hitArea;

              const glow = new PIXI.Sprite(glowTexture);
              glow.anchor.set(0.5, 0.62);
              glow.blendMode = "add";
              glow.tint = parseInt(metaOf(plant).glow.slice(1), 16);
              app.stage.addChild(glow);

              entry = {
                sprite,
                glow,
                plant,
                alive: 0,
                phase: ((plant.seed % 628) / 100) * 1,
                hovered: false,
                pressed: false,
                hitArea,
              };
              entries.set(plant.id, entry);
            }
            entry.plant = plant;
          }
          for (const [id, entry] of entries) {
            if (!seen.has(id)) {
              entry.sprite.destroy();
              entry.glow.destroy();
              entries.delete(id);
            }
          }
        };
        syncRef.current = sync;
        sync(plants, focused);

        const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
        const onPointerMove = (event: PointerEvent) => {
          const bounds = host.getBoundingClientRect();
          parallax.tx = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 14;
          parallax.ty = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 8;
        };
        const onPointerLeave = () => {
          parallax.tx = 0;
          parallax.ty = 0;
        };
        if (!reduced && !coarse) {
          host.addEventListener("pointermove", onPointerMove);
          host.addEventListener("pointerleave", onPointerLeave);
        }

        const makeDot = (color: number, radius: number, alpha = 1) =>
          makeDotTexture(PIXI, app.renderer, color, radius, alpha);

        const fireflies: Particle[] = [];
        const pollen: Particle[] = [];
        const petals: Particle[] = [];
        if (!reduced) {
          const fireflyTexture = makeDot(0xffe9b0, 2.4);
          const pollenTexture = makeDot(0xfff2cf, 1.3);
          const petalTexture = makeDot(0xf4b8c8, 2.6, 0.9);
          for (let i = 0; i < scaledCount(18, app.screen.width, app.screen.height); i++) {
            const sprite = new PIXI.Sprite(fireflyTexture);
            sprite.blendMode = "add";
            app.stage.addChild(sprite);
            fireflies.push({ sprite, speed: 0.4 + Math.random() * 0.7, phase: Math.random() * Math.PI * 2, amp: 10 + Math.random() * 26, rot: 0 });
          }
          for (let i = 0; i < scaledCount(26, app.screen.width, app.screen.height); i++) {
            const sprite = new PIXI.Sprite(pollenTexture);
            sprite.blendMode = "add";
            app.stage.addChild(sprite);
            pollen.push({ sprite, speed: 0.5 + Math.random(), phase: Math.random() * Math.PI * 2, amp: 0, rot: 0 });
          }
          for (let i = 0; i < scaledCount(10, app.screen.width, app.screen.height); i++) {
            const sprite = new PIXI.Sprite(petalTexture);
            sprite.alpha = 0.45;
            app.stage.addChild(sprite);
            petals.push({ sprite, speed: 0.5 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2, amp: 0, rot: (Math.random() - 0.5) * 2 });
          }
        }

        let elapsed = 0;
        let lastWidth = app.screen.width;
        let lastHeight = app.screen.height;

        app.ticker.add((ticker: any) => {
          const dt = Math.min(0.05, ticker.deltaMS / 1000);
          elapsed += dt;
          app.stage.alpha = Math.min(1, app.stage.alpha + dt * 2.2);

          if (app.screen.width !== lastWidth || app.screen.height !== lastHeight) {
            lastWidth = app.screen.width;
            lastHeight = app.screen.height;
            layout();
          }

          parallax.x += (parallax.tx - parallax.x) * 0.06;
          parallax.y += (parallax.ty - parallax.y) * 0.06;
          scene.position.set(app.screen.width / 2 + parallax.x * 0.5, app.screen.height / 2 + parallax.y * 0.5);
          windSprite.position.set(
            app.screen.width / 2 + Math.sin(elapsed * 0.32) * 22,
            app.screen.height / 2 + Math.sin(elapsed * 0.21) * 8,
          );

          for (const [key, state] of sections) {
            const want = currentFocus === key ? 0.5 : state.target * 0.28;
            state.value += (want - state.value) * 0.08;
            state.glow.alpha = state.value;
          }

          for (const entry of entries.values()) {
            const { sprite, glow, plant } = entry;
            entry.alive = Math.min(1, entry.alive + dt / 0.7);
            const ease = 1 - Math.pow(1 - entry.alive, 3);
            const base = (STAGE_WIDTH[plant.stage] ?? 108) * (plant.scale ?? 1);
            const focusScale = currentFocus && currentFocus === plant.category ? 1.12 : 1;
            const dim = currentFocus && currentFocus !== plant.category ? 0.22 : 1;
            const breathe = plant.stage === "fruit" ? 1 + Math.sin(elapsed * 1.4 + entry.phase) * 0.02 : 1;
            const active = entry.hovered || entry.pressed;
            const hover = active ? 1.06 : 1;
            const scale = (base / sprite.texture.width) * ease * focusScale * breathe * hover;
            sprite.scale.set(scale);
            if (coarse) {
              const need = 44 / Math.max(0.0001, scale);
              const hitW = Math.max(sprite.texture.width, need);
              const hitH = Math.max(sprite.texture.height, need);
              entry.hitArea.x = -hitW / 2;
              entry.hitArea.y = -hitH;
              entry.hitArea.width = hitW;
              entry.hitArea.height = hitH;
            }
            sprite.alpha = ease * dim;
            const sway = Math.sin(elapsed * 0.9 + entry.phase) * 0.022 + Math.sin(elapsed * 1.7 + entry.phase * 2) * 0.008;
            sprite.rotation = plant.stage === "withered" ? 0.12 : sway;
            const depth = 0.6 + plant.y;
            const x = plant.x * app.screen.width + parallax.x * depth;
            const y = plant.y * app.screen.height + parallax.y * depth;
            sprite.position.set(x, y);
            sprite.zIndex = Math.round(plant.y * 1000) + (active ? 5000 : 0);
            glow.position.set(x, y);
            glow.scale.set(scale);
            glow.alpha = ease * dim * (active ? 0.34 : 0.22);
            glow.zIndex = sprite.zIndex - 1;
          }

          for (const fly of fireflies) {
            const bx = fly.bx ?? (fly.bx = Math.random() * app.screen.width);
            const by = fly.by ?? (fly.by = (0.35 + Math.random() * 0.6) * app.screen.height);
            const wiggle = elapsed * fly.speed + fly.phase;
            fly.sprite.position.set(bx + Math.sin(wiggle) * fly.amp, by + Math.cos(wiggle * 0.8) * fly.amp * 0.6);
            fly.sprite.alpha = 0.2 + (Math.sin(wiggle * 1.6) * 0.5 + 0.5) * 0.6;
          }

          for (const mote of pollen) {
            let bx = mote.bx ?? (mote.bx = Math.random() * app.screen.width);
            let by = mote.by ?? (mote.by = Math.random() * app.screen.height);
            by -= mote.speed * dt * 20;
            bx += Math.sin(elapsed * 0.6 + mote.phase) * dt * 10;
            if (by < -10) {
              by = app.screen.height + 10;
              bx = Math.random() * app.screen.width;
            }
            mote.bx = bx;
            mote.by = by;
            mote.sprite.position.set(bx, by);
            mote.sprite.alpha = 0.16 + Math.sin(elapsed + mote.phase) * 0.08;
          }

          for (const petal of petals) {
            let bx = petal.bx ?? (petal.bx = Math.random() * app.screen.width);
            let by = petal.by ?? (petal.by = -Math.random() * app.screen.height);
            by += petal.speed * dt * 32;
            bx += Math.sin(elapsed * 0.5 + petal.phase) * dt * 18;
            if (by > app.screen.height + 12) {
              by = -12;
              bx = Math.random() * app.screen.width;
            }
            petal.bx = bx;
            petal.by = by;
            petal.sprite.position.set(bx, by);
            petal.sprite.rotation += dt * petal.rot;
          }
        });

        cleanup = () => {
          host.removeEventListener("pointermove", onPointerMove);
          host.removeEventListener("pointerleave", onPointerLeave);
          try {
            scene.filters = [];
          } catch {
            /* ignore */
          }
          for (const entry of entries.values()) {
            try {
              entry.sprite.destroy();
              entry.glow.destroy();
            } catch {
              /* ignore */
            }
          }
          entries.clear();
          try {
            windSprite.destroy();
          } catch {
            /* ignore */
          }
        };
      } catch (error) {
        console.error("garden canvas failed", error);
        if (!disposed) propsRef.current.onFail();
      }
    };

    void boot();

    return () => {
      disposed = true;
      syncRef.current = null;
      try {
        cleanup?.();
        app?.destroy(true, { children: true, texture: false });
      } catch {
        /* ignore */
      }
      app = null;
    };
  }, []);

  useEffect(() => {
    syncRef.current?.(plants, focused);
  }, [plants, focused]);

  return <div className="garden-pixi" ref={hostRef} />;
}
