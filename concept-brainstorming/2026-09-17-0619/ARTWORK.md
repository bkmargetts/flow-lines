# Loose Ball

## Artist statement

`sports-balls` is the last of this repo's ten core-only object generators
nobody had ever driven from a scratch script — city, ribbon-weave,
stickmen, complex-flow, reaction-diffusion, lenia, physarum, color-field
and overlapped-lines all have a studio piece behind them; a pile of
orthographically-projected spheres with type-specific seam curves
(a truncated-icosahedron net for a football, channel lines for a
basketball, panel strips for a volleyball, figure-eight stitching for a
baseball or tennis ball) and exact hidden-line removal did not. Run at
its defaults it does exactly what its name promises: a scatter of balls
filling the page. That's a fine test render and a weak drawing — a heap
of clip-art spheres, no reason to look twice.

Two things in its option list turned it into something else. First,
`trueSizes` — a knob that blends uniform ball diameters toward real-world
relative ones, so a basketball actually dwarfs a ping-pong ball on the
page the way it does on a shelf. Second, `minSeparation` — a soft minimum
gap the layout keeps between every pair of centres, *the same absolute
distance regardless of the ball's own size*. Turn both on together and
something the option docs never promise falls out for free: a tiny
ping-pong or tennis ball needs just as much clear ground around it as a
basketball does, so in a crowded cluster the small ones are the first to
get rejected out toward the empty page, while the big three (soccer,
basketball, volleyball — close enough in real diameter to pack tightly)
settle and stay put. Nobody wrote "small balls scatter, big balls
cluster" into this generator. It's what the geometry does on its own
once size means something.

