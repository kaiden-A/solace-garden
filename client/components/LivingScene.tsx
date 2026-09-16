"use client";

import { useEffect, useRef, useState } from "react";
import { Fireflies } from "./Fireflies";
import { makeDotTexture, makePetalTexture, makeRadialTexture, makeVerticalGradientTexture, pixiResolution, scaledCount } from "./pixi-utils";

const LANTERNS = [
  { x: 0.135, y: 0.72 },
  { x: 0.375, y: 0.81 },
];

interface Particle {
  sprite: any;
  speed: number;
  phase: number;
}

interface Leaf {
  sprite: any;
  vy: number;
  vx: number;
  vr: number;
}

export default function LivingScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

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
        app.stage.sortableChildren = true;
        app.stage.alpha = 0;

        const loaded = await PIXI.Assets.load(["/assets/bg-dusk.jpg", "/assets/bg-dusk-wind.png"]);
        if (disposed) return;

        const scene = new PIXI.Sprite(loaded["/assets/bg-dusk.jpg"]);
        scene.anchor.set(0.5);
        app.stage.addChild(scene);

        const windSprite = new PIXI.Sprite(loaded["/assets/bg-dusk-wind.png"]);
        windSprite.anchor.set(0.5);
        app.stage.addChild(windSprite);
        scene.filters = [new PIXI.DisplacementFilter({ sprite: windSprite, scale: reduced ? 0 : 6 })];

        const scrim = new PIXI.Sprite(
          makeVerticalGradientTexture(PIXI, [
            [0, "rgba(19, 17, 32, 0.42)"],
            [0.45, "rgba(19, 17, 32, 0.12)"],
            [1, "rgba(19, 17, 32, 0.58)"],
          ]),
        );
        scrim.zIndex = 50;
        app.stage.addChild(scrim);

        const glowTexture = makeRadialTexture(PIXI, [
          [0, "rgba(255, 190, 110, 0.5)"],
          [1, "rgba(255, 190, 110, 0)"],
        ]);
        const lanternGlows = LANTERNS.map((lantern) => {
          const glowSprite = new PIXI.Sprite(glowTexture);
          glowSprite.anchor.set(0.5);
          glowSprite.blendMode = "add";
          glowSprite.zIndex = 60;
          app.stage.addChild(glowSprite);
          return { sprite: glowSprite, phase: Math.random() * Math.PI * 2, base: lantern };
        });

        const starTexture = makeDotTexture(PIXI, app.renderer, 0xffffff, 1.1);
        const stars: Particle[] = [];
        const starCount = reduced ? 0 : scaledCount(36, app.screen.width, app.screen.height);
        for (let i = 0; i < starCount; i++) {
          const sprite = new PIXI.Sprite(starTexture);
          sprite.zIndex = 40;
          app.stage.addChild(sprite);
          stars.push({ sprite, speed: 0.6 + Math.random() * 1.4, phase: Math.random() * Math.PI * 2 });
        }

        const fireflyTexture = makeDotTexture(PIXI, app.renderer, 0xffe9b0, 2.2);
        interface Firefly extends Particle {
          bx?: number;
          by?: number;
          amp: number;
        }
        const fireflies: Firefly[] = [];
        const fireflyCount = reduced ? 0 : scaledCount(22, app.screen.width, app.screen.height);
        for (let i = 0; i < fireflyCount; i++) {
          const sprite = new PIXI.Sprite(fireflyTexture);
          sprite.blendMode = "add";
          sprite.zIndex = 70;
          app.stage.addChild(sprite);
          fireflies.push({
            sprite,
            speed: 0.4 + Math.random() * 0.7,
            phase: Math.random() * Math.PI * 2,
            amp: 10 + Math.random() * 22,
          });
        }

        const leafTextures = [
          makePetalTexture(PIXI, app.renderer, 0xd9b98a, 3.2, 5),
          makePetalTexture(PIXI, app.renderer, 0xc7a06b, 2.6, 4.4),
          makePetalTexture(PIXI, app.renderer, 0xe0c9a0, 2.2, 3.6),
        ];
        const leaves: Leaf[] = [];
        const leafCount = reduced ? 0 : scaledCount(9, app.screen.width, app.screen.height);
        for (let i = 0; i < leafCount; i++) {
          const sprite = new PIXI.Sprite(leafTextures[i % leafTextures.length]);
          sprite.zIndex = 80;
          sprite.alpha = 0.7;
          app.stage.addChild(sprite);
          leaves.push({ sprite, vy: 18 + Math.random() * 26, vx: 10 + Math.random() * 18, vr: (Math.random() - 0.5) * 2.4 });
        }

        let parallax = { x: 0, y: 0, tx: 0, ty: 0 };
        const onPointerMove = (event: PointerEvent) => {
          const bounds = host.getBoundingClientRect();
          parallax.tx = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 12;
          parallax.ty = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 7;
        };
        const onPointerLeave = () => {
          parallax.tx = 0;
          parallax.ty = 0;
        };
        if (!reduced) {
          host.addEventListener("pointermove", onPointerMove);
          host.addEventListener("pointerleave", onPointerLeave);
        }

        let width = app.screen.width;
        let height = app.screen.height;
        let elapsed = 0;

        const layout = () => {
          width = app.screen.width;
          height = app.screen.height;
          scene.scale.set(Math.max(width / scene.texture.width, height / scene.texture.height));
          scene.position.set(width / 2, height / 2);
          windSprite.width = scene.width * 1.25;
          windSprite.height = scene.height;
          windSprite.position.set(width / 2, height / 2);
          scrim.width = width;
          scrim.height = height;
          const glowScale = Math.min(width * 0.2, 240) / glowTexture.width;
          for (const lantern of lanternGlows) {
            lantern.sprite.scale.set(glowScale);
            lantern.sprite.position.set(lantern.base.x * width, lantern.base.y * height);
          }
          stars.forEach((star, index) => {
            const sx = ((index * 137.5) % 100) / 100;
            const sy = (((index * 61.7) % 42) + 2) / 100;
            star.sprite.position.set(sx * width, sy * height);
          });
        };
        layout();

        app.ticker.add((ticker: any) => {
          const dt = Math.min(0.05, ticker.deltaMS / 1000);
          elapsed += dt;
          app.stage.alpha = Math.min(1, app.stage.alpha + dt * 1.4);

          if (app.screen.width !== width || app.screen.height !== height) layout();

          parallax.x += (parallax.tx - parallax.x) * 0.06;
          parallax.y += (parallax.ty - parallax.y) * 0.06;
          scene.position.set(width / 2 + parallax.x * 0.5, height / 2 + parallax.y * 0.5);
          windSprite.position.set(
            width / 2 + Math.sin(elapsed * 0.3) * 18,
            height / 2 + Math.sin(elapsed * 0.19) * 7,
          );

          for (const star of stars) {
            star.sprite.alpha = 0.25 + (Math.sin(elapsed * star.speed + star.phase) * 0.5 + 0.5) * 0.55;
          }

          for (const lantern of lanternGlows) {
            lantern.sprite.alpha =
              0.55 + Math.sin(elapsed * 1.3 + lantern.phase) * 0.1 + Math.sin(elapsed * 2.9 + lantern.phase * 2) * 0.05;
            lantern.sprite.position.set(
              lantern.base.x * width + parallax.x * 0.9,
              lantern.base.y * height + parallax.y * 0.9,
            );
          }

          for (const fly of fireflies) {
            const bx = fly.bx ?? (fly.bx = Math.random() * width);
            const by = fly.by ?? (fly.by = (0.35 + Math.random() * 0.6) * height);
            const wiggle = elapsed * fly.speed + fly.phase;
            fly.sprite.position.set(bx + Math.sin(wiggle) * fly.amp, by + Math.cos(wiggle * 0.8) * fly.amp * 0.7);
            fly.sprite.alpha = 0.18 + (Math.sin(wiggle * 1.6) * 0.5 + 0.5) * 0.6;
          }

          for (const leaf of leaves) {
            leaf.sprite.y += leaf.vy * dt;
            leaf.sprite.x += (leaf.vx + Math.sin(elapsed * 0.8 + leaf.sprite.y * 0.01) * 14) * dt;
            leaf.sprite.rotation += leaf.vr * dt;
            if (leaf.sprite.y > height + 20 || leaf.sprite.x > width + 20) {
              leaf.sprite.x = (0.02 + Math.random() * 0.45) * width;
              leaf.sprite.y = -20 - Math.random() * height * 0.4;
            }
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
        };
      } catch (error) {
        console.error("living scene failed", error);
        if (!disposed) setFailed(true);
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

  return (
    <div className="living-scene" aria-hidden="true">
      <div className="living-pixi" ref={hostRef} style={{ display: failed ? "none" : "block" }} />
      {failed && <Fireflies count={18} />}
    </div>
  );
}
