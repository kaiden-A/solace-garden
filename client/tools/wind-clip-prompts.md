# Wind-Release Clips — Generation Pack (v2)

Six short clips of the garden plants being lifted and carried away by the wind.
Each clip is used over the dusk scene in the "let the wind take it" sequence.

> **v2 lesson (from the first cherry attempt):** the model zoomed ~5× into our sprite,
> generated a square frame, upscaled, and added noise, neon fringes and a watermark.
> The fixes are below: **big-framing start frames** (regenerated), **16:9 mode forced**,
> **no-zoom instructions**, and a **no-watermark plan**. Read "Why the first attempt failed".

## Settings (same for every clip)

| Setting | Value |
| --- | --- |
| Mode | **Image-to-video** — attach the matching start frame from `client/public/video-frames/` as the **first frame** |
| Aspect ratio | **16:9 — mandatory.** Never 1:1 or "auto" (that caused the crop+upscale mess) |
| Duration | 5 seconds |
| Resolution | 1080p (720p acceptable) |
| Camera | locked off — no pan, no zoom, no cuts |
| Motion strength | **low-to-medium** (high motion = morphing) |
| Watermark | **none** — use a plan/tool that exports without watermark (free tiers add one) |
| Audio | not needed (plays muted) |
| Naming | save as `client/public/assets/release/<species>.mp4` |

File names (exact): `peony.mp4` · `forget-me-not.mp4` · `cherry.mp4` · `rose.mp4` · `foxglove.mp4` · `wisteria.mp4`

## Workflow

1. Run `node tools/make-video-frames.mjs` — produces **big-framing** start frames (the plant fills ~78% of the frame; the app auto-scales the clip down to garden size, so bigger pixels on the plant = better generation)
2. Open your tool → image-to-video → upload `public/video-frames/<species>.jpg` as the **first frame** → **force 16:9**
3. Paste the matching prompt, plus the shared negative prompt
4. Generate, check against the checklist, download
5. Drop the mp4 into `client/public/assets/release/` with the exact file name
6. Optional sanity check: `node tools/inspect-clip.mjs <species>` — prints duration/resolution and screenshots frames so we can compare before wiring
7. Nothing else to align — `WindScene` auto-fits the clip to the plant; if a clip still sits slightly off, it has a per-species nudge table

## Why the first attempt failed (troubleshooting)

| Symptom in the cherry clip | Cause | Fix |
| --- | --- | --- |
| Plant filled the whole frame; heavy speckle noise; neon fringes | Output was **1440×1440 square** — it cropped into our small-plant start frame and upscaled | Force **16:9**; use the new **big-framing** start frames (v2) |
| "KlingAI 3.0" text bottom-right | Free-tier **watermark** | Use a plan/tool that exports without watermark |
| Grainy background, over-saturated colors | The model "improved" the image (grain + grading) | The no-grain / no-grading lines in the prompts below |

## Shared negative prompt (paste with every generation)

```
camera movement, pan, zoom, dolly, cut, scene change, reframe, background scenery, sky, clouds,
ground, floor, horizon, grass field, text, watermark, logo, signature, hands, fingers, people,
animals, other flowers, other plants, daylight, sunlight, bright background, colored background,
film grain, noise, chromatic aberration, color grading, oversaturation, neon glow, lens flare,
vignette, fast motion, harsh motion, flicker
```

## The prompts

### 1 — Peony (gratitude) → `peony.mp4`

