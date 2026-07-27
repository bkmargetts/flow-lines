# Re-Entry

## Artist statement

A single streak of colour falls diagonally across an otherwise empty
sheet of black card: blunt, dense and molten-orange where it enters at
the bottom-left corner, thinning and cooling through gold and green to a
fine violet-blue needle that dissolves into bare black near the top
right. Nothing else is on the page. It is meant to read the way a
photograph of a spacecraft's heat shield, or a bright meteor caught on a
long exposure, reads: a blunt body punching through atmosphere, glowing
hottest at its leading face, trailing a cooling wake behind it that
thins to nothing.

That physical logic is not decoration — it is the actual shape of
atmospheric re-entry. A returning capsule is deliberately blunt-nosed,
not pointed: a blunt body pushes a standing shock wave ahead of itself
and rides on a cushion of compressed, superheated air (the "shock
layer") rather than touching the hottest gas directly, so the stagnation
point at the widest, most rounded part of the nose is where the heating
is fiercest. The trailing wake, by contrast, is where the compressed air
has already relaxed and is cooling and recombining — chemically quieter,
visually cooler. Meteor colour itself comes from what's burning: sodium
glows orange, magnesium and nickel green, calcium violet, iron yellow —
a real, if incidental, justification for a gradient that runs hot
orange through gold and green to cool violet rather than a simple
rainbow. The piece keeps that logic and drops everything diagrammatic:
no shock-cone, no trajectory arrows, no plate furniture. Just the colour
signature of the event, as a single confident mark.

This is also a deliberate turn for this studio. Every previous session
in this folder reached for a historical documentary convention —
kintsugi repair, an engraved astronomical plate, a cyanotype specimen
sheet, a Fisk-style river survey (twice), an encyclopaedia plate, a
fingerprint taxonomy chart, a Celtic knot. All of them dress an invented
subject in the authority of a real archival genre. This piece has no
genre to hide behind: no title block, no caption, no "as if surveyed"
conceit — just one gesture and a very large amount of bare paper, closer
to Barnett Newman's zip paintings or Morris Louis's poured veils than to
any of this folder's plates. It is the first purely abstract piece the
studio has produced.

It comes from the `colorField` generator, which has no CLI command yet
and was previously untouched by this studio. The generator's real trick
— interleaving several inks as parallel gratings whose local density
carries a gradient, so adjacent colours optically mix in the overlap
rather than banding hard — was built, on the evidence of its own source
comments, for a soft atmospheric wash. Run at its defaults (full-bleed,
vertical, dense) it produced something that looked like corduroy or a
gift-wrap pattern — technically smooth colour mixing, dead as a
composition, fighting this repo's own stated ethos that paper should do
most of the work. Loosening the hatch into a wide-angle fan of strokes
(so each ink runs at its own slightly different angle) made it read as
wind-blown grass or streaked rain instead — better, still a texture
sample rather than an image. The move that made it a picture was
clipping the whole field to a single hand-built mask: a `band` shape
strung as dozens of short segments along a bezier spine, each one's
half-width eased down from full at the base to nothing at the tip, so
the generator's existing gradient-and-hatch machinery paints inside a
shape that itself carries meaning — blunt heat, thinning trail — instead
of covering a rectangle. Everything else in the piece — palette, hatch
angle, wobble — is unchanged generator behaviour; only the mask is new
construction.

## Materials

- **Paper**: G. F Smith Colorplan, Ebony (black), 350gsm, A3
  (297×420mm), portrait. A dense, smooth black cover stock that takes gel
  ink cleanly without feathering and gives the four colours real
  contrast to glow against.
- **Pen 1 — Fire** (hottest, plotted first; densest at the blunt base):
  Sakura Gelly Roll Moonlight, Fire, bold 08 tip (~0.6mm laid line).
  Approximate swatch `#FF6A3D`.
- **Pen 2 — Sunflower**: Sakura Gelly Roll Moonlight, Sunflower, bold 08
  tip. Approximate swatch `#FFD23F`.
- **Pen 3 — Leaf**: Sakura Gelly Roll Moonlight, Leaf, bold 08 tip.
  Approximate swatch `#2FBF9F`.
- **Pen 4 — Wisteria** (coolest, plotted last; sparse, concentrated at
  the fine tip): Sakura Gelly Roll Moonlight, Wisteria, bold 08 tip.
  Approximate swatch `#5B57D1`.
- All four are opaque, dye-free pigment gel inks formulated for dark
  paper (the "Moonlight" line) — no wash, no other media. Nothing is
  translucent here; where strokes physically overlap, whichever pen laid
  ink down last simply sits on top, the way opaque paint markers behave
  on black card (unlike the transparent-ink layering this studio used
  for its kintsugi and river pieces).

## Process

1. Mount the A3 black sheet on the plotter bed and home the machine. Do
   not remove or reposition the paper until all four pens are done — the
   four layers share one coordinate space and only register if the sheet
   never moves.
2. Fit Pen 1 (Fire). Plot `artwork-layer-1-fire.svg` — the widest,
   densest ink, concentrated at the blunt bottom-left entry point and
   thinning out along the streak.
3. Swap to Pen 2 (Sunflower), same paper. Plot
   `artwork-layer-2-sunflower.svg` — the single largest layer by ink
   coverage, carrying the mid-streak body.
4. Swap to Pen 3 (Leaf). Plot `artwork-layer-3-leaf.svg`.
5. Swap to Pen 4 (Wisteria). Plot `artwork-layer-4-wisteria.svg` last —
   by far the sparsest layer, almost entirely confined to the narrow,
   tapered tip at the upper right.
6. Let the final layer set for a minute or two (gel ink, not wash — dry
   time is short). Float-mount on black board or frame under glass with
   a deep window mat; no other finishing. The bare card around the
   streak is the composition, not an oversight — leave it alone.

## Plot settings

- Paper: A3, portrait (297×420mm), 20mm clear margin on all sides.
- Render density: 3px/mm (repo default).
- Pen width: ~0.6mm (bold gel tip) for all four layers.
- Seed: 1 (streak geometry, hatch jitter, and wobble all derive from
  this single seed).
- Path counts: Fire 155, Sunflower 320, Leaf 201, Wisteria 41 — 717
  strokes total, short and few enough that pen-up travel is not a
  practical concern on this sheet size (a few minutes of plot time).

## Reproduction

There is no CLI command for `colorField` yet (a core-only generator) and
no built-in way to taper a `band` mask shape, so this piece calls the
core API directly from a scratch script — no source file was changed.
Run against a built checkout (`pnpm install && pnpm build`):

```js
// node reentry.mjs ./artwork
import { writeFileSync } from 'node:fs';
import {
  generateColorField,
  toSVG,
  toSVGLayers,
  pageMetrics,
  getPaperSize,
} from '@flow-lines/core'; // packages/core/dist/index.js

const OUT = process.argv[2] || './reentry';

const PX_PER_MM = 3;
const pm = pageMetrics(getPaperSize('a3'), 'portrait', PX_PER_MM);
const { widthPx: W, heightPx: H } = pm;
const MARGIN_MM = 20;
const marginPx = MARGIN_MM * PX_PER_MM;
const usableW = W - 2 * marginPx;
const usableH = H - 2 * marginPx;

const SEED = 1;

// Four inks, hottest (band-00) to coolest (band-03).
const PALETTE = ['#FF6A3D', '#FFD23F', '#2FBF9F', '#5B57D1'];
const LAYER_NAMES = ['fire', 'sunflower', 'leaf', 'wisteria'];

// The streak's spine: a shallow bow from the blunt, hot base (bottom-left)
// to the fine, cool tip (upper-right), as fractions of the usable page.
const toPx = ([fx, fy]) => ({ x: marginPx + fx * usableW, y: marginPx + fy * usableH });
const p0 = toPx([0.12, 0.86]);
const p1 = toPx([0.58, 0.42]);
const p2 = toPx([0.86, 0.12]);

const HALF_WIDTH_PX = 0.15 * Math.min(usableW, usableH);

// Overall spine direction drives both the gradient axis and the hatch
// angle, so strokes run along the streak's length.
const dxv = p2.x - p0.x;
const dyv = p2.y - p0.y;
const angleDeg = (Math.atan2(dxv, dyv) * 180) / Math.PI;

// Taper the mask: many short band segments along a quadratic bezier
// through p0-p1-p2, half-width easing from full at the blunt base to ~0
// at the tip — a single brush pass lifting off the page, not a
// constant-width tube.
function bezierPt(t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}
const TAPER_SEGS = 48;
const TAPER_PLATEAU = 0.12; // fraction of length staying full-width at the hot base
const maskShapes = [];
for (let i = 0; i < TAPER_SEGS; i++) {
  const t0 = i / TAPER_SEGS;
  const t1 = (i + 1) / TAPER_SEGS;
  const tm = (t0 + t1) / 2;
  const w = tm < TAPER_PLATEAU ? 1 : Math.cos(((tm - TAPER_PLATEAU) / (1 - TAPER_PLATEAU)) * (Math.PI / 2));
  maskShapes.push({
    type: 'band',
    path: [bezierPt(t0), bezierPt(t1)],
    halfWidthPx: Math.max(1, HALF_WIDTH_PX * w),
  });
}

const options = {
  width: W,
  height: H,
  margin: marginPx,
  seed: SEED,
  angleDeg,
  lineLengthPct: 1,
  spacingPx: 2.6,
  inkCount: PALETTE.length,
  gradientMode: 'linear',
  gradientAngleDeg: angleDeg,
  blend: 1.5,
  gradientNoiseAmpPx: 30,
  gradientNoiseScale: 0.003,
  ditherScale: 0.02,
  fill: 1,
  overprint: false,
  crossHatch: 1,
  inkAngleSpreadDeg: 14,
  jitterPx: 1.0,
  wobbleAmpPx: 7,
  wobbleWavelengthPx: 170,
  maskShapes,
  optimize: true,
};

const result = generateColorField(options);

const layerColors = {};
const layerWidths = {};
PALETTE.forEach((c, i) => {
  const layer = `band-${String(i).padStart(2, '0')}`;
  layerColors[layer] = c;
  layerWidths[layer] = 1.8; // ~0.6mm at 3px/mm — a broad gel-pen tip
});

const svgOpts = {
  layerColors,
  layerWidths,
  strokeWidth: 1.8,
  physicalWidth: `${pm.widthMm}mm`,
  physicalHeight: `${pm.heightMm}mm`,
  optimizePaths: true,
};

// One SVG per pen layer — the plottable deliverables.
const layered = toSVGLayers(result, svgOpts);
for (const { layer, svg } of layered) {
  const idx = Number(layer.split('-')[1]);
  writeFileSync(`${OUT}-layer-${idx + 1}-${LAYER_NAMES[idx]}.svg`, svg);
}

// Combined multi-colour SVG — preview only, not a plotter deliverable.
writeFileSync(
  `${OUT}-combined.svg`,
  toSVG(result, { ...svgOpts, includeBackground: true, backgroundColor: '#0B0E1A' })
);
// then: node scripts/svg-to-png.mjs reentry-combined.svg preview.png --width 2200
```

Run with `node reentry.mjs ./artwork` against a built checkout, then
rasterize `artwork-combined.svg` (not shipped in this folder — it exists
only to make `preview.png`) with `scripts/svg-to-png.mjs`.

## Wishes

- `colorField` has no CLI command at all — it's a strong generator (the
  only one in the repo that does real optical colour mixing) but
  reachable only by calling `@flow-lines/core` directly. A `flow-lines
  colorfield` command exposing the gradient/mask/ink options would open
  it up.
- Tapering a `MaskShape` — narrowing a `band`'s half-width along its own
  length — currently means hand-building dozens of shrinking segments
  outside the generator, as this piece's script does. A `band` variant
  that took a half-width *profile* (e.g. per-endpoint widths, or a
  taper-in/taper-out flag) would turn that workaround into one field and
  would likely serve future work in this folder too — most of the
  studio's strongest pieces so far have been a single tapered gesture on
  a bare sheet, and right now every one of them had to build that taper
  by hand in a scratch script.
