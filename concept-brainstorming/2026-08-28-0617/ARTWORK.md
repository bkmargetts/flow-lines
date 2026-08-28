# Firn Line

## Artist statement

This is a single, uniformly random domino tiling of an Aztec diamond,
inked by whether a domino points north.

That sentence describes the entire drawing. Nothing else touched the
page. The repo's `arctic` generator (`packages/core/src/arctic/`) samples
a tiling of AD(240) — 240×241 dominoes — by domino shuffling
(Elkies–Kuperberg–Larsen–Propp), which is not an approximation or a
Markov chain that has to mix; it draws exactly, provably, from the
uniform distribution over all tilings of that shape, in one pass,
deterministic per seed. It has sat in this repo, exported from the
package barrel, with a full write-up in its own doc comment — and, as
far as this studio's 34 prior sessions show, nobody had rendered it once.
I went looking specifically for a generator nobody had used, and this is
the one that stopped me.

What earns it a wall is the arctic circle theorem (Jockusch–Propp–Shor,
1998), and it is the reason the generator has this name at all. As the
diamond grows, the tiling doesn't stay uniformly disordered. It *freezes*
at the four corners — the dominoes there are forced into perfect brick
courses, no randomness left — while an almost perfect circle, inscribed
in the diamond, bounds a region that stays genuinely disordered no
matter how large the diamond gets. Outside that circle: order. Inside:
noise. The boundary between them sharpens to a hairline as n grows, and
nothing in the sampling algorithm mentions a circle, a boundary, or a
gradient — it falls out of the combinatorics on its own. The theorem's
own authors reached for the vocabulary of ice sheets to describe it —
frozen corners, a temperate interior — and that is not a metaphor I
imported; the paper is the field's coinage.

`marks.ts` turns that into tone the honest way: ink one domino class as
a spine, and in that class's frozen corner the spines are collinear and
weld into long unbroken rules — solid black. In the other three frozen
corners nothing of that class exists at all — bare paper. Inside the
circle the class turns up at random, so the spines stay short and never
weld — a scatter of dashes, thinning as the disorder gets less dense
toward the paper. Three textures, one theorem, no shading anywhere in
the code.

At the resolution this piece plots at (a 0.56mm domino pitch on A3), the
frozen/liquid boundary doesn't render as a smooth arc — it renders as a
jagged, crenellated skyline, because the freeze happens one domino at a
time and the last few rows before it give way are visibly ragged. Run
across two dozen seeds looking for the one where that ragged edge reads
best, seed 21 produced a silhouette with real variation in it — a tall
central mass, subordinate peaks either side, one clean saddle — that
looks exactly like a mountain range's skyline against an evening sky,
by accident, because a combinatorial phase boundary and a ridgeline
are shaped by the same kind of process: something orderly holding a
line against something disordered, one grain at a time. Below the ridge,
the dashes that were dense rock face a few rows up thin into a scatter
that reads as scree, then meltwater, then nothing — paper. That thinning
scatter is exactly what a glaciologist calls the **firn line**: the
boundary partway down a glacier where the permanent, compacted snow of
the accumulation zone gives way to the ablation zone, where every
previous winter's snow melts off and exposes bare, broken ice beneath.
The generator wasn't built to draw a glacier. It drew one anyway, because
freezing-into-order-versus-dissolving-into-noise is the same shape
whether the units are dominoes or snow grains.

## Materials

- **Paper** — A3 (297×420mm), cold-pressed, 250–270gsm, toned pale
  ice-blue, hex approx. `#DBE6EE`. Canson Mi-Teintes' pale-blue sheet (or
  any equivalent toned printmaking cover stock) works straight out of
  the pad; failing that, lay one thin, even wash of ultramarine + a
  whisper of lamp black over a smooth hot-press white sheet and let it
  dry fully flat before plotting — the ink pass below needs a dead-flat,
  unbuckled surface.
- **Ink** — Diamine *Registrar's Ink*, a genuine document/permanent ink
  (deep blue-black, waterproof once cured), hex approx. `#16213E`,
  loaded into a refillable technical pen — a Rotring Isograph 0.25mm is
  the standard plotter fit. One pen, one width, the whole piece: every
  line in the drawing, from the solid rules at the summit to the last
  scattered dash near the bottom edge, is the same nib doing the same
  thing. The tone is 100% a property of the tiling, and the ink pass
  should be just as flat and undifferentiated — resist the urge to bear
  down harder in the dense areas.
