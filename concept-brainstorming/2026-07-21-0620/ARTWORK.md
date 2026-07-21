# Plate I — Impression of an Unrecorded Fern

## Artist statement

In 1843 Anna Atkins printed *Photographs of British Algae: Cyanotype
Impressions* — the first book ever illustrated with photographic images,
made by laying real seaweed and fern fronds on chemically-treated paper
and exposing it to sun. Where light reached the paper it turned deep
Prussian blue; where the plant blocked it, the paper stayed white. The
specimen survives as a ghost.

This piece borrows that palette and that restraint, not the chemistry.
The botanical generator's `specimen` composition — usually rendered as
dark ink on white, the convention of a printed field guide — is inverted:
a fine white line on a deep Prussian-blue ground, as if the fern itself
had been laid down and the light had done the rest. One frond, grown
from two roots at the base so a second, smaller spray breaks off to the
right about two-thirds up — asymmetric enough to feel found rather than
arranged. Everything else on the sheet is left untouched blue. That
emptiness is the point: a real cyanotype plate is mostly exposed paper,
and a page crowded with foliage stops reading as a specimen and starts
reading as wallpaper.

I grew about thirty candidates before this one — first chasing true
seaweed by turning leaves off entirely and pushing the curl field high,
which only produced tangled, knotted scribble (kept as a lesson, not a
candidate: negative space needs a legible silhouette to frame, not just
absence). Leafy, pinnate-fern candidates were the clear turn: light,
lacy, immediately legible as a specimen at a glance. Of those, seed 32
was the one where the second spray breaks cleanly away from the main
stem — every other seed either kept both stems parallel (redundant) or
let them cross into a knot (busy). This is the one I'd actually want
looking back at me from a wall.

The plate caption at the foot of the sheet — "PLATE I · IMPRESSION OF AN
UNRECORDED FERN · CYANOTYPE STUDY · SEED 32 · FLOW LINES STUDIO" — is
plotted, not hand-lettered, in the toolbox's own single-stroke engraving
font, in the same pen as the fern. No real species is named, because
there isn't one: this fern was never pressed, only computed. Saying so
plainly, in the specimen-label format itself, is the joke and the
honesty at the centre of the piece.

## Materials

- **Paper**: cold-press ("Not" surface) watercolour paper, 300gsm, natural white,
  100% cotton — e.g. Saunders Waterford or Fabriano Artistico — cut to
  A3 (297×420mm). A real cotton-rag watercolour stock is needed because
  it takes a wash without cockling; the surface tooth also gives the
  wash a very faint grain, which reads as photographic paper texture
  rather than flat print.
- **Wash — the "cyanotype" ground**: Winsor & Newton Prussian Blue
  (PB27) watercolour, diluted with water to a middle-strength wash,
  applied in two thin even coats (second coat only after the first is
  bone dry) with a large flat wash brush, edge to edge. Target colour
  once dry: approximately `#123A5C`. A single heavy coat pools unevenly
  at this size; two thin coats lay flatter.
- **Pen — the specimen and caption**: Sakura Gelly Roll White, 05 (Fine
  tip, ~0.4mm laydown). Opaque white gel ink is one of the few pen
  families that lays down solid, consistent line on a dried watercolour
  wash without dragging or skipping. Approximate swatch: `#F2F0E8`
  (gel-roll white reads slightly warm, not paper-white).
- Nothing else: no mount adhesive beyond a standard frame, no second ink.

## Process

1. Stretch or tape down the watercolour sheet (wet media at this
   coverage will cockle an unstretched sheet as it dries).
2. Wash the full sheet with the diluted Prussian Blue, edge to edge, in
   two thin coats, letting the first dry completely before the second.
   Let the finished wash dry fully flat (several hours to overnight) and
   re-flatten under boards if any cockling remains — the plotter's
   hold-down needs a flat, even surface.
3. Once bone dry, mount the sheet on the plotter bed and load the Gelly
   Roll White pen.
4. Plot `fern-cyanotype.svg` — one file, one pen, one pass. It contains
   both the fern (stem, leaves, veins, tendril curls, ground-line) and
   the plate caption at the foot, all in the same white ink. ~9.1m of
   pen travel (optimized).
5. Let the gel ink cure flat for at least 30–60 minutes before handling
   (gel pigment sits on the surface longer than dye ink before it's
   scuff-proof).
6. Float-mount on a dark board (charcoal or navy, not white — a white
   mat competes with the blue field) under glass, simple narrow frame.
   No mat overlap onto the printed area; the plate's own margin is the
   border.

