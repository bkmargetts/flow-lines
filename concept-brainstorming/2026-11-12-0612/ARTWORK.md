# Precipitate

*A3 single-pen plot, one sheet. Five drops falling down a column of paper.*

## Statement

Five drops fall down the centre of a tall sheet. The top one is barely a
drop at all: four heavy bars stacked like a roof, a lone bar breaking away
beneath them, and an empty space where a body should be. Each drop below
holds twice as many marks as the one above it. By the fifth, the shape has
settled: a sharp, solid cap of welded rules over a round body that thins
into a fine spray.

Nobody drew that shape. Each drop is a uniformly random domino tiling of an
Aztec diamond (`arctic`, the one generator the studio had not used yet),
with only one of its four domino classes inked. The arctic circle theorem
says that as the tiling grows, its corners freeze into order while the
inside stays random, and the border between them becomes an exact circle.
Ink one class and that frozen corner reads as the cap of a drop. The
circle is not in the code. It appears from counting, but only once there
are enough dominoes, so the column shows the law appearing as the drops
fall. At n = 6 it is still only chance. At n = 96 it has its shape.

What kept this one through the cull was a single rule. **The whole sheet is
one 0.2 mm pen, and every drop carries the same relative ink weight.** A
coarse domino's bar is built from stacked offset passes of that pen, so its
thickness stays a fixed fraction (0.4) of the domino's size. Only the order
n changes between drops; the material does not. The heavy slabs at the top
and the hair-fine rules at the bottom are the same drawing at different
resolutions.

Candidates discarded on the way: the four-class "weave" in four inks (a
handsome textile, but an even grey with no event in it, and it repeated
the optical-mixing idea of *Proof (CMY)*); a two-ink "horizon" diamond
(too much like a diagram); a single large n = 260 drop (striking but
static, a logo); a horizontal strip of the same sequence (read as an
infographic, where the vertical column reads as rain); and five other
seeds, whose first drops did not separate as clearly as seed 58's.

## Materials

- **Paper**: hot-press cotton watercolour paper, 300 gsm, **cool natural
  white** (e.g. Arches Aquarelle Hot Press, Natural White), cut to
  **A3 portrait, 297 × 420 mm**. Hot-press is essential: the 0.2 mm rules
  in the bottom drop sit 0.35 mm apart, so cold-press tooth would break
  them up.
- **Pen**: one pigment fineliner, **0.20 mm, blue-black**: Sakura Pigma
  Micron 005, colour *Blue Black* (target ≈ `#1d2b46`). Have a second,
  fresh 005 ready: the stacked passes in the top drops are hard on a nib.
- Low-tack drafting tape; a 2H pencil for the signature.
- Presentation: float-mounted in a deep white box frame, about 40 mm
  float. No window mount: the column should hang in open paper.

## Process

1. Tape the sheet square to the plotter bed, portrait. The SVG is
   297 × 420 mm with its artwork already centred, so home the pen on the
   paper's top-left corner (zero margin in the plotter software; the 30 mm
   margins are drawn into the file).
2. Fit a **fresh Micron 005 Blue Black**. Plot `artwork.svg` at about 60 %
   of the plotter's max speed, with full pen-down before travel (no
   dragging).
3. The file runs **bottom drop first** (finest work on the freshest nib),
   then up the column. The two top drops stack 8 to 15 passes per bar, so
   pause before them (they start at the second drop from the top) and
   **let the sheet dry 10 minutes**. Then swap in the second fresh pen,
   leaving it in place, and resume. Pigment ink on hot-press stays wet on
   the surface for a while, and a nib dragged through a wet bar smears it.
4. Leave it flat for an hour. Do not erase anywhere near the bars.
5. Hand step: in 2H pencil, lightly, at the bottom-right corner 15 mm in
   from the edges, write *Precipitate*, the orders `6 · 12 · 24 · 48 · 96`,
   and sign. Nothing else is added: the paper is the air the drops fall
   through.

## Plot settings

