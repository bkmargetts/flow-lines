# Littoral

## Artist statement

`landscape` is the most heavily engineered generator in this repository —
massing, value bands, streamline hatching, faceted hatch, atmospheric
haze, calm water, contour halos, all of it built and documented at
length in CLAUDE.md — and in twenty-nine prior studio sessions nobody
had ever actually used it for a piece. That gap was the starting point
here: not "make a nice landscape," but find the idea this particular
engine, and no other, could carry.

The generator takes a `waterFrac` parameter — the share of the frame
below the horizon that's given to water. Nudge it and the shoreline
slides up or down the sheet; everything else (the ridgeline, the
headland, the foreground cliff, the horizon) stays exactly where it
was, because none of it is computed from the water level. That's an
unusual property for a knob to have, and it's exactly what a tide does
to a real coast: the water advances and retreats, the land doesn't move
at all. So the piece plots the *same* coastline twice from the *same*
seed — once at `waterFrac 0.6` (a full tide), once at `waterFrac 0.26`
(an ebb) — in two inks, registered on one sheet. Everywhere the two
tides' water coincides, the inks cross-hatch into a dense, doubled
passage: water that never uncovers, the true sea. In the band between
the two shorelines, only the flood ink appears — ground the sea claims
only at high water. The sepia shoreline itself, plotted from the ebb
pass alone, cuts across the flood's cross-hatch like a chart's tide
datum line, exactly the mark an actual hydrographic survey draws to
record where the water stops.

The discard pile taught me most of what's in the final piece. An early
pass tried genuinely different scenes for each tide (different seeds,
different ridge params) rather than one seed at two water levels — the
two plates didn't relate to each other at all once overprinted, just
two unrelated drawings sharing a sheet. A pass with the sky hatch left
at the generator's picture-book defaults (`skyToneTop 0.42` /
`skyToneHorizon 0.68`, brighter near the water than the top) put the
most ink exactly where this piece needed the most quiet, so I inverted
the gradient and pulled both values down — the sky reads as a flat,
overcast working light now, not a sunset, which suits a piece about
measurement rather than mood. I also tried threading the generator's
own beach-hatch texture through the exposed foreshore in sepia, and
kept hitting the same wall: the generator tags that hatch with the same
layer name as the mountain hatch, so pulling one in without duplicating
the other isn't reachable from configuration alone. I let it go rather
than fight the tool, and I'm glad I did — the exposed band reading as
bare paper, with only a rock and the tide-line to mark it, is quieter
and more convincing than a second texture would have been. The one
rule that survived every cull: the land never gets inked twice. Only
the two tides do.

*Littoral*, n. — of or belonging to the shore; the zone between the
lines of high and low water. The word names exactly the strip this
piece exists to draw, and nothing else.

## Materials

- **Paper** — Fabriano Tiziano, colourway *Perla* (pearl grey), 160gsm
  mould-made pastel/printmaking stock, A3 (420 × 297mm), landscape. A
  cool, matte, slightly toothed grey reads as overcast coastal light
  and keeps both inks true — white paper would have pushed the sepia
  ink warm and the piece toward "sunset postcard," which is exactly
  what it isn't. Hex reference for the preview: `#e3e0d7`.
- **Ink 1 — "Flood"**: Diamine Prussian Blue, a genuine 19th-century
  chart pigment — the base plate: the whole scene (sky, ridgeline,
  headlands, foreground cliff, horizon, and the sea at high water).
  Hex reference: `#123a56`. Loaded in a technical pen at 0.35mm.
- **Ink 2 — "Ebb"**: Diamine Sepia, warm and dark enough to read clearly
  against both the paper and the Prussian blue — the second plate:
  only the water, its reflection glints, the exposed rocks, and the
  low-tide shoreline. Hex reference: `#6b4226`. Same technical pen,
  same 0.35mm nib, second cartridge.
- Nothing else — no wash, no mount board specified, no third pass. The
  entire tonal range is built from stroke density and the two-ink
  overprint alone.

## Process

1. Tape the A3 Fabriano Tiziano Perla sheet flat and square to the
   plotter bed, all four corners.
2. Load the technical pen with Diamine Prussian Blue at 0.35mm.
3. Plot `artwork-layer-1-flood.svg` — one pass, the complete scene at
   high tide (sky through the foreground cliff, and the sea as far as
   it reaches at `waterFrac 0.6`). Four small registration crosses plot
   in the corners on this pass too, 6mm from the paper edge, inside the
   margin.
