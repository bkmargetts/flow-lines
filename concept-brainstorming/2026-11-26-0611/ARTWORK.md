# Four Winds, One Circle

*A cruciform polyptych — five 280 mm square panels, nine plotter passes, one exact random tiling.*

## Artist statement

Take a diamond-shaped board of squares, AD(120), and cover it with
14,520 dominoes chosen exactly at random from every possible way of
doing it. There are 2^7260 such tilings; the repo's new `arctic`
generator samples one of them uniformly by domino shuffling, with no
approximation anywhere. Then sort the dominoes by the direction the
shuffle moves them. Mathematicians gave the four classes compass names
— **North, South, East, West** — and the astonishing fact (Jockusch,
Propp and Shor's arctic circle theorem) is that each class *freezes
into its own compass corner*: perfect brick courses of North dominoes
packed into the top tip, South at the bottom, East and West at the
sides — while the centre stays liquid, and the border between frozen
and liquid converges to a perfect circle. Nothing in the algorithm
mentions a circle.

This piece splits that one tiling into its four winds and hangs them as
a compass. Each outer panel carries a single class in a single ink: a
solid mass at its own pole that breaks into driven, scattering dashes
as it crosses into the circle, and fades out on the far side — four
weather systems blowing in from four directions. The centre panel
plots all four again, on one sheet, in register: the whole tiling,
where the four inks interlock into something like a woven textile —
and over it, in gold, the circle the theorem predicts. The gold ring is
the only line in the work that a human (well, three mathematicians)
drew; everything else is dice. You can stand close and watch the dice
fail to quite agree with the theorem — the frozen black edge dips
under the ring here, the teal pushes past it there — and step back and
see that they agree completely.

Why this survived the cull: I started with the generator's presets on
a single sheet (all four classes; one class; outlines) and they were
handsome diagrams but not pictures. Two centre treatments were
discarded — a flat ochre wash disc (graphic, dead) and the full
domino-outline grid in gold (it hides the circle so perfectly the
panel reads as a blank yellow diamond). Order 150 was more precise but
its dashes dissolve into grey at wall distance; at order 120 every
outer panel's dashes stay legible as marks, as rain on a window. What
holds me is that the cross *is the data structure*: the four outer
panels are literally the layers of the centre one, and the
arrangement on the wall is the same compass the mathematics already
named.

## Materials

- **Paper** — five squares, 280 × 280 mm, cut from A3 sheets of a warm
  mid-tan stock: Stonehenge Kraft 250 gsm, or Canson Mi-Teintes "Sand"
  (#343) 160 gsm. The tan (≈ `#c9b48f`) is deliberately mid-value so
  the white wind and the black wind both read against it. Cut squares
  *before* plotting (one per A3 sheet, the 140 mm offcut kept for pen
  tests).
- **Ink N — North** (`wind-n.svg`): carbon black, `#151515`. Sakura
  Pigma Micron 05 (0.45 mm) or Uni Pin 0.4 Black.
- **Ink S — South** (`wind-s.svg`): vermilion, `#c8361d`. Sakura Pigma
  Micron 05 "Red" or a Uni-ball Signo UM-151 0.38 Red-Orange.
- **Ink E — East** (`wind-e.svg`): deep teal, `#1f6f78`. Uni-ball Signo
  UM-151 0.38 Blue-Green, or Staedtler Pigment Liner in teal.
- **Ink W — West** (`wind-w.svg`): opaque bone white, `#f6f2e6`. Uni-ball
  Signo UM-153 / Sakura Gelly Roll 05 White (gel — must be opaque on
  tan in one pass).
- **Ink L — the Limit** (`limit.svg`): metallic gold gel, `#d4a73a`.
  Sakura Gelly Roll Metallic 05 Gold, or Uni-ball Signo Metallic Gold.
- Low-tack drafting tape; five identical float frames (oak or bleached
  ash, ≈ 320 mm square outer, 10 mm float spacers, no mat).

## Process

All five SVGs are 280 × 280 mm documents in the same coordinate space —
the centre panel is simply four of them plus the ring, plotted onto one
sheet without moving it.

1. Square up the plotter and tape a 280 mm tan square at all four
   corners. Mark the plotter's home corner on the back in pencil so
   every sheet goes in the same way round (North edge away from you).
2. **Outer panels** (one sheet each, one pen each):
   - Panel N: plot `wind-n.svg` in black.
   - Panel S: plot `wind-s.svg` in vermilion.
   - Panel E: plot `wind-e.svg` in teal.
   - Panel W: plot `wind-w.svg` in white gel. Let it dry 15 min flat
     before handling; gel smears.
   On the back of each, pencil its letter and an arrow pointing North
   (the drawing's top edge) — W and E look alike until hung.
3. **Centre panel** (one sheet, five pens, **do not unclip the sheet
   between passes**):
   1. `wind-e.svg` — teal.
   2. `wind-s.svg` — vermilion.
   3. `wind-n.svg` — black.
   4. `wind-w.svg` — white gel. The four classes never share a domino,
      so these don't overprint each other; white goes last of the four
      only because gel smears under a following fibre tip. Wait 15 min.
   5. `limit.svg` — gold gel, last, over everything. The ring is five
      concentric passes 0.3 mm apart, so it plots as one solid ~1.6 mm
      band; set pen-down speed slow (≤ 25 mm/s) so the metallic flake
      lays evenly.
   Leave the centre panel flat for an hour before framing.
4. **Hang as a cross**: centre panel at eye level, N directly above, S
   directly below, W to the left, E to the right, with equal gaps of
   ~40 mm between frames (one frame-width plus gap ≈ 360 mm pitch).
   Overall footprint ≈ 1.04 × 1.04 m. The wind panels must be hung with
   their own North edge up — each wind's solid mass should point
   outward, away from the centre.

## Plot settings

- Sheet: 280 × 280 mm (custom), portrait = landscape. Drawing occupies
  the central 256 mm diamond (12 mm margin to the diamond's tips).
- Pen: 0.4 mm for every layer (lattice cell is 1.07 mm, so frozen
  courses print as ~40% ink rules — tone, not solid fill).
- Strokes / ink length per file: `wind-n` 1,709 strokes, 7.9 m;
  `wind-s` 1,694, 7.9 m; `wind-e` 1,666, 7.6 m; `wind-w` 1,679, 7.6 m;
  `limit` 5 rings, 2.8 m. Each wind file is plotted twice (outer panel
  + centre), so the whole work is nine passes and ≈ 65 m of line.
- Strokes are short and pen-lift heavy (welded runs in the frozen
  corners, isolated dashes inside the circle); budget ≈ 25–35 min per
  wind pass.

## Reproduction

Built from `packages/core`'s `generateArctic` (no CLI command exists
for it yet). AD(120), seed 19, all four domino classes inked as welded
spines, default wobble (0.35 px) and default stroke ordering, on an
840 px (= 280 mm at 3 px/mm) square with a 36 px (12 mm) margin. The
gold limit ring is the circle inscribed in the diamond — the arctic
circle — computed from the tiling's own bounding box.

```sh
pnpm install && pnpm build
node final.mjs concept-brainstorming/2026-11-26-0611   # run from repo root
```

`final.mjs` (scratch script, inlined in full):

```js
// Usage (from repo root, after `pnpm build`): node final.mjs <outDir>
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const core = await import(pathToFileURL(resolve('packages/core/dist/index.js')).href);
const out = process.argv[2];
const MM = 280, PX = 3;                  // 280 mm square panel at 3 px/mm
const W = MM * PX, MARGIN = 12 * PX;     // 12 mm clear border
const ORDER = 120, SEED = 19;            // AD(120): 14,520 dominoes
const PEN = 0.4 * PX;                    // 0.4 mm nib
const INKS = { n: '#151515', s: '#c8361d', e: '#1f6f78', w: '#f6f2e6' };
const GOLD = '#d4a73a';

const r = core.generateArctic({ width: W, height: W, margin: MARGIN, order: ORDER, seed: SEED, marks: 'all' });
const svgOpts = (color) => ({ strokeColor: color, strokeWidth: PEN, physicalWidth: `${MM}mm`, physicalHeight: `${MM}mm` });
for (const k of Object.keys(INKS)) {
  const lines = r.lines.filter((l) => l.layer === `domino-${k}`);
  writeFileSync(`${out}/wind-${k}.svg`, core.toSVG({ ...r, lines }, svgOpts(INKS[k])));
  console.log(`wind-${k}.svg`, lines.length, 'strokes');
}
// The arctic circle theorem's limit: the circle inscribed in the diamond.
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (const l of r.lines) for (const p of l.points) {
  x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
}
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = (x1 - x0) / 2 / Math.SQRT2;
// Bold by repeated offset passes of the same pen: 5 concentric rings 0.3 mm apart.
const ring = (rr) => ({ points: Array.from({ length: 1441 }, (_, i) => ({ x: cx + rr * Math.cos((i / 1440) * 2 * Math.PI), y: cy + rr * Math.sin((i / 1440) * 2 * Math.PI) })) });
const rings = [-2, -1, 0, 1, 2].map((d) => ring(R + d * 0.3 * PX));
writeFileSync(`${out}/limit.svg`, core.toSVG({ ...r, lines: rings }, svgOpts(GOLD)));
console.log('limit.svg', rings.length, 'rings, R =', (R / PX).toFixed(2), 'mm');
```

Running it twice produces byte-identical files (checked with `cmp`).

`preview.png` is a throwaway composite (not committed): the five
panels laid out as the hung cross on a pale wall (`#ecebe7`), each
panel a tan (`#c9b48f`) square with its SVG(s) nested inside — the
centre stacking teal, vermilion, black, white, gold in plot order —
rasterized with:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 2400
```

## Wishes

- An `arctic` CLI command (with `--split-layers` per domino class) so
  pieces like this reproduce from one command line instead of a script.
- An option for `generateArctic` to emit its own limit-shape overlay
  (the arctic circle, or for other regions the predicted arctic curve)
  as a separate pen layer.
- Other tilable regions than the Aztec diamond — e.g. lozenge tilings of
  a hexagon, whose frozen boundary is an inscribed ellipse/cardioid —
  would make a sibling series.
