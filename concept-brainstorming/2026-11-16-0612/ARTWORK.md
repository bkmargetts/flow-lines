# The Liquid Circle

*Two gel inks on indigo card, A3. Plotted from one exactly-uniform random
domino tiling of the Aztec diamond of order 160.*

## Statement

Take a diamond-shaped board, fill it with 25,760 dominoes chosen completely
at random — every possible arrangement exactly as likely as every other —
and ink only the horizontal ones: those facing "north" in white, those
facing "south" in pale blue. Nothing in the rule mentions a circle, or ice,
or a horizon. Yet the picture freezes: the top tip locks into a white cap of
unbroken rules, the bottom tip into a blue keel, and between them a perfect
disc stays *liquid* — a shimmer of short dashes in both inks, white thinning
downward, blue thickening, like moonlight breaking up on dark water. Mathematicians
call that boundary the arctic circle (Jockusch–Propp–Shor, 1998); its edge is
sharp because of combinatorics alone. There is no shading anywhere in the code.

This survived the cull because it works at two distances. Across a room it is
one quiet object — a lens, a berg, a planet with two frozen poles. Up close it
dissolves into hundreds of horizontal ice floes and Hiroshige-like rain, and
the jagged frost line where the cap meets the liquid is drawn by chance, not
by hand. I rejected the single-ink "dissolve" teardrop (more dramatic, but it
loses the second pole and the colour crossing), a four-ink "compass" (the four
inks muddied to grey in the liquid disc), and every domino-outline variant
(an even grey, and 100k+ strokes). This is the Arctic generator's first
outing in the studio.

## Materials

- **Paper:** Canson Mi-Teintes, *Indigo Blue*, 160 gsm, cut to A3
  (297 × 420 mm), portrait, smooth side up. Target colour ≈ `#1d2b45`.
  Any smooth deep navy/indigo card ≥ 160 gsm will do; avoid textured
  pastel-paper tooth (gel skips on it).