4. Let the Prussian blue set (a few minutes is generally enough for a
   pigment/dye technical-pen ink; longer in a cold or humid room).
5. Without moving the paper, swap to the same pen loaded with Diamine
   Sepia, 0.35mm.
6. Plot `artwork-layer-2-ebb.svg` on the same sheet. Its own
   registration crosses land exactly on top of the blue ones already
   on the paper — check all four corners before letting the pen run;
   if they don't align, the paper shifted and the pass should be
   re-registered rather than plotted. This layer draws only the water,
   its reflection glints, the exposed rocks, and the ebb shoreline at
   `waterFrac 0.26` — nothing from the land is redrawn.
7. Let the sepia set, then unpin.
8. Float-mount in a plain dark frame, generous pale mount board
   (50–70mm), non-glare glazing. No further embellishment — the piece
   is a measurement, not a scene, and a busy mount would fight that.

## Plot settings

- Paper: A3, 420 × 297mm, landscape
- Margin: 22mm; registration crosses 6mm from the paper edge
- Pen: single technical pen, 0.35mm, two inks in sequence (no width
  change between passes)
- Render resolution: 3 px/mm (repo default, `BASE_PX_PER_MM`)
- Seed: 42 (both passes — the land geometry is identical between them;
  only `waterFrac` differs)
