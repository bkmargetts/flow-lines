# Service Loop

## Artist statement

When an electrician or a cable installer terminates a run, they don't cut
it to length. They leave slack — a deliberate coiled loop of extra cable,
tucked back into the wall or the cabinet — so that if a connection ever
has to be redone, there's enough spare length to work with without
running a whole new line. The trade term for that coil is a *service
loop*. It's the one part of an installed system that isn't under tension,
kept ready rather than put to work.

This repo has a generator called `tangles` that grows corrugated flexible
duct — the ribbed vent hose of an HVAC install — worming across a page,
weaving over and under itself with real hidden-line removal. Nobody in
this studio's runs had touched it yet, and rendered plain it reads
exactly as advertised: a snarl of ductwork, or, tip it slightly, a snarl
of gut. That ambiguity is the material's whole appeal — "duct" and the
anatomical "ductus" are the same word.

What decided the piece was a single run (seed 7) where the thickest
strand in the tangle — literally the fattest cord the generator drew —
broke pattern from the rest. Instead of staying woven into the working
mass at the bottom of the sheet, it lifts clear, coils once on itself
into a tight flat spiral, and reaches one open, unconnected mouth up into
the empty top half of the page. Everything else in the drawing is
load-bearing: pulled taut, crossing, holding the composition down.
This one cord isn't connected to anything. It's just coiled and ready.

I pulled that one strand out of the generator's internal state (every
mark it draws carries the index of the strand it belongs to) and gave it
its own pen pass in copper, leaving the rest in black. Once it had its
own colour the reading was immediate — you find it before you've
consciously parsed the rest of the tangle. That's the piece: a system
under load, and the one part of it that was deliberately never put to
work.

## Materials

- **Paper:** A3 (297×420mm), bright white smooth hot-press illustration
  board, ~250gsm. Cool white, not cream — the copper needs a neutral
  ground to read as an added material rather than a warm accent within a
  warm sheet.