```
Image-to-video, 16:9. Use the attached image as the first frame exactly as-is: a single glowing
warm-golden peony with layered petals, growing from a small mound of dark soil, on a pure black
background, plant centered and filling most of the frame height.

Hard rules: keep the plant at the exact same size, scale, position and design as the first frame
throughout the entire clip. Do not zoom, do not reframe, do not redesign the plant, do not change
its colors or style. Do not add film grain, noise, color grading or extra glow rings.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The peony rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; the leaves and petals tremble,
the stem bends gently, its amber glow brightens slightly.
1.5–3.5s — the wind lifts the peony from the soil. It rises slowly and drifts up and to the
right, tilting and tumbling gently, roots released, trailing amber-gold light and a few petals.
3.5–5.0s — the peony dissolves into warm golden petals and glowing amber motes that scatter
to the right and fade out, leaving only black.

Camera completely locked off. Background pure solid black (#000000) for the entire clip —
no sky, no ground, no vignette, no stars. Lighting only from the plant's own warm amber glow.
Painterly storybook style, soft volumetric glow, cinematic, gentle.
No text, no watermark, no hands, no people, no other plants.
```

### 2 — Forget-me-not (memory) → `forget-me-not.mp4`

```
Image-to-video, 16:9. Use the attached image as the first frame exactly as-is: a pale blue
forget-me-not cluster on a slender stem with soft green leaves, growing from a small mound
of dark soil, on a pure black background, plant centered and filling most of the frame height.

Hard rules: keep the plant at the exact same size, scale, position and design as the first frame
throughout the entire clip. Do not zoom, do not reframe, do not redesign the plant, do not change
its colors or style. Do not add film grain, noise, color grading or extra glow rings.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The flower rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; the tiny blossoms shiver,
the stem sways gently, its pale blue glow pulses softly.
1.5–3.5s — the wind lifts the flower from the soil. It rises slowly and drifts up and to the
right, tilting and tumbling gently, roots released, trailing soft blue light and tiny petals.
3.5–5.0s — the flower dissolves into small pale blue blossoms and glowing motes that scatter
to the right and fade out, leaving only black.

Camera completely locked off. Background pure solid black (#000000) for the entire clip —
no sky, no ground, no vignette, no stars. Lighting only from the plant's own pale blue glow.
Painterly storybook style, soft volumetric glow, cinematic, gentle.
No text, no watermark, no hands, no people, no other plants.
```

### 3 — Cherry blossom (hope) → `cherry.mp4`

```
Image-to-video, 16:9. Use the attached image as the first frame exactly as-is: a young cherry
blossom sapling covered in pink blossoms with a slender trunk, growing from a small mound of
dark soil, on a pure black background, plant centered and filling most of the frame height.

Hard rules: keep the plant at the exact same size, scale, position and design as the first frame
throughout the entire clip. Do not zoom, do not reframe, do not redesign the plant, do not change
its colors or style. Do not add film grain, noise, color grading or extra glow rings.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The sapling rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; blossoms rustle, a few petals
loosen, the trunk sways gently, its rose-pink glow brightens.
1.5–3.5s — the wind lifts the sapling from the soil. It rises slowly and drifts up and to the
right, tilting and tumbling gently, roots released, trailing pink petals and light.
3.5–5.0s — the sapling dissolves into pink cherry petals and glowing motes that scatter to
the right and fade out, leaving only black.

Camera completely locked off. Background pure solid black (#000000) for the entire clip —
no sky, no ground, no vignette, no stars. Lighting only from the plant's own rose-pink glow.
Painterly storybook style, soft volumetric glow, cinematic, gentle.
No text, no watermark, no hands, no people, no other plants.
```

### 4 — Rose (anger) → `rose.mp4`

```
Image-to-video, 16:9. Use the attached image as the first frame exactly as-is: a single deep
crimson rose with ember-red glow, growing from a dark thorny bramble on a small mound of dark
soil, on a pure black background, plant centered and filling most of the frame height.

Hard rules: keep the plant at the exact same size, scale, position and design as the first frame
throughout the entire clip. Do not zoom, do not reframe, do not redesign the plant, do not change
its colors or style. Do not add film grain, noise, color grading or extra glow rings.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The rose rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; the thorny leaves tremble,
the bloom sways, its ember-red glow flickers like a dying coal.
1.5–3.5s — the wind lifts the rose from the soil. It rises slowly and drifts up and to the
right, tilting and tumbling gently, roots released, trailing red petals and tiny ember sparks.
3.5–5.0s — the rose dissolves into deep red petals and fading embers that scatter to the
right and die out, leaving only black.

Camera completely locked off. Background pure solid black (#000000) for the entire clip —
no sky, no ground, no vignette, no stars. Lighting only from the plant's own ember glow.
Painterly storybook style, soft volumetric glow, cinematic, gentle — melancholic, not scary.
No text, no watermark, no hands, no people, no other plants.
```