## Plot settings

- Paper: A3, portrait, 297×420mm.
- Margin: 25mm clear border on all sides.
- Pen width: 0.3mm nominal path width (matched to the Gelly Roll 05
  Fine's ~0.4mm laydown).
- Render resolution: 3px/mm.
- Seed: 32.
- Line count: 1616 (fern + caption combined), optimized/chained before
  export.

## Reproduction

The final SVG is generated by a small scratch script that calls the
core botanical generator directly (rather than the CLI) so the plate
caption — built from the toolbox's own single-stroke engraving font,
`textToStrokes`/`textWidth` in `packages/core/src/stroke-font.ts` — can
be merged into the same line set and plotted in the same pass, same pen,
as the fern itself. No repository code was changed; the script only
*calls* existing built and exported functions (`generateBotanical`,
`toSVG`, `pageMetrics`, `resolvePaperSize` from the public
`@flow-lines/core` barrel) plus the stroke-font module, which exists in
the build but isn't re-exported from the barrel, so it's imported by its
built path directly.

Run after `pnpm install && pnpm build` from the repo root:

```js
// render-fern-plate.mjs
import { writeFileSync } from 'node:fs';
import {
  generateBotanical,
  toSVG,
  pageMetrics,
  resolvePaperSize,
} from '/home/user/flow-lines/packages/core/dist/index.js';
import { textToStrokes, textWidth } from '/home/user/flow-lines/packages/core/dist/stroke-font.js';

const page = pageMetrics(resolvePaperSize('a3'), 'portrait', 3);
const marginMm = 25;
const marginPx = marginMm * page.pxPerMm;
const penWidthMm = 0.3;
const penWidthPx = penWidthMm * page.pxPerMm;

const result = generateBotanical({
  width: page.widthPx,
  height: page.heightPx,
  margin: marginPx,
  seed: 32,
  composition: 'specimen',
  seedCount: 2,
  stemFill: 'outline',
  leafStyle: 'veined',
  leafType: 'lance',
  leafArrangement: 'pinnate',
  leafletCount: 7,
  flowers: false,
  curl: 0.5,
  branchProb: 0.04,
  gravitropism: 0.55,
  taper: 0.88,
  vessel: 'none',
  groundLine: true,
  wobble: 0.6,
  penWidth: penWidthPx,
});

const size = 6.2 * page.pxPerMm; // ~6.2mm cap height
const line1 = 'PLATE I — IMPRESSION OF AN UNRECORDED FERN';
const line2 = 'CYANOTYPE STUDY · SEED 32 · FLOW LINES STUDIO';
const w1 = textWidth(line1, size);
const w2 = textWidth(line2, size * 0.72);
const cx = page.widthPx / 2;
const y1 = page.heightPx - marginPx - size * 2.9;
const y2 = y1 + size * 1.55;

const captionLines = [
  ...textToStrokes(line1, cx - w1 / 2, y1, size),
  ...textToStrokes(line2, cx - w2 / 2, y2, size * 0.72),
].map((points) => ({ points, layer: 'caption' }));

const combined = { ...result, lines: [...result.lines, ...captionLines] };

const svg = toSVG(combined, {
  strokeColor: '#f2f0e8',
  strokeWidth: penWidthPx,
  physicalWidth: `${page.widthMm}mm`,
  physicalHeight: `${page.heightMm}mm`,
  optimizePaths: true,
});

writeFileSync(process.argv[2] ?? 'fern-plate.svg', svg, 'utf-8');
```

```sh
node render-fern-plate.mjs fern-cyanotype.svg
```

`preview.png` was rendered with:

```sh
node scripts/svg-to-png.mjs fern-cyanotype.svg preview.png \
  --width 1600 --background '#123A5C' --stroke '#F4F1EA'
```

## Wishes

- `textToStrokes`/`textWidth` (`packages/core/src/stroke-font.ts`) are
  genuinely useful outside `planet` — any generator wants a plate
  caption occasionally — but aren't re-exported from the core barrel, so
  reaching them from a scratch script means importing the built file by
  its dist path instead of `@flow-lines/core`. Exporting them (even as a
  documented "advanced" export) would save the next session the same
  detour.
- `botanical`'s `specimen` composition always centres itself in the
  frame; there's no way to bias the root position off-centre (rule-of-
  thirds placement) without a wider custom canvas and asymmetric
  cropping after the fact. A `--anchor-x` (0–1 across the frame) would
  open up more dynamic single-specimen compositions.
