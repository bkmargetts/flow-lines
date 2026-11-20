# Thaw

*Plotted fountain-pen ink and a clear-water wash on hot-press cotton paper, A3 portrait. Two inks.*

## Artist statement

Take a uniformly random tiling of an Aztec diamond by dominoes. As the
diamond gets large, the tiling freezes into perfect brick courses at its
four corners and stays disordered inside an inscribed circle. That is the
arctic circle theorem (Jockusch–Propp–Shor). Mathematicians call the two
regimes **frozen** and **liquid**. Nothing in the sampling algorithm mentions a
circle, a temperature or a boundary. The edge is a pure consequence of
counting.

*Thaw* inks only two of the four domino classes from one exact sample
(order 220, about 48,000 dominoes). The diamond is turned 45° so it becomes
a square hung from the top of the sheet. The two frozen corners become
solid fields of diagonal rules: **Ancient Copper** at upper left and
**Prussian Blue** at upper right. Their strokes run perpendicular to each
other, like two etching plates hatched against each other. Where the
corners meet, at the top centre, the two colours touch without mixing.
Below them both inks break into short, scattered dashes, and the shape
ends in a ragged bowl that drips into empty paper. There is no shading in
the code. Every tone you see is just how far order reaches.

Then the drawing gets wet. The inks are water-soluble dye inks. A
clear-water wash brushed up from the bottom of the sheet dissolves only
the liquid region. Its scattered dashes bloom and run downward, while the
frozen corners, which never get wet, stay razor sharp. The process
repeats what the mathematics says: order holds at the edges, and the
middle melts.

### Why this one survived the cull

This session explored the repo's newest generator, `arctic`, which no
earlier concept had touched. Candidates I discarded:
- **the single-class `dissolve` drop.** A striking teardrop, but it is the
  module's default look and reads as a diagram.
- **the `horizon` lens** in two inks (N + S). Symmetric and stately, but
  the two colours only met as a muddy violet confetti.
- **all four classes in four colours.** A quilt, but loud. Four primaries
  turned it into a logo.
- **opposite-corner pairs.** These put the colours at the same stroke
  angle, so nothing set them apart except hue.

Pairing two **adjacent** classes (W + N) on the upright square was the
breakthrough. The two masses meet edge to edge, their hatching crosses at
90°, and the composition becomes asymmetric and heavy at the top, with all
the motion falling downward. That downward fall is what made the wash
process inevitable. I compared six seeds (2, 5, 8, 11, 13, 21). Their
macro shape is all but identical, which is the theorem at work. Seed 5
has the longest, most ragged drip at the bottom of the bowl.

## Materials

| Item | Choice |
|---|---|
| Paper | Arches Aquarelle **hot-press**, 300 gsm, natural white (≈ `#f3ecdc`), cut to 297 × 420 mm (A3 portrait). Hot-press keeps the dense frozen rules crisp; 300 gsm survives the wash without cockling badly. |
| Pen | Plotter fountain-pen adapter, or a refillable technical pen, **0.3 mm**. Use one per ink, or flush the pen thoroughly between inks. |
| Ink 1 | **Diamine Ancient Copper**, `#9c4a22`, water-soluble dye ink |
| Ink 2 | **Diamine Prussian Blue**, `#1d3a5f`, water-soluble dye ink |
| Wash | Distilled water, 50 mm flat hake brush, spray mister |
| Other | Low-tack artist's tape (to hold the sheet on the plotter bed), a board to tilt the sheet, paper towel |
| Mount | Float-mounted on white museum board, about 60 mm reveal, in a deep box frame. Leave the deckle or cut edge visible. |

## Process

1. Tape the sheet to the plotter bed, portrait, with the origin at the top-left corner.
   Do not move it until step 4: both layers share one coordinate space,
   so registration comes from the paper simply staying put.
2. Plot **`artwork-layer-1-ancient-copper.svg`** at 0.3 mm in Diamine
   Ancient Copper. This is the upper-left frozen field plus its liquid dashes,
   about 19.5 m of line in 5,697 strokes.
3. Change pens without moving the paper. Plot
   **`artwork-layer-2-prussian-blue.svg`** at 0.3 mm in Diamine Prussian
   Blue. This is the upper-right field plus its dashes, about 20.6 m in 5,730 strokes.
   The warm layer goes first so the darker blue sits on top where the two meet.
4. Let it dry for **at least 2 hours**. Dye ink on hot-press paper feels
   dry within minutes, but the frozen fields are dense, and the wash must not reach them.
5. **The thaw.** Prop the board at about 15° with the top of the sheet uppermost. Mist the
   blank lower ~150 mm of paper lightly. Load the hake with clean water and
   draw it across the sheet in horizontal passes, working **upward**
   from the bottom edge. Stop each pass a little higher on the
   left than on the right, so the waterline climbs to about **two thirds of the
   way up the bowl**. Never go above the lowest point of either solid
   frozen field. The waterline should trace an uneven arc parallel to the bowl's
   edge, not a straight line.
