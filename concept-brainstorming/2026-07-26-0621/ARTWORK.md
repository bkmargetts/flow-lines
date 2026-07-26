# Lemniscate

## Artist statement

The word for the infinity symbol is a small joke on itself. *Lemniscate*
comes from the Latin *lemniscus* — a hanging ribbon, the kind of pendant
sash tied to a victor's wreath — after the Greek *lēmniskos*. Jacob
Bernoulli wrote the curve down in 1694 and named it for what it looked
like: a ribbon crossed once over itself. Mathematicians have called the
∞ shape a ribbon for three hundred years. This piece just takes that
literally.

The ribbon-weave generator is built to fill a page: a Celtic trellis, a
plait, a lattice that tessellates corner to corner. Every configuration I
tried at its intended scale — order dialled toward the strict knot
lattice, dozens of cells deep — read as exactly that: wallpaper, or a
coloring-book knot, technically accomplished and dead as a composition
the moment it covered the whole sheet. The generator's real subject only
showed up when I took almost everything away from it: a lattice just two
cells wide, barely enough structure for a single strand to cross itself
and close. At that starvation point the "weave" stops being a pattern
and becomes a gesture — one continuous ribbon, drawn with its own
volume (banded edges, cross-ticks, a shaded underside where it passes
behind itself), tying itself into the one shape its own name describes.

I scanned roughly two hundred seeds at this two-cell starvation setting,
narrowing first by eye — most seeds fracture into two, three, even five
disconnected scraps, legible as noise rather than a symbol — then by
stroke count, since a clean single figure and a quiet companion loop
draw in far fewer marks than a tangle of fragments. Seed 86 was the one
where a single ribbon closes cleanly into an unmistakable ∞, asymmetric
enough to read as tied rather than stamped, with one small closed ring
left over beside it: the generator's natural second strand, unconnected
to the first. I kept it rather than cropping it out. An infinity symbol
alone is a diagram. Beside it, one small closed loop — a coin, a full
stop, a completed thing — turns it into a sentence: *the line that never
ends, and, next to it, one that already has.*

## Materials

- **Paper**: Canson Mi-Teintes, "Steel Grey" (~345), 160gsm, used on the
  smooth (reverse) face for cleaner pen travel, A3 (297×420mm) portrait.
  A warm, quiet mid-grey — light enough that both inks read clearly
  against it, dark enough that the sheet itself does not read as "blank
  paper," which a piece this sparse needs from its ground.
- **Pen 1 — the lemniscate (main pass)**: POSCA PC-5M paint marker,
  Black, ~1.8–2.5mm bullet tip run at the design's ~2.0mm line weight.
  Opaque acrylic ink, chosen over a dye-based fineliner because dye inks
  sit thin and grey on toned card; the acrylic holds a flat, confident
  black even in a single pass.
- **Pen 2 — the companion ring**: POSCA PC-5M paint marker, Bordeaux
  (deep wine red, ≈ `#6E2430`), same tip/width as Pen 1.
- Low-tack removable tape (e.g. drafting tape) to pin the sheet flat and
  to re-register it between the two passes.

## Process

1. Cut/confirm the Canson Mi-Teintes sheet to A3 (297×420mm); tape it
   flat to the plotter bed on its smooth face, registration marks noted
   in pencil at two opposite corners (outside the final margins) so the
   sheet can be removed and re-taped in exactly the same position for
   the second pass.
2. Load the black POSCA PC-5M. Plot `artwork-layer-1.svg` — the main
   ribbon, 16 strokes, ~85cm of drawn line. This is the whole ∞: both
   edges of the band, the cross-tick "rungs" that read as surface
   curvature, and the shaded hatch where the ribbon passes behind
   itself at the one crossing.
3. Let the acrylic ink set (5–10 minutes touch-dry; POSCA sets faster
   than it fully cures, so handle the sheet by the edges only).
4. Without moving the tape, swap to the Bordeaux POSCA PC-5M. Plot
   `artwork-layer-2.svg` — the companion ring, 8 strokes, ~39cm of
   drawn line, positioned lower-right of the main figure in the same
   coordinate space as the first pass, so no manual re-registration is
   needed beyond confirming the tape didn't shift.