- **Mount** — archival black conservation board, float-mounted (paper
  edges left visible, not trimmed to the image), in a deep box frame
  (~30mm rebate) with a small air gap and UV-filtering non-glare glazing.

## Process

1. Cut/select the A3 sheet; if hand-toning, wash and dry it flat first
   (see Materials) — check it's bone dry and unbuckled before plotting,
   or the pen will skip on any residual damp cockle.
2. Load the pen with Registrar's Ink, fit the 0.25mm nib, and confirm
   flow on scrap before touching the sheet — a starved nib will drop the
   finest dashes near the bottom of the drawing, which is exactly the
   detail the piece depends on.
3. Plot `artwork.svg` at A3, portrait, no rotation, on the toned sheet.
   Pen-up travel is short relative to line count (6,670 strokes,
   already reorder-optimized — see Plot settings) so a single pass at
   moderate speed should finish without a pen change.
4. Let the ink cure fully (Registrar's Ink is slow — give it a full 24
   hours flat before handling) before matting.
5. Float-mount on the black board: adhere only along the top edge with
   photo-safe hinges so the sheet hangs true and the deckle/plotted edge
   stays visible against the black ground — the paper should read as
   suspended in dark space, not butted to a mat window.
6. Frame with the air gap and UV glazing described above.

No other pass, wash, or hand mark touches the drawing. That restraint is
part of the piece: the code makes the claim that the tone here is
100% structural, nothing invented — the physical object should make the
same claim and be checkable against it.

## Plot settings

- Paper: A3, portrait, 297×420mm
- Margin: 15mm
- Pen: 0.25mm, single colour, single pass
- Resolution used for generation: 6px/mm (no downsampling — full detail
  reaches the plotter)
- Line count: 6,670 strokes, reorder-optimized (`orderPlot`, not
  chaining — the generator itself refuses to fuse separate dominoes into
  one path, since that would round-cap the welded rules and soften the
  one edge the piece is about)

## Reproduction

There is no CLI command for `arctic` yet (see Wishes) — it's driven
directly off the built core package, same pattern as
`scripts/city-gallery.mjs`. From a repo with `pnpm install && pnpm build`
already run:

```js
// node arctic-firn-line.mjs artwork.svg
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const { generateArctic, toSVG, pageMetrics, getPaperSize } = await import(coreDist);

const paper = getPaperSize('a3');
const pm = pageMetrics(paper, 'portrait', 6); // 6 px/mm, no resolution cap
const marginMm = 15;
const penWidthMm = 0.25;

const res = generateArctic({
  width: pm.widthPx,
  height: pm.heightPx,
  margin: marginMm * pm.pxPerMm,
  seed: 21,
  preset: 'dissolve', // inks one domino class only — the sharpest reading
  order: 240,          // AD(240): 240x241 dominoes, ~0.56mm pitch at A3
  // wobble and optimize left at their defaults (0.35 / true)
});

const svg = toSVG(res, {
  strokeColor: '#000000',
  strokeWidth: penWidthMm * pm.pxPerMm,
  physicalWidth: `${pm.widthMm}mm`,
  physicalHeight: `${pm.heightMm}mm`,
});

writeFileSync(process.argv[2], svg, 'utf-8');
```

`preview.png` was rendered from `artwork.svg` with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png --width 1600 \
  --background '#dbe6ee' --stroke '#16213e'
```

## Wishes

- No CLI command wraps `generateArctic` yet — every other core generator
  in the toolbox table has a `flow-lines <command>`, and this one is
  arguably the most self-contained (no image inputs, three numeric
  knobs). A thin `flow-lines arctic` command would drop the scratch
  script above entirely.
- `ArcticOptions.marks` only accepts the four named presets
  (`one`/`horizontals`/`all`/`outline`), each hardcoded to a specific
  domino-class subset (`one` is always class `N`). Exposing the raw
  `DominoClass[]` selection — even just letting `one` take a class
  argument — would let a piece choose which corner freezes solid instead
  of always the same one, useful for anyone wanting the mountain to sit
  in a different corner of the sheet, or for a multi-pen piece that inks
  two classes in two colours without going all the way to `horizontals`.
