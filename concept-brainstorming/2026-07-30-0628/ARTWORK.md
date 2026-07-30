# Labyrinthiformis

## Artist statement

*Diploria labyrinthiformis* — grooved brain coral, also called symmetrical
brain coral — was named for the obvious thing: its surface is packed
edge to edge with continuous winding ridges and valleys, a living maze
with no entrance and no centre. Nobody chose that pattern. A coral head
is a colony of genetically identical polyps that can only grow outward
and can't grow through each other; forced to add area inside a fixed,
slowly expanding boundary, the growing tissue has nowhere to put its
extra length except into folds. It is the same mechanical answer soft,
confined, growing tissue always gives — the same reason a gut lining
grows villi and a smooth fetal brain buckles into gyri and sulci as it
outgrows its own skull. Different tissues, same arithmetic: growth minus
room equals folding.

This repo's coral generator (`packages/core/src/coral`) runs that
arithmetic directly rather than drawing a picture of it: a closed loop of
nodes springs toward its neighbours, smooths, and repels anything nearby,
while noise-gated edge insertion hands the curve length it has no space
for. It has no idea what a coral looks like. Left at its presets it kept
proving that in the wrong direction — `reef`, `brain`, and `bloom` all
converged on a dense radiating burst, tendrils fanning from one centre
like a sea anemone or a Haeckel radiolarian plate; scattering three
`blobs` founder-colonies for a fuller composition just produced three
near-identical rosettes sitting next to each other, three of the same
decorative flower, which reads as a pattern stamped three times rather
than a single grown thing. Both are real differential growth and both
were the wrong subject.