- **Ink, pass 1 (the tangle):** dense black archival pigment fineliner,
  0.35mm nib — e.g. Sakura Pigma Micron 05 or Copic Multiliner 0.35,
  "Black" (#000000).
- **Ink, pass 2 (the service loop):** Sakura Gelly Roll Metallic 07,
  "Copper" (approx. #B5651D on paper — the physical ink has a faint
  metallic sheen the hex swatch can't carry). A gel pen sits proud of the
  fineliner's ink film, so the coil reads as laid down after and on top
  of the tangle, not underneath it.

## Process

1. Mount the A3 sheet on the plotter bed and home the machine. Do not
   remove or reposition the paper for the remainder of the process —
   registration between the two passes depends entirely on the paper
   never moving; there are no registration marks on this piece.
2. Load the black fineliner. Plot `artwork-layer-1-black.svg`
   (1089 strokes, ≈4.9m of pen-up travel).
3. Without touching the paper, swap the pen for the copper gel pen. Plot
   `artwork-layer-2-copper.svg` (99 strokes, ≈1.0m of pen-up travel). The
   gel ink is laid wet-on-dry over the already-dry fineliner pass, so it
   sits slightly raised where the two cross.
4. Leave flat to dry for at least 15 minutes — gel ink stays workable
   longer than the fineliner and will smear if handled early.
5. Float-mount in a deep box frame (enough air gap that the sheet's edge
   and the plate mark stay visible) rather than trimming to the image —
   the piece uses the full margin as the working system's "off-page"
   continuation; the strands that run to the sheet edge should read as
   continuing past it, not as cropped.

No wash, no second sheet, no tiling — one plate, two passes, one pen
width throughout (bold is never faked with stroke width; there is no
bold emphasis in this piece, only colour).

## Plot settings

- Paper: A3, portrait, 10mm margin.
- Pen width: 0.35mm, both passes (uniform tube diameter reads as one
  consistent material regardless of colour).
- Resolution: 3px/mm (the generator's reference density).
- Pen-up travel: ≈4.9m (black), ≈1.0m (copper).

## Reproduction

Built with the core `tangles` generator (`packages/core/src/tangles`),
driven directly rather than through the CLI so the one strand that
matters (index 7 out of 11, identified by inspecting
`buildTangleScene()`'s per-strand bounding boxes and cuff flags — both
ends open, radius the largest of the eleven) could be pulled into its
own pen pass. The full pipeline below is the same one `generateTangles()`
runs internally (hand-drawn wobble → clip to margin → reorder for pen
travel); it's just split into two output arrays right after the strand
tag is available and before the tag is discarded.

Seed 7. Deterministic — running this script twice produces byte-identical
SVGs (verified).

```js
// service-loop.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildTangleScene } from '@flow-lines/core/dist/tangles/index.js';
import { applyHandDrawnStyle } from '@flow-lines/core/dist/hand-drawn.js';
import { orderPlot } from '@flow-lines/core/dist/optimize.js';
import { toSVG } from '@flow-lines/core/dist/svg.js';
import { clipPolylineToRect } from '@flow-lines/core/dist/lib/polyline.js';

const SEED = 7;
const ACCENT_STRAND = 7; // the fattest strand; both ends cuffed (open, unconnected)
const outDir = process.argv[2] || '.';
mkdirSync(outDir, { recursive: true });

// Physical A3 @ 3px/mm, 10mm margin, 0.35mm pen — matches
// `flow-lines tangles --paper a3 --margin-mm 10 --pen-width-mm 0.35 ...`
const WIDTH = 891, HEIGHT = 1260, MARGIN = 30;

const opts = {
  width: WIDTH, height: HEIGHT, margin: MARGIN, seed: SEED,
  material: 'hose', count: 11, radiusMin: 12.9, radiusMax: 32.7,
  wander: 0.5, cuffChance: 0.4, clearance: 10.8, ringDensity: 0.6,
  ringCurve: 0.65, shading: 0.5, lightAngle: (315 * Math.PI) / 180,
  weaveBias: 0.3, gap: 2.4, penWidth: 1.05, wobble: 1.0,
};

const scene = buildTangleScene(opts);

// Tag lines with their source strand so the split survives the hand-drawn
// pass and clipping — same pipeline generateTangles() runs internally.
const lines = scene.marks.map((m) => ({ points: m.points, layer: m.layer, _strand: m.strand }));

const x0 = MARGIN, y0 = MARGIN, x1 = WIDTH - MARGIN, y1 = HEIGHT - MARGIN;
const strokeWobble = opts.wobble * 0.3;
const finished = applyHandDrawnStyle(
  { lines, width: WIDTH, height: HEIGHT, seed: scene.seed },
  { amplitude: strokeWobble, wavelength: 42, jitter: 0, seed: scene.seed + 6, maxDisplacement: strokeWobble * 1.5 }
).lines;

const clipped = finished.flatMap((l) =>
  clipPolylineToRect(l.points, x0, y0, x1, y1).map((pts) => ({ ...l, points: pts }))
);

const blackLines = clipped.filter((l) => l._strand !== ACCENT_STRAND).map(({ _strand, ...l }) => l);
const copperLines = clipped.filter((l) => l._strand === ACCENT_STRAND).map(({ _strand, ...l }) => l);

const blackResult = orderPlot({ lines: blackLines, width: WIDTH, height: HEIGHT, seed: scene.seed });
const copperResult = orderPlot({ lines: copperLines, width: WIDTH, height: HEIGHT, seed: scene.seed });

const svgOpts = { strokeWidth: 1.05, physicalWidth: '297mm', physicalHeight: '420mm' };
writeFileSync(`${outDir}/artwork-layer-1-black.svg`, toSVG(blackResult, { ...svgOpts, strokeColor: '#000000' }));
writeFileSync(`${outDir}/artwork-layer-2-copper.svg`, toSVG(copperResult, { ...svgOpts, strokeColor: '#b5651d' }));
```

(`@flow-lines/core/dist/...` — run from the repo root after `pnpm build`,
with the import specifiers resolved to the built package, e.g.
`packages/core/dist/tangles/index.js` etc.)

`preview.png` was rendered by concatenating the two layer SVGs' path
elements onto one canvas with a `#fdfdfb` background and rasterizing with
`scripts/svg-to-png.mjs`, purely for this preview — the two SVGs above
are the plot-ready deliverables.

## Wishes

- `tangles` has no way to bias *where* a strand starts or ends (region
  confinement, or a "prefer an escape toward this edge" pull), unlike the
  stickmen-family generators' `region` option. Finding this composition
  meant seed-searching at the full 11-strand default rather than steering
  toward it — a coarse "keep N% of strands reaching an edge/the margin
  centre" knob would make compositions like this reachable by intent
  instead of luck.
- No CLI-level way to export a single named strand as its own layer (the
  way `--split-layers` exposes `edge`/`ring`/`shade`/`shadow`). That's a
  reasonable gap to leave un-plumbed — this is a one-off editorial choice,
  not a general need — but if a second piece wanted the same move, a
  `--highlight-strand <n>` flag would save the hand-rolled script.
