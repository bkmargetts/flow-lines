# Anastomosis

## Artist statement

*Physarum polycephalum* is a single cell with no brain, no eyes, and no
plan. Scattered across a surface it sends out a foam of exploratory
tubes; wherever a tube reaches food, or reaches another part of itself,
the traffic flowing back thickens that one channel, and the channels
around it that found nothing simply starve and fade. There is no
comparing, no choosing, in the sense we mean those words — only the same
route being walked again, and walking a route is what makes it fatter.
Left running, the foam collapses from a haze of directionless searching
into a handful of fat, load-bearing veins strung between fine unused
threads that never got reinforced.

This piece never touches the plotter's stroke width. Every mark in it is
one pen at one width, plotted three times over — which happens to be
exactly how this organism works too. A channel in the drawing doesn't
read as bold because I decided to widen it; it reads as bold because a
few hundred near-identical agent paths were laid down along the same
route and now sit stacked on top of one another, in precisely the way
this repo's own bold lines are built: by repeating a pass, never by
leaning on the pen. The simulation earned its emphasis the same way an
ink illustrator earns theirs, and for once the metaphor isn't mine — it's
just what the data does.

I ran the same configuration across sixteen seeds at low resolution
before committing to one at full size. Most either collapsed early — a
ring-seeded cloud dying down to a single fat doughnut and nothing else —
or filled the sheet corner to corner with no rest for the eye, the
"busy" failure mode of every reticulated network generator in this repo.
Seed 16 was the one that kept an actual silhouette: two open cells
stacked like a pair of lungs, one confident diagonal spine holding them
together, and enough untouched paper on both sides that it reads as a
specimen held up to the light rather than a texture sample. I chose
nothing about that shape. I only chose which of the organism's own
sixteen attempts to keep.

The three plotted layers are not a stylistic flourish — they're the
simulation's own confidence bands, split apart at the exact strength
each stroke earned during the run (`rim` / `mid` / `core` in
`packages/core/src/physarum.ts`). Plotting them in that order, faintest
first, is the closest a single pen gets to describing how the network
actually arrived at itself: wandering first, consolidating, and only at
the end committing to what it kept.

## Materials

- **Paper** — Hahnemühle Bugra, colourway *Elfenbein* (ivory), 225 gsm,
  mould-made, lightly textured. Trim to A3 (297 × 420 mm) from a parent
  sheet, keeping one factory deckle edge along the top if the sheet
  allows it.
- **Ground wash** — Kuretake Bokuju liquid sumi ink, diluted roughly
  1:10 with water in a shallow dish; a 40 mm hake (flat wash) brush.
- **Plotting ink** — Sakura Pigma Micron 03, black (pigment, ~0.35 mm
  fixed line), one pen for the entire piece — the same nib plots all
  three layers, no swap between passes.
- **Mounting** — acid-free foam board, artist's tape (low-tack, for
  registration only, removed before framing), a deep box frame with no
  window mat (the sheet is float-mounted so its trimmed edge shows).

## Process

1. Trim the Bugra sheet to 297 × 420 mm and tape it lightly at the four
   corners to a flat board — a light single wash pass doesn't need a
   full wet-stretch.
2. Dilute the sumi ink about 1:10 with water. Load the hake brush and
   lay one loose, uneven pass of horizontal strokes across the whole
   sheet, letting some bands stay lighter than others — the ground
   should read as a faint atmospheric grey, never a flat tint. This wash
   stands in for the chemical trail field the organism actually sensed
   and steered by, which never appears directly in the drawing — only
   its committed paths do.
3. Let the wash dry completely, flat, for 30–45 minutes.
4. Re-tape the dry sheet to the plotter bed. It does not move again
   until all three layers are plotted, so there is no registration step
   — one sheet, one pen, one sitting.
5. Load the plotter pen with the Micron 03. Plot `artwork-layer-1-rim.svg`
   first — the faint, wide-wandering paths that never consolidated.
6. Without lifting the sheet or changing the pen, plot
   `artwork-layer-2-mid.svg` — the paths that began reinforcing a shared
   route.
7. Plot `artwork-layer-3-core.svg` last — the small number of routes the
   network actually kept. Because this pass lands last and on top, any
   faint ink pooling from the earlier two layers reads as depth rather
   than misregistration.
8. Let the ink cure ~10 minutes before unpinning the sheet.
9. Float-mount on the foam board with a ~6 mm reveal on all sides and
   frame in a deep box frame — no mat overlapping the paper, so the
   trimmed/deckle edge stays visible.

## Plot settings

- Paper: A3, portrait (297 × 420 mm)
- Margin: 25 mm
- Pen: single width throughout, ~0.35 mm (Micron 03)
- Layers / stroke counts: `rim` 961 strokes, `mid` 564 strokes, `core`
  159 strokes (1,684 total, already chained/reordered by
  `optimizePlot` before the layer split — pen-up travel is short per
  layer since each layer's strokes were merged where they touched
  before splitting)
- Seed: 16

## Reproduction

```sh
pnpm install && pnpm build
node anastomosis.mjs concept-brainstorming/2026-07-28-0625
```

```js
// anastomosis.mjs — physarum "network" preset, paths style, split into
// rim/mid/core plotting-order layers on one A3 sheet.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const { generatePhysarum, toSVGLayers, PAPER_SIZES, pageMetrics } =
  await import(coreDist);

const a3 = PAPER_SIZES.find((p) => p.id === 'a3');
const page = pageMetrics(a3, 'portrait'); // 891 x 1260 px @ 3 px/mm

const marginMm = 25;
const marginPx = Math.round(marginMm * page.pxPerMm);

// A3 is 2x the reference A4 area; grid grows by sqrt(area factor),
// simulation budget by the area factor itself (see sheet-scale.ts).
const gridCols = Math.round(200 * Math.sqrt(2));
const budgetScale = 2;

const res = generatePhysarum({
  width: page.widthPx,
  height: page.heightPx,
  margin: marginPx,
  gridCols,
  budgetScale,
  seed: 16,
  preset: 'network',
  style: 'paths',
  pathFraction: 0.06,
  settleFraction: 0.6,
});

const layers = toSVGLayers(res, {
  width: page.widthPx,
  height: page.heightPx,
  physicalWidth: page.widthMm,
  physicalHeight: page.heightMm,
  preserveLayerOrder: true,
});

const order = ['rim', 'mid', 'core'];
order.forEach((name, i) => {
  const layer = layers.find((l) => l.layer === name);
  writeFileSync(join(outDir, `artwork-layer-${i + 1}-${name}.svg`), layer.svg);
});
```

```sh
# preview.png — ivory paper / near-black ink approximation
node scripts/svg-to-png.mjs combined.svg preview.png \
  --width 1600 --background '#f2e9d8' --stroke '#161311'
# (combined.svg here is the un-split result of the same generatePhysarum()
# call, exported with core's toSVG() instead of toSVGLayers() — kept only
# as a rendering convenience, not part of the deliverable, since the three
# layer files above are what actually gets plotted.)
```

## Wishes

- Physarum has no CLI command yet (core-only, per the toolbox notes) — a
  `flow-lines physarum` command exposing `--preset`, `--style`, and the
  path-tracing knobs (`--path-fraction`, `--settle-fraction`) would save
  every future session the hand-rolled import script above.
- `toSVGLayers` has no built-in way to request a specific layer order
  (it sorts alphabetically or preserves insertion order); a
  `layerOrder: string[]` option would remove the manual
  `order.forEach(...)` re-sort this piece needed to get rim → mid → core.
