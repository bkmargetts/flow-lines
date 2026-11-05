# Kintsugi Night

## Artist statement
A sheet of midnight paper that has shattered and been mended. The plates
are hatched in cool pale-blue ink, each facet at its own angle, like cut
glass catching light; the fractures between them are filled with gold,
the way kintsugi honours a break instead of hiding it. Several plates are
left as bare dark paper — voids that read as missing shards.

It survived the cull because it is a single generator (`fracture`,
`shatter` preset) turned into a material idea by one decision: splitting
the cracks and the plates onto separate pens. Earlier candidates (botanical
specimen, lava planet, crazing/mud networks) were either too thin or too
busy; the shatter's big committed facets and its restraint (paper doing the
work) hold a wall at distance and reward close inspection.

## Materials
- Paper: black or deep navy card, ~250 gsm smooth (e.g. Colorplan "Ultra
  Black" or a navy equivalent), A3 297×420 mm, portrait. Preview assumes
  navy `#1d2433`.
- Pen 1 (layer `plate`): pale blue gel pen 0.3–0.4 mm, e.g. Sakura Gelly
  Roll Moonlight "Light Blue" / hex approx `#9fb4d6`.
- Pen 2 (layers `crack-fine` and `crack-primary`): gold/metallic gel or
  paint pen 0.5 mm (Uni-ball Signo Gold, or Pentel Milky/Gold), hex approx
  `#d9a441`.
- Low-tack artist tape, a clear sealed float mount frame (black or
  walnut), optional gold leaf size for hand step.

## Process
1. Tape the card flat to the plotter bed; register with the page margin
   (20 mm clear border all round).
2. Plot `artwork.plate.svg` with the pale-blue pen (5782 strokes). Let the
   gel ink dry fully (~30 min) — metallic gold smears wet blue.
3. Without moving the sheet, swap pens and plot
   `artwork.crack-fine.svg` (47 strokes), then `artwork.crack-primary.svg`
   (107 strokes) in gold. Cracks run over plate hatch edges slightly by
   design; tiny misregistration reads as hand work.
4. Optional hand step: with the gold pen, go over the 6–8 longest primary
   cracks a second time by hand to build metallic body.
5. Float-mount in a deep black frame, no glass contact (gel ink scuffs).

## Plot settings
A3 portrait, 20 mm margin, pen width 0.3 mm, 5936 strokes total, output
already optimised for pen travel by the generator.

## Reproduction
```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js fracture --preset shatter --paper a3 \
  --orientation portrait --margin-mm 20 --pen-width-mm 0.3 --seed 4 \
  --split-layers -o artwork.svg
```
Writes `artwork.plate.svg`, `artwork.crack-fine.svg`,
`artwork.crack-primary.svg` (verified byte-identical on re-run).
Preview: layers merged with plate `#9fb4d6`, fine cracks `#d9a441`,
primary cracks `#e8b955` on `#1d2433`, rasterized with
`scripts/svg-to-png.mjs --width 1400`.

## Wishes
- A `--layer-colors` option so a coloured multi-layer preview could be
  produced directly from the CLI.
- Per-facet hatch ink choice (e.g. a second blue on a random subset of
  plates) for a stained-glass effect.