That's a real observation about loose balls — the small bouncy ones
really do roll further and hide better than a dropped football — and a
sports term already exists for the exact moment this drawing depicts: a
*loose ball*, live and uncontrolled, nobody's possession, up for grabs.
So rather than leave the good behaviour to chance in one big scatter, I
art-directed it: one `generateSportsBalls` call, region-confined to a
tight patch in the lower-left corner, draws the settled pile — heavy
overlap, real relative sizes, the big three dominant. A second,
independent call — different seed, a `mix` weighted to nothing but
baseball/tennis/ping-pong, region-confined to a widening polygon reaching
up and away from the pile — draws the escapees. Merging their line sets
onto one sheet (the toolbox's own sanctioned move: "render two generators
to the same sheet and merge their line sets") turns a physically-true
emergent quirk into a composed, readable image: a pile that just got hit,
and the smallest, liveliest pieces of it still in the air.

Twenty-some seed pairs went through this two-call rig at contact-sheet
scale before 101/102 survived: the pile reads as *balls*, not a scribble
— two football nets and a basketball's channel lines stay legible through
the overlap — and the scatter's spacing has the loose, irregular rhythm
of an actual bounce rather than an evenly-jittered scatter plot. Cast
shadows and terminator shading (`castShadows`, `shading`) do the rest of
the work of selling volume: without them the piles are outline soup;
with them each sphere reads as a sphere, lit from one shared upper-right
sky, the way a coach's chalk diagram never bothers to render but an
actual ink illustrator always would.

## Materials

- **Paper**: A3 (420 × 297 mm, landscape), GF Smith Colorplan "Ebony"
  270gsm smooth black card — matte, not a photo-black, so paint-marker
  ink beads and dries clean rather than pooling.
- **Ink 1 — linework** (outlines + seam curves): Posca PC-3M paint
  marker, White (~1.0mm bullet tip). Hex reference `#f7f4ee` (a warm,
  slightly off white — pure white paint markers read chalky against
  black card, and that's the point here).
- **Ink 2 — shading** (terminator rings + cast-shadow crescents): Posca
  PC-1M paint marker, Warm Grey (~0.6mm extra-fine tip). Hex reference
  `#9c948a`.
- Low-tack tape (e.g. artist's tape) to pin the sheet to the plotter bed
  across both passes; a fine brush or blower to clear any card dust
  before inking (paint-marker ink shows every stray fibre on black
  stock).

## Process

1. Tape the Colorplan Ebony sheet to the plotter bed, A3 landscape.
   Do not move it until step 3 is done.
2. Load the plotter with the Posca PC-1M Warm Grey marker. Plot
   `artwork-grey.svg` — the shading pass only (terminator rings on each
   ball's shadow side, cast-shadow crescents where a nearer ball
   overlaps a farther one). This goes down first so the white linework
   sits crisply on top of it, the way a soft under-shadow sits beneath
   confident ink lines in a real drawing.
3. Swap to the Posca PC-3M White marker, same sheet, same bed position.
   Plot `artwork-white.svg` — every outline circle and every seam curve
   (football pentagons/hexagons, basketball channels, volleyball panel
   strips, baseball/tennis figure-eight stitching).
4. Let the paint-marker ink cure at least 30 minutes flat before
   handling — Posca ink stays soft-touch longer than a gel or fineliner
   pass, especially over another still-fresh layer.
5. Float-mount on black or dark charcoal board, generous margin, no
   glazing that would kill the paint marker's slight sheen against the
   matte card.

`artwork.svg` is a combined reference file (both passes, each in its own
ink colour, one document) — useful for proofing registration on screen;
it is not itself a plot file.

## Plot settings

- Paper: A3, landscape (420mm × 297mm), margin 18mm.
- Pen widths: linework (white) ≈ 1.0mm effective line; shading (grey)
  ≈ 0.6mm effective line — two widths, one width per layer, no
  stroke-width trickery.
- Estimated pen travel (pen-up, at this page scale): linework pass
  ≈ 1.7m, shading pass ≈ 1.4m. Both passes are short single-A3 plots;
  neither needs tiling.
- Determinism: cluster seed `101`, scatter seed `102`. Every line in
  both SVGs is a byte-identical function of the script below.

## Reproduction

Built entirely from `packages/core`'s `sports-balls` module, which has
no CLI command yet — this is the scratch-script pattern the toolbox
describes for core-only generators. Requires `pnpm --filter
@flow-lines/core build` first.

```js
import { writeFileSync } from 'node:fs';
import {
  generateSportsBalls,
  toSVG,
  pageMetrics,
  getPaperSize,
  orderPlot,
} from '@flow-lines/core'; // packages/core/dist/index.js

const paper = getPaperSize('a3');
const pm = pageMetrics(paper, 'landscape'); // 420x297mm, 1260x891px @ 3px/mm
const marginMm = 18;
const margin = Math.round(marginMm * pm.pxPerMm);
const w = pm.widthPx, h = pm.heightPx;

const sprayPolygon = (apex, wide1, wide2) => ({ kind: 'polygon', points: [apex, wide1, wide2] });
const bigMix = { soccer: 1, basketball: 1, volleyball: 1, baseball: 0.25, tennis: 0.2, pingpong: 0.1 };
const smallMix = { soccer: 0, basketball: 0, volleyball: 0, baseball: 1, tennis: 1, pingpong: 1.3 };

// The settled pile — heavy overlap, real relative sizes, big three dominant.
const clusterOpts = {
  seed: 101, count: 17, clustering: 0.55, minSeparation: 40, ballScale: 115,
  scaleVariance: 0.14, trueSizes: 1, depthGrade: 0.2, shading: 0.55, castShadows: 0.75, spin: 1,
  mix: bigMix, penWidth: 2.8,
  region: { kind: 'ellipse', cx: 0.13, cy: 0.76, rx: 0.11, ry: 0.19 }, softRegionEdge: true,
};
// The escapees — small types only, spread across a widening polygon.
const scatterOpts = {
  seed: 102, count: 26, clustering: 0.08, minSeparation: 48, ballScale: 58,
  scaleVariance: 0.3, trueSizes: 1, depthGrade: 0.06, shading: 0.35, castShadows: 0.25, spin: 1,
  mix: smallMix, penWidth: 2.8,
  region: sprayPolygon({ x: 0.20, y: 0.72 }, { x: 0.99, y: 0.30 }, { x: 0.72, y: 0.98 }),
  softRegionEdge: true,
};

const cluster = generateSportsBalls({ width: w, height: h, margin, ...clusterOpts });
const scatter = generateSportsBalls({ width: w, height: h, margin, ...scatterOpts });
const allLines = [...cluster.lines, ...scatter.lines];

const WHITE = '#f7f4ee';
const GREY = '#9c948a';
const strokeWidthWhite = 3.0; // ~1.0mm Posca PC-3M at 3px/mm
const strokeWidthGrey = 1.8;  // ~0.6mm Posca PC-1M at 3px/mm

// Reorder each physical pass separately for minimal pen-up travel
// (reorder-only — these are discrete shapes, never chain-fused).
const linework = orderPlot({
  lines: allLines.filter((l) => l.layer !== 'shading'),
  width: w, height: h, seed: clusterOpts.seed,
});
const shading = orderPlot({
  lines: allLines.filter((l) => l.layer === 'shading'),
  width: w, height: h, seed: scatterOpts.seed,
});

const svgOpts = { physicalWidth: `${pm.widthMm}mm`, physicalHeight: `${pm.heightMm}mm` };

writeFileSync('artwork-white.svg', toSVG(linework, { ...svgOpts, strokeColor: WHITE, strokeWidth: strokeWidthWhite }));
writeFileSync('artwork-grey.svg', toSVG(shading, { ...svgOpts, strokeColor: GREY, strokeWidth: strokeWidthGrey }));

// Combined reference (both inks, one document, not itself a plot file).
const combined = orderPlot({ lines: allLines, width: w, height: h, seed: clusterOpts.seed });
writeFileSync('artwork.svg', toSVG(combined, {
  ...svgOpts,
  strokeColor: WHITE,
  strokeWidth: strokeWidthWhite,
  layerColors: { outline: WHITE, seams: WHITE, shading: GREY },
  layerWidths: { outline: strokeWidthWhite, seams: strokeWidthWhite, shading: strokeWidthGrey },
}));
```

`preview.png` was rendered from `artwork.svg` (which already carries the
correct per-layer ink colours) with:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-17-0619/artwork.svg \
  concept-brainstorming/2026-09-17-0619/preview.png \
  --width 2000 --background '#1b1b1a'
```

## Wishes

- `sports-balls` has no CLI command yet (unlike most other generators) —
  a `flow-lines balls` command with `--region`/`--mix`/`--true-sizes`
  flags would make this kind of piece reproducible without a scratch
  script.
- There's no way to confine two `generateSportsBalls` calls to the same
  shared occlusion buffer, so a composed piece like this one has to keep
  its regions non-overlapping by construction (true here, but it means
  the "escaped" balls can never legally roll back in front of the pile).
  A `sharedOcclusion` option that let two calls write into one Z-buffer
  would open up richer compositions — a ball rolling *through* a gap in
  the pile, not just away from it.
