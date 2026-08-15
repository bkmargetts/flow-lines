# Wake

## Artist statement

In 1911, Theodore von Kármán — then a young researcher in Ludwig
Prandtl's aerodynamics lab at Göttingen — was asked to explain a
photograph one of his colleagues had taken of water flowing past a
cylinder. Instead of a single tidy trail, the dye showed two rows of
alternating whirlpools peeling off the obstacle and drifting downstream,
each one spinning opposite to its neighbours. Von Kármán worked out why
that staggered, self-sustaining pattern is the *only* stable way for a
wake to arrange itself, and the phenomenon has carried his name ever
since. You have almost certainly seen it without knowing the term:
satellite photographs of clouds trailing off a lone Pacific island in a
long double chain of commas are von Kármán streets, the same physics
Prandtl's lab first inked onto paper from a dye tank, playing out at the
scale of weather.

This repo's `complex-flow` generator has never been used in a
brainstorming run before — a genuine gap given how much of this project
loves a confident line. It reads a page as the complex plane and traces
streamlines through a rational function whose zeros and poles you place
by hand, in pixel coordinates, like planting flags. A zero pulls flow
outward from a point; a pole spins it into a tight vortex before the
tracer's step budget runs out. Six of them, alternating zero-pole-zero
down a staggered row with the vertical offset between the two ranks
growing steadily left to right, is enough to fake a von Kármán street
convincingly: small, tight, orderly commas at the left edge — where an
unseen obstacle has just shed them — opening out into big, loose,
breaking-wave curls by the right, exactly the way a real wake loses
coherence and grows as it drifts from its source. Nothing in the
generator *is* fluid dynamics; it's rational-function algebra pretending
to be Prandtl's dye tank, and the resemblance is close enough that I
kept checking the render against actual island-wake satellite photographs
while tuning it.

Getting the growth right took real trial and error. An evenly-spaced row
of six identical vortices (kept in the discard pile) reads as wallpaper —
correct topology, no narrative, the eye finds the repeat instantly and
stops looking. Widening the seed-row count to add texture in the calm
bands above and below the street (also discarded, several passes)
flooded the whole sheet with overlapping ink until the calm bands went
solid black edge to edge — exactly the failure this repo's CLAUDE.md
warns about, marks doing what restraint should be doing, paper stopped
carrying any of the weight. What survived is the plainest idea: six
singularities, one parameter — the vertical spread between each
zero-pole pair — increasing monotonically along the row. That alone
turns a decorative pattern into a place something happened: a small
disturbance born at the left, growing, slowing, and finally breaking
into the loose, wave-crested shape on the right that a real wake takes
once it's dissipated enough to stop being tidy. The tight white pinhole
at the centre of the two sharpest vortices is not a rendering error — a
tracer physically cannot spiral all the way into a singularity, so it
leaves a true, undrawn eye at each vortex core, the one piece of the
image the algorithm couldn't have faked even if I'd wanted it to.

## Materials

- **Paper** — Fabriano Artistico Extra White, 300 gsm, Hot Press, A3
  (420 × 297 mm), landscape.
- **Ink** — one pen only: De Atramentis Document Ink, colour
  *Blue-Black* — a waterproof, lightfast pigment ink safe in a technical
  pen (it will not clog a Rotring Rapidograph the way many fountain
  inks do). Loaded at 0.3 mm nib width. Hex reference for screen
  preview: `#16283f`, a deep Prussian blue-black — close enough to true
  black at a glance that the piece reads as ink-on-paper first and
  "blue" only on a second look, but with just enough colour to carry
  the water/weather association the image is already making on its own.
- Nothing else: no wash, no second pass, no mount board specified. The
  drawing's entire tonal range — bare paper through the near-solid dark
  bands to the packed vortex cores — comes from stroke density alone,
  the same single pen throughout.

## Process

1. Tape the A3 Fabriano Artistico sheet flat to the plotter bed, all
   four corners, hot-press side up.
