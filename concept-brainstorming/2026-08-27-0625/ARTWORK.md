# Packing Fraction

## Artist statement

A heap of six kinds of ball — football, basketball, volleyball, baseball,
tennis ball, ping-pong ball — tipped out and left where they fell, drawn
true to their real relative sizes (a ping-pong ball is a fifth the
diameter of a football; a basketball is very slightly larger again) with
exact hidden-line removal, so the pile reads as a real stack of spheres
rather than a flat scatter of circles.

Nothing about the composition was hand-placed. The `sports-balls`
generator (added to the toolbox but never yet used for a studio piece)
scatters ball centres inside a region, sizes them by real-world ratio,
sorts them into a depth order, and cuts every stroke that a nearer
sphere's silhouette covers. What surprised me, tuning it, was the hole:
run it dense enough and the middle of the heap goes quiet — not empty,
but thin, threaded with the faint plain circles of ping-pong and tennis
balls that have sunk into the gaps between the big ones and mostly
vanished behind them. That's not a rendering artefact, it's the actual
physics of a polydisperse pile: small grains fall into the interstices of
big ones and stop contributing much surface area, which is exactly what
"packing fraction" describes in granular materials — how much of a
volume the grains actually occupy versus how much is void. I didn't draw
that idea in; the hidden-line removal on true-to-scale spheres computed
it, and I leaned into it once I saw it, rather than smoothing it away
with a denser or more uniform pile.

The six seam families are the other reason this survived the cull: a
football's truncated-icosahedron net, a basketball's equator-and-two-
channels, a volleyball's three families of parallel panel strips, and
the baseball/tennis double-offset figure-eight (with stitch ticks on the
baseball, none on the tennis groove) all come from real ball geometry,
not a generic "sphere with lines" fallback — close up, each ball reads as
its own object, not a repeated motif. A handful of strays escaped the
heap and rolled toward the foot of the sheet, which is the one placement
decision I did make: it gives the pile somewhere to be spilling *from*,
and holds the bottom third of the sheet as clear paper the way the heap's
own quiet centre holds the middle.

## Materials

- **Paper**: GF Smith Colorplan "Racing Green" (or an equivalent deep
  bottle/racing-green card), 270gsm, A3 (297×420mm), smooth finish. Approx.
  `#1c3626` if proofing digitally — match to a real swatch before
  committing ink.
- **Ink**: Sakura Gelly Roll White (05, medium tip) gel pen — an opaque,
  slightly warm-white gel ink that sits on top of dark card instead of
  soaking in, giving the line a faint chalky relief. Approx. `#f5f0e2`.
  One pen, one width, throughout — no second colour.

## Process

1. Cut or order the Colorplan Racing Green card to A3 (297×420mm) if not
   already that size.
2. Load `artwork.svg` and plot it in the Gelly Roll White pen, tip
   0.45mm. Let the pen self-prime with a few strokes off-page first —
   gel ink skips on the first few mm of a cold nib, which would show as
   broken circles on the outer contours.
3. The plot is a single pass, single layer, single pen — no registration,
   no second colour, no wash. What comes off the plotter is the finished
   piece.
4. Let the ink cure flat and un-stacked for at least 30 minutes before
   handling; gel ink on card stays tacky longer than on paper.
5. Float-mount on a black or dark-green board, small reveal, behind
   plain glass (no mat needed — the printed border rule already frames
   the sheet).

## Plot settings

- Paper: A3, portrait, 297×420mm
- Margin: 20mm
- Pen: 0.45mm effective width (Sakura Gelly Roll White, 05 tip)
- Lines: 2,045
- Estimated pen travel: ≈4.8m

## Reproduction

Built against the core package (`pnpm --filter @flow-lines/core build`),
then run from the repo root with `node <script>.mjs`. `sports-balls` has
no CLI command yet, so this drives `packages/core/dist/index.js` directly
— the same pattern as the repo's other core-only galleries
(`scripts/city-gallery.mjs`).