What broke the radiating symmetry was turning `curvatureBias` down
(0.15 — growth stops preferring to push hardest at existing outward
tips) and stopping the simulation earlier (240 steps, well short of the
`reef`/`brain` presets' 420–550) so the loop never gets the chance to
resolve into clean spokes. What's left is one closed colony, folding
into itself edge to edge with no single point it radiates from — the
meandroid ridge-and-valley texture that gave the real species its Latin
name a century before anyone modelled the mechanics, arrived at here by
an algorithm with no botanical or biological input at all. That
convergence — the same folded-maze answer, reached twice for the same
structural reason, once by a reef and once by a spring-and-repulsion
simulation that has never seen a photograph of one — is the whole
piece.

Colour carries a second idea the linework alone can't: the generator
keeps a growth history (onion-skin rings of every earlier boundary,
fragmenting with age) behind the final silhouette, and rather than plot
that history in the same ink as the present colony, this piece separates
them by pass. The bold outer folds — built from four offset single-pen
passes, never a wider stroke — plot in a warm coral orange, the only
warm mark on the sheet. Everything the colony used to be plots underneath
it in a cool bone white: fine, single-pass, fragmenting toward the
oldest rings near the centre. One colony, one continuous physical
process, two temperatures of ink — what it is now, and the pale record
of what it grew through to get there.

## Materials

- **Paper:** one sheet, A3 portrait (297×420mm), heavyweight (270–300gsm)
  cotton-blend cover stock in a deep teal/petrol ground, close to
  `#0d4d4a` — e.g. GF Smith Colorplan "Kingfisher Blue" or an equivalent
  deep-teal cover stock. Smooth enough finish for gel ink to lay down
  without feathering.
- **Ink pass 1 (history, plotted first):** Sakura Gelly Roll Moonlight
  gel pen, colour **White** (opaque pigment gel, ~0.6mm ball) — bone
  white, close to `#f4f2ea`.
- **Ink pass 2 (edge, plotted second):** Sakura Gelly Roll Moonlight gel
  pen, colour **Sunset** (opaque pigment gel, ~0.6mm ball) — coral
  orange, close to `#ff8145`.
- Both pens plot at the same physical line width (0.4mm, set via
  `--pen-width-mm` at generation time); the bold silhouette's weight
  comes from four offset single-pen passes, not a wider nib.

## Process

1. Generate `artwork-history.svg` and `artwork-edge.svg` with the coral
   CLI command below (identical seed, identical viewBox/physical size —
   they register on the same sheet with no adjustment).
2. Load the teal A3 sheet on the plotter bed; set the working origin and
   don't move the sheet again until both passes are done.
3. **Pass 1 — history.** Load the White Gelly Roll Moonlight pen. Plot
   `artwork-history.svg` (18 chained strokes: the fragmenting onion-skin
   rings). Gel ink is slow-drying — let the sheet sit flat and untouched
   for 15–20 minutes before the second pass.
4. **Pass 2 — edge.** Swap to the Sunset (orange) Gelly Roll Moonlight
   pen without moving or re-homing the sheet. Plot `artwork-edge.svg`
   (2 chained strokes — the bold final silhouette, already carrying its
   4 offset emphasis passes). Let dry flat for at least 20–30 minutes
   before handling.
5. **Finish:** float-mount in a deep-set frame with no mat, so the
   teal card's cut edge stays visible at the border — a specimen board,
   not a picture window.

## Plot settings

- Paper: A3, portrait, 25mm margin.
- Pen width: 0.4mm (both passes).
- Render density: 3px/mm (891×1260px canvas).
- Seed: 63. Pen travel: minimal — `optimizePlot` (on by default) already
  chains the growth into 2 continuous strokes for the edge pass and 18
  for the history pass; no further path-order tuning was needed.

## Reproduction

Built with `@flow-lines/cli` (`pnpm install && pnpm build` at the repo
root first). Both layers come from one command via `--split-layers`,
then the two history sub-layers (`ring` + `relic`) are merged into a
single file for their shared ink pass:

```sh
node packages/cli/dist/cli.js coral \
  --paper a3 --orientation portrait --margin-mm 25 --pen-width-mm 0.4 --resolution 3 \
  --preset reef --seed-shape circle --seed 63 \
  --fold-div 14 --rings 4 --fade 0.35 --bold-passes 4 \
  --iterations 240 --curvature-bias 0.15 --patchiness 0.5 \
  --split-layers \
  -o artwork.svg
# writes artwork.edge.svg, artwork.ring.svg, artwork.relic.svg
```

Merge the two history sub-layers (same viewBox/physical size, so a plain
path-element concatenation is exact) and rename the edge layer:

```js
// merge-history.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const ring = readFileSync('artwork.ring.svg', 'utf8');
const relic = readFileSync('artwork.relic.svg', 'utf8');
const header = ring.match(/^[\s\S]*?<svg[^>]*>\n/)[0];
const paths = (svg) => [...svg.matchAll(/  <path[^>]*\/>\n/g)].map((m) => m[0]);
writeFileSync(
  'artwork-history.svg',
  header + paths(relic).join('') + paths(ring).join('') + '</svg>\n'
);
```

```sh
node merge-history.mjs
mv artwork.edge.svg artwork-edge.svg
rm artwork.ring.svg artwork.relic.svg
```

`preview.png` approximates the physical piece — teal ground, orange
edge ink, bone-white history ink — via a small compositing script before
rasterizing with `scripts/svg-to-png.mjs`:

```js
// compose-preview.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const [, , edgePath, historyPath, outPath] = process.argv;
const TEAL = '#0d4d4a', CORAL = '#ff8145', BONE = '#f4f2ea';
const edge = readFileSync(edgePath, 'utf8');
const history = readFileSync(historyPath, 'utf8');
const header = edge.match(/^[\s\S]*?<svg[^>]*>\n/)[0];
const [, w, h] = header.match(/viewBox="0 0 (\d+) (\d+)"/);
const bg = `  <rect width="${w}" height="${h}" fill="${TEAL}"/>\n`;
const recolor = (svg, color) =>
  [...svg.matchAll(/  <path[^>]*\/>\n/g)].map((m) => m[0].replace(/stroke="#000000"/, `stroke="${color}"`));
writeFileSync(
  outPath,
  header + bg + recolor(history, BONE).join('') + recolor(edge, CORAL).join('') + '</svg>\n'
);
```

```sh
node compose-preview.mjs artwork-edge.svg artwork-history.svg preview-colour.svg
node scripts/svg-to-png.mjs preview-colour.svg preview.png --width 1600 --background '#0d4d4a'
```

## Wishes

- `CoralOptions` has no way to offset the seed loop's centre away from
  the page centre — every circle/polygon-seed composition is centred by
  construction. A `seedCenter: {x, y}` (or fractional `seedOffset`)
  option would open up off-centre, "resting low on the sheet" specimen
  compositions without needing post-hoc SVG translation.
