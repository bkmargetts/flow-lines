# Quarrel

## Artist statement

A *quarrel* is a small pane of glass set in lead came — the standard unit
of an old lattice window, long before float glass let anyone glaze an
opening in one sheet. It is also, older and more common, a fight. English
kept both meanings running side by side for centuries, which is either a
coincidence or isn't: a leaded window is a lattice of small compromises
holding a fragile thing together, and so is a quarrel in the other sense.
I wanted a piece that could hold both readings without picking one.

This came out of `impact-grid`, a generator built for shattered mosaics
that nothing in the existing gallery had used yet — it lays down a
pane of cells, each drawn in one of eight glazing textures (hatch,
cross-hatch, dots, waves, scales…), then compiles a drawn trajectory into
a speed-aware damage field: a channel term for how close the strike
passed, a pane-stress term radiating outward, zones graded dust →
cascade → cracked → intact. I fed it a synthetic "thrown stone" path —
three widely spaced points for the fast approach, then a tight
decelerating cluster where it comes to rest just inside the pane — and
told it to split the mosaic into two ink layers by damage, calm glass in
one, the broken zone in the other.

What survived the cull is the version where the strike lands left of
centre, a third of the way down, and travels down and right without ever
reaching an edge. Every earlier candidate that put the impact dead
centre, or let the debris blow out through a corner into the margin,
read as a diagram — a target, or a hole punched in a wall. This one
doesn't: the crack opens like a seam, wide at the top where the stone
went in and narrowing as it loses energy, with most of the pane —
eighty-some quarries of it — standing around the wound in the same
patchwork of hand-varied glazing it was in before. That patchwork
wasn't originally meant to read as anything; the generator just draws
each cell in a different texture so the mosaic reads as fabric rather
than a repeated tile. But a leaded window that has been reglazed in
different eras, by different hands, with whatever offcuts were on hand,
looks exactly like that — mismatched panes is not a flaw in an old
window, it's a record of every time it's been mended before. Giving this
one a second wound just adds to the record.

## Materials

- **Paper** — A3 (297 × 420 mm), portrait. A cool, pale stone-grey
  printmaking or pastel stock — Canson Mi-Teintes or similar in a
  dove/pearl-grey shade, 160–200 gsm, or any acid-free cold-press paper
  in a comparable cool neutral (hex reference `#cdd0d0`). Cool rather
  than warm on purpose — the piece wants overcast daylight through
  glass, not the aged-document warmth of the studio's other paper-toned
  pieces.
- **Ink 1 — "the glass"**: a warm near-black pigment ink, hex `#1a1712`.
  A technical pen (Rotring Rapidograph or equivalent) loaded with a
  lightfast black pigment ink, 0.4 mm line.
- **Ink 2 — "the wound"**: a lightfast burnt-sienna pigment ink, hex
  `#a33018`. Same pen type, same 0.4 mm line — only the cartridge
  changes between passes.
- Nothing else. No wash, no second sheet, no mount stock specified — see
  Process for the one optional hand step.

## Process

1. Cut the A3 sheet and tape it flat to the plotter bed. Home the pen.
2. Load the black pigment ink at 0.4 mm. Plot `artwork-black.svg` — the
   calm, undamaged glazing (8,417 strokes). This is the longer pass;
   let it run to completion before touching the pen.
3. Without moving or re-registering the sheet, swap to the burnt-sienna
   ink, same 0.4 mm width. Plot `artwork-sienna.svg` — the cracked and
   shattered zone (1,336 strokes). Both files share the exact same
   viewBox and physical dimensions, so a straight pen swap mid-job is
   the only registration step needed; nothing moves between passes.
4. Let the second ink cure per its own guidance before handling.
5. Optional, freehand, after the ink has fully cured: a very dry,
   near-empty brush loaded with a whisper of diluted burnt-sienna
   watercolour, dragged once along the outer edge of the crack on each
   side — not filling anything in, just softening the boundary the way
   grime collects at a break in real glazing. Test on an offcut first;
   the generator has no boundary export for the damage zone (see
   Wishes), so this step is judged by eye and is easy to overdo. The
   piece is complete without it.
6. Float-mount on a paper-white or pale grey board, generous margin —
   the piece depends on the calm quarries reading as calm, which needs
   air around the sheet, not a tight frame.

## Plot settings

- Paper: A3, 297 × 420 mm, portrait
- Margin: 20 mm
- Pen width: 0.4 mm, both layers
- Render density: 3 px/mm (`BASE_PX_PER_MM`)
- Seed: 7
- Two pens, two passes, one sheet, no re-registration required
- Output: 9,753 strokes total — 8,417 on the black layer, 1,336 on the
  sienna layer
- Reordered for pen-travel only (`orderPlot`, the generator's own
  default) — the mosaic is built from discrete cell shapes and shards,
  so full endpoint-chaining is correctly not used (see CLAUDE.md's note
  on `optimizePlot` vs `orderPlot`)

## Reproduction

There is no CLI command for `impact-grid` yet, so this is a scratch
script against the built core package:

```sh
pnpm --filter @flow-lines/core build
node quarrel.mjs ./out
```

`quarrel.mjs`, byte-for-byte reproducible at seed 7:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const coreDist = '/home/user/flow-lines/packages/core/dist/index.js';
const { generateImpactGrid, toSVG, toSVGLayers, getPaperSize, pageMetrics } = await import(coreDist);

const outDir = resolve(process.argv[2] ?? '.');
mkdirSync(outDir, { recursive: true });