2. Load the technical pen with De Atramentis Document Ink, Blue-Black,
   at 0.3 mm.
3. Plot `artwork.svg` in a single pass. One pen, one width, the whole
   file — no layer swap, no re-registration.
4. Let the pigment ink cure per the ink's guidance (De Atramentis
   document inks are fast-setting; a few minutes is generally enough,
   longer if the room is cold or humid).
5. Float-mount in a plain dark or near-black frame, generous white
   mount board (60–80 mm), non-glare glazing. No further embellishment —
   the piece is quiet enough on its own that a busy mount would fight it.

## Plot settings

- Paper: A3, 420 × 297 mm, landscape
- Margin: 25 mm
- Pen: single pen, 0.3 mm, single pass
- Render resolution: 3 px/mm (repo default, `BASE_PX_PER_MM`)
- Seed: 9
- Output: 2,202 strokes, single layer, ≈3.3 m of pen travel (already
  reorder-optimised by the generator's own default `orderPlot` pass —
  streamlines are continuous flow lines, not discrete shapes, so full
  endpoint chaining isn't applicable here; reordering alone is what the
  generator does)

## Reproduction

Deterministic from one seed (`9`) and one hand-placed set of six
zero/pole pairs. Build the repo, save the script below as `wake.mjs` in
the repo root, then run:

```sh
pnpm install && pnpm build
node wake.mjs concept-brainstorming/2026-08-15-0621
```

This writes `artwork.svg` byte-for-byte identical to the committed file.

`wake.mjs`:

```js
// "Wake" — a von Karman vortex street rendered as a rational-function
// flow field (complex-flow generator), hand-placed poles/zeros standing
// in for alternating vortex cores shed behind an unseen obstacle,
// growing and slowing downstream. No code changes: generateComplexFlow
// + toSVG exactly as the CLI/web layer would call them.
//
// Run from repo root after `pnpm build`:
//   node wake.mjs <outDir>
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { generateComplexFlow, toSVG, getPaperSize, pageMetrics, measurePenTravel } =
  await import(resolve(process.cwd(), 'packages/core/dist/index.js'));

const OUT_DIR = resolve(process.argv[2] ?? '.');

const PXPERMM = 3;
const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'landscape', PXPERMM);
const { widthPx: W, heightPx: H, widthMm, heightMm } = metrics;

const SEED = 9;
const N = 6;
const X0 = 0.14, X1 = 0.86;
const ROW_Y = H * 0.5;
const SPREAD0 = 0.05, SPREAD1 = 0.11;

// Alternating zero/pole pairs along the row, spreading apart (growing
// vortex amplitude) left to right — a wake that widens and slows as it
// moves downstream, the way a real vortex street decays with distance
// from the obstacle that shed it.
const manualZerosPx = [];
const manualPolesPx = [];
for (let i = 0; i < N; i++) {
  const t = i / (N - 1);
  const x = W * (X0 + (X1 - X0) * t);
  const spread = H * (SPREAD0 + (SPREAD1 - SPREAD0) * t);
  const yTop = ROW_Y - spread;
  const yBot = ROW_Y + spread;
  if (i % 2 === 0) {
    manualZerosPx.push({ x, y: yTop });
    manualPolesPx.push({ x, y: yBot });
  } else {
    manualPolesPx.push({ x, y: yTop });
    manualZerosPx.push({ x, y: yBot });
  }
}

const MARGIN_MM = 25;
const PEN_MM = 0.3;
const STROKE_HEX = '#16283f'; // deep Prussian blue-black pigment ink

const result = generateComplexFlow({
  width: W,
  height: H,
  margin: MARGIN_MM * PXPERMM,
  seed: SEED,
  zeroCount: 0,
  poleCount: 0,
  zeroLayout: 'random',
  poleLayout: 'random',
  singularitySpread: 0.5,
  planeScale: 1.3,
  fieldRotation: 0,
  manualZerosPx,
  manualPolesPx,
  seedLayout: 'lines',
  seedCount: 2200,
  stepsPerDir: 260,
  stepLength: 1.6,
  stepJitter: 0.4,
  wobble: 0,
  speedClampMax: 1200,
  minLineLength: 10,
  layerCount: 1,
  layerBy: 'seedBand',
});

const svg = toSVG(result, {
  strokeColor: STROKE_HEX,
  strokeWidth: PEN_MM * PXPERMM,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
});

writeFileSync(`${OUT_DIR}/artwork.svg`, svg);
const travelMm = measurePenTravel(result) / PXPERMM;
console.log(`${result.lines.length} strokes, ${(travelMm / 1000).toFixed(1)}m pen travel -> ${OUT_DIR}/artwork.svg`);
```