- Tide levels: flood `waterFrac 0.6`, ebb `waterFrac 0.26`
- Output — Layer 1 (Flood): 1,638 strokes (1,630 scene + 8 registration),
  ≈9.9m pen travel. Layer 2 (Ebb): 344 strokes (336 scene + 8
  registration), ≈3.0m pen travel. Both already reorder-optimised
  (`orderPlot`/the generator's internal `optimize`) — hatching and
  contours are continuous bands, not discrete shapes, so full endpoint
  chaining doesn't apply here; nearest-neighbour reordering does the
  travel reduction.

## Reproduction

Deterministic from one seed (`42`) and two `waterFrac` values (`0.6`
flood, `0.26` ebb). Build the repo, save the script below as
`littoral.mjs` in the repo root, then run:

```sh
pnpm install && pnpm build
node littoral.mjs concept-brainstorming/2026-08-18-0625
```

This writes `artwork-layer-1-flood.svg` and `artwork-layer-2-ebb.svg`
byte-for-byte identical to the committed files (it also writes a
`_preview-composite.svg` used to render `preview.png` — not part of the
plottable artwork, delete it after regenerating the preview).

`littoral.mjs`:

```js
// "Littoral" — a coastline plotted twice, same seed, two water levels
// (flood / ebb), two inks, registered on one A3 sheet. No code changes —
// pure configuration over generateLandscape + toSVG + registrationCrosses.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const {
  generateLandscape,
  toSVG,
  getPaperSize,
  pageMetrics,
  orderPlot,
  registrationCrosses,
  measurePenTravel,
} = await import(resolve(process.cwd(), 'packages/core/dist/index.js'));

const OUT_DIR = resolve(process.argv[2] ?? '.');
const PXPERMM = 3;
const MARGIN_MM = 22;
const CROSS_OFFSET_MM = 6;
const PEN_MM = 0.35;

const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'landscape', PXPERMM);
const { widthPx: W, heightPx: H, widthMm, heightMm } = metrics;
const marginPx = MARGIN_MM * PXPERMM;

const TIDE_LAYERS = new Set(['water', 'reflection', 'rock', 'contour']);

const SEED = 42;
const WATER_HIGH = 0.6;
const WATER_LOW = 0.26;

const FLOOD_INK = '#123a56'; // Diamine Prussian Blue
const EBB_INK = '#6b4226'; // Diamine Sepia

const base = {
  width: W,
  height: H,
  margin: marginPx,
  seed: SEED,

  horizonFrac: 0.36,
  horizonWobble: 3,
  horizonFreq: 1.8,
  hasWater: true,

  sun: false,
  moonRim: false,
  reflection: true,
  reflectionWidth: 18,

  ridgeCount: 3,
  ridgeAmp: 26,
  ridgeFreq: 1.7,
  ridgeOctaves: 4,
  ridgePersistence: 0.48,
  ridgeSharpness: 0.3,
  formFollow: true,
  atmosphere: 0.65,

  headlands: 3,
  foreground: 0.38,
  foregroundSide: 'left',
  focus: 0.4,

  toneContrast: 0.5,
  crossHatch: 1,
  hatchPatchiness: 0.55,
  taper: 0.55,

  skyHatchSpacing: 7,
  skyToneTop: 0.4,
  skyToneHorizon: 0.22,

  rocks: 5,
  rockMaxSize: 24,
  rockHatchSpacing: 3.5,

  birds: 0,

  penWidth: PEN_MM * PXPERMM,
  wobble: 0.45,
};

const resultHigh = generateLandscape({ ...base, waterFrac: WATER_HIGH });
const resultLow = generateLandscape({ ...base, waterFrac: WATER_LOW });

const crosses = registrationCrosses(W, H, marginPx, CROSS_OFFSET_MM * PXPERMM, PXPERMM);

// ---- Layer 1 — "Flood": the complete high-tide scene, Prussian blue ----
const floodResult = { ...resultHigh, lines: [...resultHigh.lines, ...crosses] };
const floodSvg = toSVG(floodResult, {
  strokeColor: FLOOD_INK,
  strokeWidth: PEN_MM * PXPERMM,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});
writeFileSync(resolve(OUT_DIR, 'artwork-layer-1-flood.svg'), floodSvg);

// ---- Layer 2 — "Ebb": tide-only lines from the low-tide call, sepia ----
const ebbLinesRaw = resultLow.lines.filter((l) => TIDE_LAYERS.has(l.layer ?? ''));
const ebbOrdered = orderPlot({ lines: ebbLinesRaw, width: W, height: H });
const ebbResult = { ...ebbOrdered, lines: [...ebbOrdered.lines, ...crosses] };
const ebbSvg = toSVG(ebbResult, {
  strokeColor: EBB_INK,
  strokeWidth: PEN_MM * PXPERMM,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});
writeFileSync(resolve(OUT_DIR, 'artwork-layer-2-ebb.svg'), ebbSvg);

// ---- Combined preview (both inks, registered, multiply blend) ----
const aLines = resultHigh.lines.map((l) => ({ ...l, layer: `A_${l.layer ?? 'default'}` }));
const bLines = ebbLinesRaw.map((l) => ({ ...l, layer: `B_${l.layer ?? 'default'}` }));
const combined = { ...resultHigh, lines: [...aLines, ...bLines] };
const layerColors = {};
const layerBlend = {};
for (const l of aLines) { layerColors[l.layer] = FLOOD_INK; layerBlend[l.layer] = 'multiply'; }
for (const l of bLines) { layerColors[l.layer] = EBB_INK; layerBlend[l.layer] = 'multiply'; }
const previewSvg = toSVG(combined, {
  strokeColor: '#000',
  strokeWidth: PEN_MM * PXPERMM,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
  layerColors,
  layerBlend,
  includeBackground: true,
  backgroundColor: '#e3e0d7',
});
writeFileSync(resolve(OUT_DIR, '_preview-composite.svg'), previewSvg);

const floodTravelM = measurePenTravel(floodResult) / PXPERMM / 1000;
const ebbTravelM = measurePenTravel(ebbResult) / PXPERMM / 1000;
console.log(
  'flood lines', floodResult.lines.length, `(${floodTravelM.toFixed(1)}m travel)`,
  '| ebb lines', ebbResult.lines.length, `(${ebbTravelM.toFixed(1)}m travel)`,
);
```

`preview.png` was rendered from `_preview-composite.svg` with:

```sh
node scripts/svg-to-png.mjs _preview-composite.svg preview.png --width 2000
```

## Wishes

- The beach/foreshore hatch inside `generateLandscape` shares its layer
  tag (`'ridge'`) with the mountain-ridge hatch (`packages/core/src/landscape/index.ts`,
  the `beach = () => hatchGround(...)` call around line 403 vs. the
  ridge-band hatch that also emits `layer: 'ridge'`). That made it
  impossible, from configuration alone, to pull in "the exposed
  foreshore's own texture" for the ebb plate without also duplicating
  the mountain hatch already inked by the flood plate. A distinct layer
  tag for the ground/beach band (e.g. `'ground'`) would let a future
  tide-style piece texture the intertidal zone directly instead of
  leaving it as bare paper — which reads well here, but is a
  restriction this run worked around rather than one it chose.