5. Let dry flat for at least 30 minutes before unpinning. Float-mount
   or frame under glass with a generous mat — the piece is mostly bare
   grey paper by design and wants room around it, not a tight border.

## Plot settings

- Paper: A3, 297×420mm, portrait.
- Margin: none imposed by the plot frame — the motif's own placement
  (see script below) leaves ~74mm either side and ~130–190mm above/
  below, which *is* the margin.
- Pen widths: ~2.0mm (black, main pass), ~2.0mm (Bordeaux, companion
  pass) — one pen at one width per layer, per the shop's plotting rule.
- Estimated pen-down travel: ~85cm (black, 16 strokes) + ~39cm
  (Bordeaux, 8 strokes) ≈ 124cm of drawn line total, under 25 pen lifts
  combined — a short plot, well under a minute of drawing time on a
  typical desktop plotter.

## Reproduction

There is no CLI command for the ribbon-weave generator yet (core-only —
see the toolbox table in the studio README), so the piece is reproduced
by this scratch script against the built core package:

```js
// produce-lemniscate.mjs
// node produce-lemniscate.mjs   (after `pnpm --filter @flow-lines/core build`)
import { writeFileSync } from 'node:fs';
const { generateRibbonWeave, toSVG } = await import('../../packages/core/dist/index.js');

const S = 1.5;
const SEED = 86;
const opts = {
  order: 0.3, breaks: 0.3, twists: 0.2, meander: 1,
  rungs: 0.5, shading: 0.6, shadowHatch: 0.8,
  cell: 60 * S, bandWidth: 14 * S, gap: 2.2 * S, penWidth: 1.35 * S,
  edge: 'closed', style: 'band', inkGroups: 2,
};
const LOCAL_W = 160 * S, LOCAL_H = 160 * S, LOCAL_M = 20 * S;

const res = generateRibbonWeave({ width: LOCAL_W, height: LOCAL_H, margin: LOCAL_M, seed: SEED, ...opts });

// Centre the motif's own bounding box on an A3 sheet, optical centre
// (44% down rather than 50%) so the companion ring has room to settle
// below it instead of the pair feeling pinned to the middle.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const l of res.lines) for (const p of l.points) {
  minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
  maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
}
const PAGE_W = 297, PAGE_H = 420;
const dx = PAGE_W / 2 - (minX + maxX) / 2;
const dy = PAGE_H * 0.44 - (minY + maxY) / 2;

const shifted = res.lines.map((l) => ({
  ...l,
  points: l.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
}));
const g0 = shifted.filter((l) => l.layer.startsWith('g0')); // the lemniscate
const g1 = shifted.filter((l) => l.layer.startsWith('g1')); // the companion ring

const svgOpts = (color) => ({
  strokeColor: color,
  strokeWidth: opts.penWidth,
  physicalWidth: `${PAGE_W}mm`,
  physicalHeight: `${PAGE_H}mm`,
  precision: 3,
});

writeFileSync('artwork-layer-1.svg', toSVG({ lines: g0, width: PAGE_W, height: PAGE_H, seed: SEED }, svgOpts('#101010')));
writeFileSync('artwork-layer-2.svg', toSVG({ lines: g1, width: PAGE_W, height: PAGE_H, seed: SEED }, svgOpts('#6E2430')));
```

`preview.png` was rendered from a scratch-only combined SVG (both
layers coloured as above, plus a `#918D87` background rect
approximating the Canson Steel Grey sheet) via:

```sh
node scripts/svg-to-png.mjs preview-combined.svg preview.png --width 1600
```

## Wishes

- `generateRibbonWeave` has no direct "target strand count" or "single
  closed loop" knob — landing on a clean, connected ∞ instead of a
  scatter of disconnected fragments meant scanning ~200 seeds at a
  fixed starvation config and filtering by output stroke count as a
  proxy for connectivity. A `minComponents`/`maxComponents` constraint
  (reject-and-reseed internally) would turn this from a lucky-seed hunt
  into a direct request — useful for anyone else who wants this
  generator's *single-motif* register rather than its lattice one.