const PX_PER_MM = 3; // BASE_PX_PER_MM
const MARGIN_MM = 20;
const PEN_MM = 0.4;
const SEED = 7;

const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'portrait', PX_PER_MM);
const { widthPx: W, heightPx: H, widthMm, heightMm } = metrics;
const margin = MARGIN_MM * PX_PER_MM;
const penWidth = PEN_MM * PX_PER_MM;
const innerMin = Math.min(W - 2 * margin, H - 2 * margin);

// A decelerating "thrown stone" trajectory: three widely-spaced points
// approaching fast from outside the pane, then a short cluster of closely
// spaced points (an ease-out) where it comes to rest just inside — the
// wide gaps read as speed, the tight cluster as the strike decelerating.
function throwPath(entry, angleDeg, approachLen, embedLen) {
  const [ex, ey] = entry;
  const a = (angleDeg * Math.PI) / 180;
  const dir = [Math.cos(a), Math.sin(a)];
  const pts = [];
  for (let i = 3; i >= 1; i--) {
    pts.push({ x: ex - dir[0] * approachLen * (i / 3), y: ey - dir[1] * approachLen * (i / 3) });
  }
  pts.push({ x: ex, y: ey });
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = 1 - Math.pow(1 - t, 3);
    pts.push({ x: ex + dir[0] * embedLen * eased, y: ey + dir[1] * embedLen * eased });
  }
  return pts;
}

const entry = [margin + (W - 2 * margin) * 0.38, margin + (H - 2 * margin) * 0.55];
const impactPath = throwPath(entry, -128, innerMin * 0.35, innerMin * 0.05);

const res = generateImpactGrid({
  width: W, height: H, margin, penWidth, seed: SEED, impactPath,

  region: 'slab',
  layout: 'grid',
  cellSize: innerMin / 11,
  sizeVariation: 0.08,
  positionJitter: 0.15,
  rotationJitter: 0.1,
  gap: 0.1,

  energy: 0.55,
  paneStress: 0.45,
  focus: 0.45,
  drift: 0.3,
  impactStrength: 0,
  shatter: 0.55,
  scatter: 0.2,
  debris: 0.12,
  crush: 0.5,
  sweep: 0.5,

  fill: 0.7,
  toneRange: 0.6,
  fillStyle: 'texture',
  inks: 2,
  inkBalance: 0.62,
  inkMode: 'damage',
  inkPath: false,
  occlude: true,
  wobble: 0.08,
});

const svgOpts = {
  strokeWidth: penWidth,
  physicalWidth: `${widthMm}mm`,
  physicalHeight: `${heightMm}mm`,
};
const INK_BLACK = '#1a1712';
const INK_SIENNA = '#a33018';

const layers = toSVGLayers(res, { ...svgOpts, layerColors: { 'ink-0': INK_BLACK, 'ink-1': INK_SIENNA } });
for (const { layer, svg } of layers) {
  const name = layer === 'ink-1' ? 'artwork-sienna.svg' : 'artwork-black.svg';
  writeFileSync(join(outDir, name), svg);
}

const combined = toSVG(res, { ...svgOpts, layerColors: { 'ink-0': INK_BLACK, 'ink-1': INK_SIENNA } });
writeFileSync(join(outDir, 'artwork.svg'), combined);
```

Preview (both inks composited on the paper tone):

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#cdd0d0'
```

## Candidates considered

- **Impact dead centre.** Technically the cleanest read of the damage
  model, but a centred hole in a centred grid reads as a target or a
  diagram, not an event. Discarded — the same lesson this studio hit
  with a centred crowd ring in an earlier session.
- **Corner strikes, debris blown out through the frame edge into the
  margin.** Dramatic and legible as "something hit this," but the
  spray of shards escaping past the window's own silhouette reads as
  an explosion, not a quarrel — too much violence, not enough
  containment. The piece needed the damage to stay inside the leading,
  the way a real pane holds a crack even when it doesn't hold the
  glass.
- **`fillStyle: 'hatch'` (uniform diagonal hatch, no per-cell texture
  variety).** Calmer and more architectural — closer to a technical
  elevation — but it throws away the "many hands, many repairs"
  reading that makes the mismatched glazing mean something. Kept
  `'texture'` once the story around it was clear.
- **`fillStyle: 'concentric'` (bullseye rings in every cell).**
  Gorgeous on its own — genuine antique crown-glass panes do look like
  this — but applied uniformly it turns hypnotic and the crack stops
  being the thing you look at first. Filed away as a strong option for
  a future piece built around bullseye glass specifically.
- **`fill: 1` (every cell patterned, no plain panes).** Busier than it
  needed to be; dropping to `0.7` let roughly three panes in ten stand
  as plain clear glass, which reads as more believable glazing and
  gives the eye somewhere to rest between the denser textures.

## Wishes

- `impact-grid` has no way to export the damage-zone boundary (per-cell
  `D` value, or a traced outline of the cracked region) as a
  side-channel. The optional wash step in Process is eyeballed for
  exactly this reason; a future piece built around registered colour
  washing the damage zone precisely (rather than a loose freehand
  gesture at the edge) would need that boundary data exported
  alongside the SVG, the same gap noted for `lapidary`'s strata bands
  in a recent session.
- `impact-grid` currently has no CLI command (unlike `lapidary`, which
  gained one recently) — every iteration this session went through a
  scratch script. Given how expressive the `region`/`layout`/damage
  parameters already are, a `flow-lines impact-grid` command mirroring
  `lapidary`'s would make this generator much easier to reach for.
