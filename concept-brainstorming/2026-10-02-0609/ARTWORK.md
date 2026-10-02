# Four Corners of a Frozen Sea

## Artist statement

Take every way of laying dominoes on a diamond-shaped board, pick one
*uniformly at random*, and draw it. Nothing in the procedure mentions a
circle — yet in 1998 Jockusch, Propp and Shor proved that as the board
grows, the tiling freezes into four perfectly regular brick corners and
stays disordered only inside the inscribed circle, with a razor-sharp
boundary between the two. The repo's `arctic` generator samples that
tiling exactly (domino shuffling — no burn-in, no Markov chain) and
inks each domino's spine.

Every earlier piece in this studio was steered by a generator's
*aesthetics*. This one is steered by a theorem. I kept the `weave`
look — all four domino classes inked, turned 45° so the frozen regions
sit in the corners — and gave each class its own pen colour. Now the
four frozen corners are four flat colours, each a field of ruled
diagonals, and the liquid disc between them is every colour at once,
confetti-ing into the corners exactly where the mathematics says it must.
It looks like a compass rose or a snow globe seen on a dark table, and
it is made of nothing but one rule applied everywhere.

It survived the cull because the single-colour presets (dissolve,
horizon) read as clever diagrams, while four inks on black read as a
picture: the order parameter becomes hue. The colour dominance flips
at the circle like a phase boundary you can put your finger on.

## Materials

- **Paper**: black or very dark navy (#14151c) smooth card, 250–300 gsm
  (e.g. Colorama / Canson Mi-Teintes Touch black), cut to **297 × 297 mm**.
- **Pens** (all opaque gel/paint pens, 0.35–0.5 mm tip, one per layer):
  1. Layer 1 — *Gold*: Sakura Gelly Roll Metallic Gold, ≈ #e8b84a
  2. Layer 2 — *Cyan blue*: Uni-ball Signo Broad / Sakura Gelly Roll
     Moonlight Sky Blue, ≈ #4aa3c9
  3. Layer 3 — *Vermilion*: Posca PC-1MR / Sakura Gelly Roll Orange-Red,
     ≈ #d9503c
  4. Layer 4 — *Sage green*: Sakura Gelly Roll Moonlight Pastel Green,
     ≈ #9fd18b
- Low-tack masking tape (4 registration tabs), 2 mm-thick mount board,
  white-wood float frame (optional).

## Process

1. Tape the card flat to the plotter bed; mark the sheet's top-left
   corner position with tape tabs so it can be removed and re-seated
   (or leave it taped throughout — preferred).
2. Plot `artwork-layer-1.svg` (**gold**) — the top-right frozen corner
   and gold dashes scattered in the disc. Let it dry 10 min.
3. Swap pen. Plot `artwork-layer-2.svg` (**blue**, bottom-right corner).
4. Plot `artwork-layer-3.svg` (**vermilion**, bottom-left corner).
5. Plot `artwork-layer-4.svg` (**green**, top-left corner).
   Order doesn't matter geometrically — lines never overlap between
   layers because dominoes are disjoint — so drying time is only a
   smudge precaution. Do **not** shift the sheet between passes: the
   four layers must register to ~0.2 mm for the brick courses to
   interlock cleanly at the circle.
6. Remove tape by peeling toward the paper's edge. Mount on board with
   a 40 mm border of black, float-frame in white wood.

## Plot settings

- Sheet 297 × 297 mm, 18 mm margin (diamond fills a 261 mm square).
- Pen width 0.35 mm nominal (SVG stroke 1.05 px at 3 px/mm).
- ≈ 490 strokes per layer, 1,950 total; pen travel is minimal (strokes
  are reordered with `orderPlot`, never chained, so dashes stay crisp).
- Four pen swaps; ~25 min plot time total at normal speed.

## Reproduction

Build once (`pnpm install && pnpm build`), then from the repo root:

```sh
node concept-brainstorming/2026-10-02-0609/render.mjs
```

`render.mjs` (in this folder) is the exact scratch script: it calls
`generateArctic({ width: 891, height: 891, margin: 54, seed: 7,
preset: 'weave', order: 64 })` — i.e. preset `weave` (all four domino
classes inked, upright) at order 64, **seed 7** — splits by pen layer
with `toSVGLayers` (layer map: 1 = `domino-n`, 2 = `domino-e`,
3 = `domino-s`, 4 = `domino-w`) and writes `artwork-layer-{1..4}.svg`
byte-for-byte (verified by re-running). `preview.png` was rasterised
with `scripts/svg-to-png.mjs` from the same lines coloured with the hex
values above on #14151c.

## Wishes

- An `arctic` CLI command (the generator is core-only) with
  `--split-layers`.
- A mark mode that curves each class's spines along the arctic circle's
  tangent inside the disc, so the liquid region has its own flow.
- Per-class pen *widths* as a first-class option for a hierarchy
  between frozen and liquid regions.