### 5 — Foxglove (letter) → `foxglove.mp4`

```
Image-to-video, 16:9. Use the attached image as the first frame exactly as-is: a tall lavender
foxglove with bell-shaped blossoms on a leafy stem, growing from a small mound of dark soil,
on a pure black background, plant centered and filling most of the frame height.

Hard rules: keep the plant at the exact same size, scale, position and design as the first frame
throughout the entire clip. Do not zoom, do not reframe, do not redesign the plant, do not change
its colors or style. Do not add film grain, noise, color grading or extra glow rings.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The foxglove rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; the bells tremble and sway,
the tall stem bends gracefully, its violet glow brightens.
1.5–3.5s — the wind lifts the foxglove from the soil. It rises slowly and drifts up and to
the right, tilting and tumbling gently, roots released, trailing violet light and petals.
3.5–5.0s — the foxglove dissolves into lavender petals and glowing motes that scatter to the
right and fade out, leaving only black.

Camera completely locked off. Background pure solid black (#000000) for the entire clip —
no sky, no ground, no vignette, no stars. Lighting only from the plant's own violet glow.
Painterly storybook style, soft volumetric glow, cinematic, gentle.
No text, no watermark, no hands, no people, no other plants.
```

### 6 — Wisteria (feeling) → `wisteria.mp4`

```
Image-to-video, 16:9. Use the attached image as the first frame exactly as-is: a teal glowing
wisteria cluster hanging from a delicate branch, growing from a small mound of dark soil,
on a pure black background, plant centered and filling most of the frame height.

Hard rules: keep the plant at the exact same size, scale, position and design as the first frame
throughout the entire clip. Do not zoom, do not reframe, do not redesign the plant, do not change
its colors or style. Do not add film grain, noise, color grading or extra glow rings.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The wisteria rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; the hanging blossoms sway and
drift like water, the branch bows gently, its teal glow ripples.
1.5–3.5s — the wind lifts the wisteria from the soil. It rises slowly and drifts up and to
the right, tilting and tumbling gently, roots released, trailing teal light and blossoms.
3.5–5.0s — the wisteria dissolves into teal blossoms and glowing motes that scatter to the
right and fade out, leaving only black.

Camera completely locked off. Background pure solid black (#000000) for the entire clip —
no sky, no ground, no vignette, no stars. Lighting only from the plant's own teal glow.
Painterly storybook style, soft volumetric glow, cinematic, gentle.
No text, no watermark, no hands, no people, no other plants.
```

## Checklist before saving a clip

- [ ] **16:9 output** — not square, not cropped
- [ ] **No watermark** anywhere in the frame
- [ ] First frame matches the uploaded start frame (same plant, same size, same position)
- [ ] The plant **never zooms or reframes** during the clip
- [ ] Background stays **pure black** — no grey haze, no speckle noise, no vignette
- [ ] No neon fringes, chromatic aberration, film grain, or color grading
- [ ] The plant lifts up-and-right and is **fully gone by the end** (frame empties to black)
- [ ] The first ~0.5s is still (this makes the in-game crossfade seamless)

If a clip comes out slightly unaligned in the app anyway: capture it with
`node tools/inspect-clip.mjs <species>` and we add a one-line nudge (`scale` / `offsetY` /
`maxSeconds` to cut a drifting tail) in `components/WindScene.tsx`.