- **Pen 1 — Ice (layer 1):** Sakura Gelly Roll 08, *White* (#50),
  ≈ 0.4 mm line. Opaque white gel. Hex for previews `#f2efe6`.
- **Pen 2 — Keel (layer 2):** an opaque pastel *light/sky blue* gel pen of
  the same ≈ 0.4 mm line — e.g. Sakura Gelly Roll Moonlight 06 in a light
  blue. Hex for previews `#7fb3d5`. Test on an offcut of the paper first:
  it must read clearly lighter than the paper but distinctly cooler and
  dimmer than the white.
- Low-tack drafting tape; a scrap sheet of the same card for pen tests.
- **Mount:** float-mounted in a deep white or pale-oak box frame, no mat,
  so the navy edges of the card are part of the piece.

## Process

1. Tape the A3 sheet square to the plotter bed at all four corners. It must
   **not move** between the two passes — registration is held by never
   lifting the sheet.
2. Scribble each pen on the offcut until it flows evenly (gel pens skip on
   the first strokes after capping).
3. **Pass 1 — Ice.** Plot `liquid-circle-layer-1-ice.svg` with the white
   Gelly Roll. Slow the plotter (≈ 50–60 % of normal draw speed) — opaque
   gel lays down solid only when the pen isn't dragged. 2,977 strokes,
   ≈ 14.9 m of line.
4. Let it dry **30 minutes** untouched (gel white smears for longer than it
   looks). Swap the pen without disturbing the sheet; re-home on the same
   origin.
5. **Pass 2 — Keel.** Plot `liquid-circle-layer-2-keel.svg` with the blue
   gel pen, same speed. 2,935 strokes, ≈ 14.9 m of line. The two classes
   never share a domino, so the passes interleave but never overprint.
6. Dry overnight flat before removing tape (peel away from the drawing).
7. Sign in white pencil, small, bottom right of the card, outside the
   25 mm border. Float-mount.

`liquid-circle.svg` is the two layers combined (each in its preview ink),
for registration checks and previewing only — don't plot it.

## Plot settings

| | |
|---|---|
| Sheet | A3, 297 × 420 mm, portrait |
| Margin | 25 mm (the diamond is 247 mm wide, centred) |
| Pens | 2 passes, each one pen ≈ 0.4 mm (SVG stroke 1.6 px = 0.4 mm at 4 px/mm) |
| Layer order | 1 Ice (white) → 2 Keel (light blue) |
| Ink line | ≈ 14.9 m per pass, ≈ 29.8 m total; ~5,900 strokes |
| Speed | slow (≈ 50–60 %) for opaque gel |

Frozen-cap rules sit ≈ 0.77 mm apart, so a 0.4 mm line leaves a clear
navy gap — the caps read as ruled tone, not a filled block. Don't go above a
0.5 mm line.

## Reproduction

There is no `arctic` CLI command, so the SVGs come from a scratch script
calling core directly. From the repo root:

```sh
pnpm install && pnpm build
node final.mjs concept-brainstorming/2026-11-16-0612
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-16-0612/liquid-circle.svg \
  concept-brainstorming/2026-11-16-0612/preview.png --width 1600 --background '#1d2b45'
```

`final.mjs` (save anywhere; run with the repo root as working directory):

```js
// The Liquid Circle — run from the repo root after `pnpm install && pnpm build`:
//   node final.mjs concept-brainstorming/2026-11-16-0612
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { generateArctic, toSVG, toSVGLayers } = await import(resolve('packages/core/dist/index.js'));
const out = process.argv[2];
const PX_PER_MM = 4;
const W = 297 * PX_PER_MM, H = 420 * PX_PER_MM;          // A3 portrait
const result = generateArctic({
  width: W, height: H,
  margin: 25 * PX_PER_MM,                                // 25 mm clear border
  seed: 11,
  preset: 'horizon',                                     // inks the N and S domino classes
  order: 160,                                            // AD(160): 25,760 dominoes
});
const page = { physicalWidth: '297mm', physicalHeight: '420mm' };
const inks = { 'domino-n': '#f2efe6', 'domino-s': '#7fb3d5' };
const widths = { 'domino-n': 0.4 * PX_PER_MM, 'domino-s': 0.4 * PX_PER_MM };
const names = { 'domino-n': 'liquid-circle-layer-1-ice.svg', 'domino-s': 'liquid-circle-layer-2-keel.svg' };
for (const { layer, svg } of toSVGLayers(result, { ...page, strokeWidth: 1.6, layerColors: inks, layerWidths: widths })) {
  writeFileSync(join(out, names[layer]), svg);
}
// Composite reference (both pens, no background) for registration checks and preview.
writeFileSync(join(out, 'liquid-circle.svg'), toSVG(result, { ...page, strokeWidth: 1.6, layerColors: inks, layerWidths: widths }));
// Stats
for (const layer of Object.keys(names)) {
  const ls = result.lines.filter((l) => l.layer === layer);
  let ink = 0;
  for (const l of ls) for (let i = 1; i < l.points.length; i++) ink += Math.hypot(l.points[i].x - l.points[i-1].x, l.points[i].y - l.points[i-1].y);
  console.log(layer, ls.length, 'strokes,', (ink / PX_PER_MM / 1000).toFixed(1), 'm of ink line');
}
```

Generator settings in one line: `generateArctic({ width: 1188, height: 1680,
margin: 100, seed: 11, preset: 'horizon', order: 160 })` (default wobble 0.35,
`orderPlot` on). Verified byte-identical on a second run:

```
18f87dffc7328c0e01481b7b0de18105a89b6fc98bdab7931ea6fb50e7e942ed  liquid-circle-layer-1-ice.svg
6dd5d642716c4853b5e496fc109680a795dc30f019ca9c58a94c4e3fe2bf71e9  liquid-circle-layer-2-keel.svg
57c70be22eeb380de786dc0b9f72d05c8c8db6a4c4f41c9fbfe7327093b69afd  liquid-circle.svg
```

## Wishes

- An `arctic` CLI command (with `--split-layers`, `--paper`, `--tile`), so
  this piece is a one-liner instead of a scratch script.
- Per-class mark styles: ink the frozen caps as long welded rules but
  render the liquid disc's isolated dominoes as dots or ticks — a second
  texture inside the circle would let the two inks separate more clearly.
- A rotation option beyond 0°/45° (e.g. tip the diamond 90° so the frozen
  caps become left/right "shores" on a landscape sheet).