```js
// packing-fraction.mjs — run from the repo root after
// `pnpm --filter @flow-lines/core build`.
import { writeFileSync } from 'node:fs';
import {
  generateSportsBalls,
  toSVG,
  getPaperSize,
  pageMetrics,
  pageBorder,
  orderPlot,
} from './packages/core/dist/index.js';

const paper = getPaperSize('a3');
const pm = pageMetrics(paper, 'portrait', 3); // BASE_PX_PER_MM
const MM = pm.pxPerMm;
const MARGIN_MM = 20;
const margin = MARGIN_MM * MM;
const PEN_MM = 0.45;

const mix = { soccer: 1, basketball: 1, volleyball: 0.85, baseball: 0.6, tennis: 0.45, pingpong: 0.25 };

// The heap: a true-to-scale pile confined to a soft-edged oval in the
// upper two-thirds of the sheet.
const mound = { kind: 'ellipse', cx: 0.5, cy: 0.46, rx: 0.4, ry: 0.3 };
const pile = generateSportsBalls({
  width: pm.widthPx,
  height: pm.heightPx,
  margin,
  seed: 1,
  count: 110,
  trueSizes: 0.78,
  clustering: 0,
  minSeparation: 3.2 * MM,
  ballScale: 30 * MM,
  scaleVariance: 0.25,
  depthGrade: 0.2,
  region: mound,
  softRegionEdge: true,
  castShadows: 0.7,
  shading: 0.3,
  mix,
  penWidth: PEN_MM * MM,
  wobble: 0.7,
  optimize: false, // reorder once, after merging with the spill
});

// A few strays that escaped the heap, rolling toward the foot of the
// sheet — same true-scale mix, independent placement well clear of the
// main mound.
const spillRegion = { kind: 'ellipse', cx: 0.4, cy: 0.9, rx: 0.22, ry: 0.06 };
const spill = generateSportsBalls({
  width: pm.widthPx,
  height: pm.heightPx,
  margin,
  seed: 501,
  count: 6,
  trueSizes: 0.78,
  clustering: 0,
  minSeparation: 10 * MM,
  ballScale: 28 * MM,
  scaleVariance: 0.3,
  depthGrade: 0,
  region: spillRegion,
  softRegionEdge: true,
  castShadows: 0.5,
  shading: 0.3,
  mix,
  penWidth: PEN_MM * MM,
  wobble: 0.7,
  optimize: false,
});

const border = pageBorder({
  width: pm.widthPx,
  height: pm.heightPx,
  marginPx: margin,
  layer: 'border',
});

const merged = orderPlot({
  lines: [...pile.lines, ...spill.lines, ...border],
  width: pm.widthPx,
  height: pm.heightPx,
  seed: 1,
});

const svg = toSVG(merged, {
  strokeColor: '#000000',
  strokeWidth: PEN_MM * MM,
  physicalWidth: `${paper.widthMm}mm`,
  physicalHeight: `${paper.heightMm}mm`,
});

writeFileSync('artwork.svg', svg);
```

```sh
node packing-fraction.mjs
node scripts/svg-to-png.mjs artwork.svg preview.png --width 1600 \
  --background '#1c3626' --stroke '#f5f0e2'
```

Re-running the script above (verified during this session) reproduces
`artwork.svg` byte-for-byte — `generateSportsBalls` draws every ball's
identity, size and rotation from fixed per-ball sub-seed streams, so the
result is exact regardless of build machine.

## Wishes

- `sports-balls` has no CLI command yet (unlike `botanical`/`planet`/
  `landscape`), so this piece had to be driven from a scratch script
  against the built core package like the other core-only generators
  (city, ribbon-weave, etc). A `flow-lines balls` command would match the
  rest of the toolbox.
- There's no way to pin a specific ball type to a specific placement
  index (type is drawn from a per-index weighted random stream) — fine
  for a naturalistic pile, but it means a deliberate one-of-each
  "specimen" layout (which I considered and set aside in favour of the
  heap) would need six separate calls merged by hand rather than one.
