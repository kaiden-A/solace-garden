# Wind-Release Clips — Generation Pack

Six short clips of the garden plants being lifted and carried away by the wind.
Each clip is used over the dusk scene in the "let the wind take it" sequence.

## Settings (same for every clip)

| Setting | Value |
| --- | --- |
| Mode | **Image-to-video** — attach the matching start frame from `client/public/video-frames/` as the **first frame** |
| Duration | 5 seconds |
| Aspect ratio | 16:9 |
| Resolution | 1080p (720p acceptable) |
| Camera | locked off — no pan, no zoom, no cuts |
| Motion strength | medium-low (keep the camera still) |
| Audio | not needed (plays muted) |
| Naming | save as `client/public/assets/release/<species>.mp4` — e.g. `foxglove.mp4` |

File names (exact): `peony.mp4` · `forget-me-not.mp4` · `cherry.mp4` · `rose.mp4` · `foxglove.mp4` · `wisteria.mp4`

## Workflow

1. Run `node tools/make-video-frames.mjs` (already generated once — re-run only if the plant art changes)
2. Open your video tool → image-to-video → upload `public/video-frames/<species>.jpg` as the **first frame**
3. Paste the matching prompt below, plus the shared negative prompt
4. Generate, check against the checklist at the bottom, download
5. Drop the mp4 into `client/public/assets/release/` using the exact file name

## Shared negative prompt (paste with every generation)

```
camera movement, pan, zoom, dolly, cut, scene change, background scenery, sky, clouds, ground, floor, horizon, grass field, text, watermark, logo, signature, hands, fingers, people, animals, other flowers, other plants, daylight, sunlight, bright background, colored background, fast motion, harsh motion, flicker
```

## The prompts

### 1 — Peony (gratitude) → `peony.mp4`

```
Image-to-video. Use the attached image as the first frame exactly as-is: a single glowing
warm-golden peony with layered petals, growing from a small mound of dark soil, centered,
on a pure black background.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The peony rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; the leaves and petals tremble,
the stem bends gently, golden light brightens slightly.
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
Image-to-video. Use the attached image as the first frame exactly as-is: a pale blue
forget-me-not cluster on a slender stem with soft green leaves, growing from a small mound
of dark soil, centered, on a pure black background.

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
Image-to-video. Use the attached image as the first frame exactly as-is: a young cherry
blossom sapling covered in pink blossoms with a slender trunk, growing from a small mound
of dark soil, centered, on a pure black background.

Timeline (5 seconds):
0.0–0.5s — complete stillness. The sapling rests exactly as in the first frame.
0.5–1.5s — a soft gust of wind arrives from the lower left; blossoms rustle, a few petals
loosen, the trunk sways gently, its rose-pink glow brightens.
1.5–3.5s — the wind lifts the sapling from the soil. It rises slowly and drifts up and to
the right, tilting and tumbling gently, roots released, trailing pink petals and light.
3.5–5.0s — the sapling dissolves into pink cherry petals and glowing motes that scatter to
the right and fade out, leaving only black.

Camera completely locked off. Background pure solid black (#000000) for the entire clip —
no sky, no ground, no vignette, no stars. Lighting only from the plant's own rose-pink glow.
Painterly storybook style, soft volumetric glow, cinematic, gentle.
No text, no watermark, no hands, no people, no other plants.
```

### 4 — Rose (anger) → `rose.mp4`

```
Image-to-video. Use the attached image as the first frame exactly as-is: a single deep
crimson rose with ember-red glow, growing from a dark thorny bramble on a small mound of
dark soil, centered, on a pure black background.

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
Image-to-video. Use the attached image as the first frame exactly as-is: a tall lavender
foxglove with bell-shaped blossoms on a leafy stem, growing from a small mound of dark soil,
centered, on a pure black background.

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
Image-to-video. Use the attached image as the first frame exactly as-is: a teal glowing
wisteria cluster hanging from a delicate branch, growing from a small mound of dark soil,
centered, on a pure black background.

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

- [ ] First frame matches the uploaded start frame (the plant at rest, same position and size)
- [ ] The background stays **completely black** for the entire clip — no scenery appears
- [ ] The camera does not move at all
- [ ] The plant lifts up-and-right and is **fully gone by the end** (frame empties to black)
- [ ] The first ~0.5s is still (this is what makes the in-game crossfade seamless)
- [ ] No text, watermark, hands, or other plants

If the model adds a background: append `pure black studio background, the black background must never change`.
If the camera drifts: lower the motion strength and append `static locked camera` twice.
If the plant doesn't fully disappear: append `by the end of the clip the frame is completely empty and black`.
