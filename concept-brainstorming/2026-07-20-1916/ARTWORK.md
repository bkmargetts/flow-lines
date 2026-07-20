# Plate I — Kintsugi

## Artist statement

金継ぎ (*kintsugi*) mends a broken vessel by tracing its fracture in gold —
the break becomes the most valuable part of the object, not the part to
hide. This piece takes the fracture generator's `shatter` preset (built
for impact cracks and old paint) and reads it the other way: not damage
in progress, but damage already honoured. One confident vein runs corner
to corner — long, tapered, unmistakably the "repair" — while a faint web
of finer cracks and a handful of hand-sized hatched shards sit almost out
of sight in the dark. Most of the sheet stays bare black paper. That
restraint is the whole point: a real mended plate isn't cracked
everywhere, and gold that ran over every hairline would read as gilt
wallpaper, not a repair.

I rendered a dozen seeds at this configuration before this one. Most
filled the page edge-to-edge with even, coloring-book crazing — technically
fine, dead as a composition. Seed 61 was the one where a single fault
line survives from the top margin to the bottom edge without competing
against anything else in the frame, with enough bare shard between
branches that the eye has somewhere to rest. It's the one I'd actually
want on a wall.

## Materials

- **Paper**: Colorplan Ebony (black), 270gsm smooth card, A3 (297×420mm).
  Black rather than white/cream so the gold reads as inlay, not ink on
  paper — the whole conceit depends on the ground being dark.
- **Pen 1 — the repair (bold seam)**: Sakura Gelly Roll Metallic, Gold
  (08, medium tip). Opaque metallic gel — one of the few pen families
  that lays down genuine gold on black card without a second coat.
  Approximate swatch: `#D9AD3F`.
- **Pen 2 — the glaze (fine hatch)**: Sakura Gelly Roll Metallic,
  Moonlight (pale pewter/graphite). A recessive metallic that only
  glints in raking light — the crazing should be found, not announced.
  Approximate swatch: `#5A4D3C`.
- Nothing else: no wash, no mounting adhesive beyond a standard float
  mount when framed.

## Process

1. Plot `artwork-gold-seams.svg` first, pen loaded with the Gelly Roll
   Gold. This is the `crack-primary` layer: the long, edge-driven
   fracture and its handful of primary branches, each built from 3
   tapered offset passes of the same pen (never a wider nib) so the
   seam reads as a poured, slightly irregular vein rather than a drawn
   line. ~10.4m of gold ink.
2. Swap to the Gelly Roll Moonlight pen. Re-register the sheet — no
   dowel pins needed since nothing moved; just don't nudge the paper
   between plots. Plot `artwork-pewter-glaze.svg` (the `plate` layer):
   sparse facet-hatching on ~17% of the shards the primary crack left
   behind, standing in for the ceramic's own fine crazing. ~5.6m of
   pewter ink.
3. Let both inks cure flat for at least an hour (metallic gel pigment
   sits on the surface longer than dye ink before it's scuff-proof).
4. Float-mount on black board, glazed. Keep the frame simple — the
   piece is doing quiet-loud contrast already; a heavy mat or ornate
   frame fights it.

No hand-drawn wash, no additional media. The generator's own
`crack-fine` generation was suppressed entirely (`--generations 1`) —
there is no third pen — because a hairline-fine third layer of cracks
tested busier without adding anything the gold seam or the pewter glaze
didn't already say.

## Plot settings

- Paper: A3, portrait, 297×420mm
- Margin: 15mm clear border all sides
- Render density: 3px/mm
- Pen width (base, before offset passes): 0.35mm
- Seed: 61
- Two plots, same registration, no offset between them

## Reproduction

Both SVGs come from a single deterministic CLI invocation (fracture's
`--split-layers` writes one file per pen layer from one simulation run,
so the two files are guaranteed to register against each other exactly):

```sh
pnpm --filter @flow-lines/cli build   # or: pnpm build

node packages/cli/dist/cli.js fracture \
  --paper a3 --orientation portrait --resolution 3 \
  --preset shatter --generations 1 --hatch-coverage 0.17 \
  --bold-passes 3 --taper 0.55 \
  --margin-mm 15 --pen-width-mm 0.35 \
  --seed 61 --split-layers \
  -o artwork.svg
```

This writes `artwork.crack-primary.svg` (renamed here to
`artwork-gold-seams.svg`) and `artwork.plate.svg` (renamed to
`artwork-pewter-glaze.svg`). Both are plain black-stroke SVGs, same as
every other generator output in this repo — the gold/pewter colours are
a property of the physical pen loaded for that plot, not the SVG, so the
files themselves don't encode colour.

`preview.png` was composited from the two SVGs with a one-off scratch
script (not part of the deliverable) that recoloured each layer's
strokes to its ink swatch and laid them over a `#0e0d0c` ground, then
rasterized with `scripts/svg-to-png.mjs`. The gist, for reference:

```js
// recolor each split-layer SVG's stroke, stack on a dark ground, rasterize
const primaryBody = extractInner(crackPrimarySvg).replace(/stroke="#000000"/g, 'stroke="#d9ad3f"');
const plateBody = extractInner(plateSvg).replace(/stroke="#000000"/g, 'stroke="#5a4d3c"');
// <rect fill="#0e0d0c"/> + <g>{plateBody}</g> + <g>{primaryBody}</g>, then:
// node scripts/svg-to-png.mjs composed.svg preview.png --width 1400
```

## Wishes

- `fracture`'s stress-field nucleation always spans the full sheet —
  there's no way to bias it toward a single point-of-impact origin
  (a true Lichtenberg-figure / single-strike read) short of clipping
  the output to a mask after the fact. Worth exploring as a preset or
  an `--origin x,y` option if this direction gets revisited.
- No flag to thin `crack-fine` independently of `generations` (it's
  all-or-nothing with the primary/plate split) — would have liked to
  keep one whisper-thin third layer without the full even-coverage
  hairline net that `generations 2` brings back.
