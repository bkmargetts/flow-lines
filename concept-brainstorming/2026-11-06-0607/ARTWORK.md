# Meltline

## Artist statement

A uniformly random domino tiling of an Aztec diamond, inked in two colours: indigo where the tiling froze into north-facing dominoes, vermilion where it froze south-facing. Nothing in the code mentions a circle or a colour gradient. The sharp curved boundary where order gives way to chaos (the *arctic circle*) is a theorem, and the shift from blue to red through a speckled middle band is the same theorem drawn with two pens.

It reads as a lozenge, a gem, or a drop of ink with a cold pole and a hot pole, and as the ground between two weathers. It survived the cull because it is almost nothing: one stroke type, two inks, plenty of paper. The ordered ends look like ruled engraving and the middle looks like hand-flicked dashes. I rejected the four-pen "weave", the single-pen "dissolve" and the all-outline "brick" renders. They were handsome but monochrome, or read as a screen. Two colours let the interlock show, because the two classes tile each other exactly.

## Materials

- **Paper:** warm natural cream, hot-press, 300 gsm (Hahnemühle Bamboo or similar), A3 (297 × 420 mm), approx. #F1EBDD.
- **Pen 1, indigo:** 0.35 mm fineliner or gel pen, "Prussian/Indigo Blue", approx. #1B3A6B (Sailor Sei-boku or Platinum Carbon Blue-Black).
- **Pen 2, vermilion:** 0.35 mm, "Vermilion/Brick Red", approx. #B4472A (e.g. Sakura Pigma Micron-equivalent in brick red, or a Posca PC-1MR in a similar red).
- Backing board, low-tack tape, optional float mount with a 60 mm white mat.

## Process

1. Tape the sheet to the plotter bed at the corners. Mark the registration corners.
2. Load pen 1 (indigo, 0.35 mm). Plot `artwork-layer-1-indigo.svg` at 100% on A3 portrait.
3. Let the ink dry 15 minutes. Swap to pen 2 (vermilion, 0.35 mm). Without moving the sheet, plot `artwork-layer-2-vermilion.svg`.
4. Dashes of the two colours never overlap by construction, so registration errors show as slightly uneven gaps, not as muddy overprint. Do not correct them.
5. Optional hand step: with a dry brush, lay one faint tea-stain wash of diluted sepia across the paper margin only, to warm the border. Keep it off the drawing.
6. Float-mount on a white mat.

## Plot settings

A3 portrait, 25 mm margin, 0.35 mm pen on both layers, 983 strokes per layer (1,966 total), orderPlot reordering on. Pen travel is low since the strokes are horizontal runs sorted by row.

## Reproduction

Build first (`pnpm install && pnpm build`), then save this as a script and run it from the repo root as `node script.mjs <outDir>`:

```js
// run from repo root: node final.mjs <outDir>
import { writeFileSync } from 'node:fs';
const c = await import(process.cwd() + '/packages/core/dist/index.js');
const k = 96 / 25.4;
const r = c.generateArctic({ width: 297*k, height: 420*k, margin: 25*k, seed: 3, order: 90, preset: 'horizon', wobble: 0.4 });
const opts = { physicalWidth: 297, physicalHeight: 420, strokeWidth: 0.35*k };
for (const { layer, svg } of c.toSVGLayers(r, opts))
  writeFileSync(`${process.argv[2]}/artwork-${layer === 'domino-n' ? 'layer-1-indigo' : 'layer-2-vermilion'}.svg`, svg);
```

The preview was made by overlaying the two layers on #F1EBDD with strokes recoloured to #1B3A6B and #B4472A, then rasterised with `node scripts/svg-to-png.mjs … --width 1600`.

## Wishes

- A CLI `arctic` command with `--split-layers`.
- A choice of which domino class is inked, so that two classes could go on one sheet in a chosen colour pair.
- A cross-section variant, with the tiling sliced and each half plotted on separate sheets.