6. Leave it at 15° and let the bloom run down into the empty paper
   for 2–3 minutes. Then lay the board flat to dry. Do not touch it again
   with the brush. If a drip runs off the sheet, blot only at the bottom edge.
7. Dry flat for 24 hours. Press under boards if it cockled.
8. Sign in pencil, lower right, below the wash. Title and edition go lower left:
   *Thaw · seed 5 · n = 220*.

Every pull will thaw differently. Each sheet is a unique variant of an identical plot.

## Plot settings

- Sheet: **297 × 420 mm, A3 portrait**. SVG viewBox 2970 × 4200 (1 unit = 0.1 mm).
- Drawing: a 257 × 257 mm square, 20 mm from the top and sides. The
  lower 143 mm is deliberately blank, room for the thaw to run.
- Pen: 0.3 mm for both layers.
- Pen travel: about 40 m of drawn line in total, and about 11,400 pen-downs. The strokes are short,
  so plot with a moderate pen-down speed to keep fountain-pen flow consistent.
- Strokes are reorder-optimised (`orderPlot`), never chained. Chaining would
  fuse neighbouring domino spines.

`preview.png` composites both layers multiplied onto the paper colour,
before the wash.

## Reproduction

There is no `arctic` CLI command, so the SVGs come from this scratch script,
run against the built core package. From the repo root:

```sh
pnpm install && pnpm build
node thaw.mjs concept-brainstorming/2026-11-20-0606
node scripts/svg-to-png.mjs concept-brainstorming/2026-11-20-0606/artwork.svg \
  concept-brainstorming/2026-11-20-0606/preview.png --width 1600 --background '#f3ecdc'
```

`thaw.mjs` (seed **5**, order **220**). It reproduces all three SVGs byte for byte (verified):

```js
// Thaw — two frozen corners of one uniformly random Aztec-diamond tiling.
// Run from the repo root after `pnpm install && pnpm build`:
//   node thaw.mjs concept-brainstorming/2026-11-20-0606
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const core = await import(resolve('packages/core/dist/index.js'));
const { generateArctic, toSVG, toSVGLayers } = core;

const out = process.argv[2];
mkdirSync(out, { recursive: true });

// 1 unit = 0.1 mm. A3 portrait sheet, the drawing hung in a square at the top.
const SHEET_W = 2970, SHEET_H = 4200;
const MARGIN = 200; // 20 mm side/top margin
const SEED = 5, ORDER = 220;

const r = generateArctic({
  width: SHEET_W, height: SHEET_W, margin: MARGIN,
  seed: SEED, order: ORDER, marks: 'all', upright: true, wobble: 0.9,
});
// Keep only two of the four domino classes: N (frozen at upper right) and
// W (frozen at upper left). Their spines run perpendicular after the 45° turn.
const KEEP = { 'domino-w': '#9c4a22', 'domino-n': '#1d3a5f' }; // copper, prussian
const result = {
  ...r,
  height: SHEET_H, // the square sits at the top of the taller sheet
  lines: r.lines.filter((l) => l.layer in KEEP),
};
const common = {
  physicalWidth: '297mm', physicalHeight: '420mm', strokeWidth: 3,
  layerColors: KEEP, preserveLayerOrder: true,
};
const names = { 'domino-w': 'artwork-layer-1-ancient-copper.svg', 'domino-n': 'artwork-layer-2-prussian-blue.svg' };
for (const { layer, svg } of toSVGLayers(result, common)) writeFileSync(join(out, names[layer]), svg);
writeFileSync(join(out, 'artwork.svg'), toSVG(result, {
  ...common, layerBlend: { 'domino-w': 'multiply', 'domino-n': 'multiply' },
}));
for (const k of Object.keys(KEEP)) console.log(k, result.lines.filter((l) => l.layer === k).length, 'strokes');
```

Files:
- `artwork-layer-1-ancient-copper.svg`: plot first (domino class W)
- `artwork-layer-2-prussian-blue.svg`: plot second (domino class N)
- `artwork.svg`: both layers in one file, for preview only (multiply blend)

## Wishes

- **An `arctic` CLI command** with a `--classes w,n` filter and
  `--split-layers`, so this piece would be a single command instead of a
  script that renders `marks: 'all'` and throws away half of it.
- **Anchor/placement in the frame** (`--align top`), so the drawing can hang
  inside a taller sheet without generating on a square and stretching the page height.
- **Per-class pitch.** Spine length or offset tuned per class would let the
  two frozen fields carry different values, for example a darker blue mass against a lighter copper one.