`preview.png` was rendered with:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-08-15-0621/artwork.svg \
  concept-brainstorming/2026-08-15-0621/preview.png \
  --width 1800 --background '#fbf8f2' --stroke '#16283f'
```

approximating the Fabriano Artistico Extra White sheet and the De
Atramentis Blue-Black line.

## Candidates considered

- **Default Savva-style ring layout** (3 auto zeros, 2 auto poles on
  `ring` layouts, no manual placement) — produces an elegant single
  tadpole/fish shape, but the streamlines that reach the page margin
  before their step budget runs out get clipped into a fringe of short
  jagged bristles along one edge. Reads as a rendering artifact, not a
  drawn line. Discarded.
- **Single dipole** (one zero, one pole, nothing else) — a clean
  saddle-point flow, genuinely handsome, closer to a textbook diagram of
  a magnetic dipole than a wake. Calm and symmetric where the brief
  wanted movement and asymmetry. Kept as a mental fallback, not used.
- **Five random zeros + five random poles at high rotation** — turbulent
  and busy, no legible structure to hold onto, the kind of "the computer
  did something" image the repo's own quality bar explicitly warns
  against. Discarded immediately.
- **Evenly-spaced six-vortex row, constant spacing** — topologically
  identical to the final piece, but with every vortex the same size.
  Technically the closest to a "real" von Kármán street (which does
  repeat), but as a drawing it reads as a swatch of pattern rather than
  a specific event — the eye finds the repeat unit in a few seconds and
  disengages. Discarded in favour of the growing-spacing version.
- **More seed rows via a higher `layerCount`** (14–16, used only to
  multiply the `lines` seed layout's row count, not for colour) — filled
  in the calm bands above and below the vortex row with enough
  overlapping streamlines that they went solid black edge to edge, and
  the vortices themselves lost the clean white cores that make them read
  as vortices rather than ink blots. Discarded; six rows (the layout's
  own default when `layerCount` is left at 1) was the right density.
- **A seventh singularity pair standing in for the shedding obstacle
  itself** (an extra pole at the left edge, upstream of the row) — meant
  to imply the "island," but it just produced an extra, ungrounded
  swirl that competed with the real vortex row for attention without
  reading as an obstacle. The wake works better with its cause left
  offstage, the way the photograph never shows the island either, just
  the trail of clouds behind it.

## Wishes

- `manualZerosPx` / `manualPolesPx` take raw page-pixel coordinates, so
  every hand-placed composition has to recompute its layout by hand if
  the page size or orientation changes (as this piece's script does with
  `W`/`H` fractions). A normalized-fraction placement option — the same
  0..1-of-drawable-box contract `StickmenRegion` already uses elsewhere
  in the repo — would make hand-authored singularity layouts portable
  across paper sizes the way region-based placement already is for the
  stick-figure and sports-balls generators.
- `seedLayout: 'lines'` always spans the full page height; there's no
  way to concentrate extra seed rows inside a sub-band (e.g. "just the
  turbulent middle third") without also multiplying rows in the calm
  regions above and below, which is what caused the "flooded to black"
  failure mode logged above. A row-count-independent-of-band-extent
  option, or a `seedRegion` bounding box for the `lines`/`grid` layouts,
  would let a composition add detail exactly where the field is doing
  something interesting without also over-inking the quiet parts.