| | |
|---|---|
| Sheet | A3 portrait, 297 × 420 mm |
| Margins | 30 mm top/bottom (built into the file); column centred, 67 mm wide |
| Pen | 0.20 mm, single pen, single layer |
| Strokes | 2,280 straight strokes (no curves); ~11.3 m of drawn line |
| Drops (top → bottom) | n = 6 / 12 / 24 / 48 / 96, seeds 58–62 |
| Passes per bar | 15 / 8 / 4 / 2 / 1 (bar weight 2.24 / 1.12 / 0.56 / 0.28 / 0.20 mm) |
| Plot order | bottom drop → top drop |

## Reproduction

From the repo root, after `pnpm install && pnpm build`:

```sh
node concept-brainstorming/2026-11-12-0612/make-artwork.mjs concept-brainstorming/2026-11-12-0612
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-12-0612/artwork.svg \
  concept-brainstorming/2026-11-12-0612/preview.png \
  --width 1600 --background '#eef0ec' --stroke '#1d2b46'
```

`artwork.svg` sha256 at the time of the run:
`58e405e9ed4b868396627fc1bda247a1a6c3642caa58e1822067e3a170a7a6d7`.

`make-artwork.mjs` (committed alongside, reproduced in full):

```js
// Precipitate — reproduces artwork.svg byte-for-byte.
// From the repo root, after `pnpm install && pnpm build`:
//   node concept-brainstorming/<this-folder>/make-artwork.mjs <this-folder>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { generateArctic, toSVG } = await import(new URL('../../packages/core/dist/index.js', import.meta.url));

const outDir = process.argv[2] ?? '.';
const SEED = 58;                      // drop i uses SEED + i
const ORDERS = [6, 12, 24, 48, 96];   // Aztec diamond order, doubling top → bottom
const PEN = 0.2;                      // mm — the one pen for the whole sheet
const WEIGHT = 0.4;                   // bar weight as a fraction of the domino unit
const PX = 4;                         // px per mm
const Wmm = 297, Hmm = 420;           // A3 portrait
const W = Wmm * PX, H = Hmm * PX;
const MARGIN = 30 * PX, GAP = 6 * PX;
const cell = (H - 2 * MARGIN - (ORDERS.length - 1) * GAP) / ORDERS.length;

const drops = ORDERS.map((n, i) => {
  const r = generateArctic({ width: cell, height: cell, margin: 0, seed: SEED + i, preset: 'dissolve', order: n });
  // Weight scales with the domino, so every drop carries the same relative ink:
  // one fixed pen, with coarse bars built from stacked offset passes.
  const unitMm = cell / PX / (2 * n);
  const weight = Math.max(PEN, unitMm * WEIGHT);
  const passes = Math.max(1, Math.ceil((weight - PEN) / (PEN * 0.75)) + 1);
  const step = passes > 1 ? (weight - PEN) / (passes - 1) : 0;
  const dx = (W - cell) / 2, dy = MARGIN + i * (cell + GAP);
  const lines = [];
  for (const l of r.lines) for (let p = 0; p < passes; p++) {
    const oy = (p - (passes - 1) / 2) * step * PX;
    lines.push({ points: l.points.map((q) => ({ x: q.x + dx, y: q.y + dy + oy })), layer: `drop-${i + 1}` });
  }
  return lines;
});
// Plot order: finest drop first (fresh nib), coarsest last.
const lines = drops.reverse().flat();
const res = { lines, width: W, height: H, seed: SEED };
writeFileSync(join(outDir, 'artwork.svg'), toSVG(res, { physicalWidth: Wmm, physicalHeight: Hmm, strokeWidth: PEN * PX, preserveLayerOrder: true }));
let len = 0;
for (const l of lines) for (let j = 1; j < l.points.length; j++) len += Math.hypot(l.points[j].x - l.points[j - 1].x, l.points[j].y - l.points[j - 1].y);
console.log(`${lines.length} strokes, ${(len / PX / 1000).toFixed(1)} m of line`);
```

## Wishes

- **An `arctic` CLI command** (or a `--grid` of orders on it). A size-ladder
  plate like this one should not need a scratch script.
- **Per-stroke weight via offset passes for non-contour generators.** I had
  to stack passes by hand. A core helper of the form "make this stroke
  w mm wide with an N-pass pen, with optional tapered ends" would let any
  generator scale weight with its own geometry.
- **An inked domino-class "fade"** that inks a second class only beyond a
  radius, so the frozen cap and the dissolving body could carry two
  different pens.
