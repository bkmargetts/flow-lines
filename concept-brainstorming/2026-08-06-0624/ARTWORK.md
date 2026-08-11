# Vernier

## Artist statement

Every multi-pass plot carries a small, usually unwanted risk: the pen
comes back a fraction of a millimetre off register between passes, and a
careful drawing goes soft at the edges. This piece is built entirely out
of that risk. Three fineliners — indigo, black, vermilion — rule the same
folded band of paper at almost, but not quite, the same pitch, each
nudged by its own seeded misregistration. Where the three rulings agree,
the page reads as a single clean grey. Where they drift apart, the
mismatch itself becomes the drawing: slow beats of colour sweeping around
the curve, the way a vernier calliper's two scales slide in and out of
alignment until exactly one pair of ticks lines up. The name is a small
joke at the generator's own expense — its pitch-mismatch parameter is
called `pitchDelta` in the code, but the doc comment above it already
uses the word "vernier."

`ink-field` hasn't been used by any prior session here, and its `ribbon`
style — a single drafted band walked in seeded 45°-quantised turns
through the sheet — throws up a huge range of forms depending on how much
room the walk gets relative to the band's own width. Wide bands on a
tight box can't turn at all and just sit as a rectangle; very narrow
bands turn so freely the result reads as a tangle. This seed, at this
width, folds back on itself exactly once: the band loops into a rounded
capsule and its two ends cross near the bottom, pinching a short paper-
white slit where the pen lifts clean out of the band. That slit — plus
the double-density interference square where the crossing overlaps
itself — was the detail that won it the cull. Two dozen other seeds gave
looser glyph-like coils (much prettier as thumbnails, incidentally — a
lot of them read as stray digits, "2," "6," "9") but this one has the
quiet, singular presence of an emblem rather than a diagram, and holds up
at arm's length in a way the busier coils didn't.

## Materials

- **Paper:** Strathmore 500 Series Bristol, Smooth (Plate) finish,
  300gsm, bright white, trimmed to A3 (297×420mm) portrait. A hot-press /
  plate finish is deliberate — this piece lives or dies on 0.3mm lines
  holding dead straight and dead thin at ~1mm pitch; any tooth would fur
  the fine parallel rulings and kill the interference effect.
- **Ink 1 — Prussian Blue / Indigo**, hex `#173d73`. Fine technical
  fineliner or a refillable technical pen (e.g. Rotring Isograph) loaded
  with a pigmented indigo drawing ink, 0.3mm nib.
- **Ink 2 — Carbon Black**, hex `#1a1a1a`. Same pen/nib size, black
  pigment ink (e.g. Sakura Pigma Micron 03, or the same refillable
  technical pen with black ink).
- **Ink 3 — Vermilion / Burnt Sienna**, hex `#b5432a`. Same pen/nib size,
  a warm red-orange pigment ink.
- No wash, no mounting media — the piece is finished at the plot. Float
  mount in a deep frame with a shadow gap, glass or UV-filtering acrylic
  (pigment inks are lightfast but the piece rewards being looked at
  close, and glare on a glazed frame would hide the fine banding).

## Process

1. Trim the Bristol to A3 (297×420mm) and tape it to the plotter bed,
   portrait orientation, squared to the bed's home position.
2. Load the indigo pen (0.3mm). Plot `artwork.register.svg` — four small
   corner crosses, 3mm in from the sheet edge, coloured to match this ink
   by default — then `artwork.band-00.svg`, the reference pass (ink 0
   carries no misregistration offset; every other ink is measured from
   it). The crosses are functional if the sheet has to be removed and
   reloaded between pens (re-home against them before every subsequent
   pass) and, either way, are left in the finished piece as its one nod
   to its own machinery — a technical drawing's proof marks, kept rather
   than trimmed off.
3. Swap to the black pen (0.3mm). Plot `artwork.band-01.svg`.
4. Swap to the vermilion pen (0.3mm). Plot `artwork.band-02.svg`.
5. Let the ink cure ~10 minutes before handling. Float-mount; no other
   finishing.

Total drawn line across the three passes is about 175m (64.5m indigo,
58.1m black, 52.5m vermilion) — `optimizePlot` chains and orders each
pass on its own, so pen-up travel between the parallel rulings is
minimal.

## Plot settings

- Paper: A3 (297×420mm), portrait, `--margin-mm 10`
- Pen width: 0.3mm, all three inks
- Resolution: 3 px/mm (tool default)
- Registration crosses: on, 3mm offset from the sheet edge

## Reproduction

Built at the repo root after `pnpm install && pnpm build`:

```sh
node packages/cli/dist/cli.js ink-field \
  --style ribbon \
  --paper a3 --orientation portrait \
  --seed 41 \
  --inks 3 --ink-colors '#173d73,#1a1a1a,#b5432a' \
  --pitch-mm 1.0 --pitch-delta 0.08 --phase-drift 2.4 \
  --misregister-mm 0.5 \
  --band-width-mm 90 --segments 6 \
  --pen-width-mm 0.3 \
  --crosses --split-layers \
  -o artwork.svg
```

This writes `artwork.band-00.svg` (indigo), `artwork.band-01.svg`
(black), `artwork.band-02.svg` (vermilion), and `artwork.register.svg`
(the four corner crosses) — the exact files in this folder.

`preview.png` is the same render without `--split-layers` (so all three
inks composite with `mix-blend-mode: multiply` in one file), rasterized
over the paper colour:

```sh
node packages/cli/dist/cli.js ink-field \
  --style ribbon \
  --paper a3 --orientation portrait \
  --seed 41 \
  --inks 3 --ink-colors '#173d73,#1a1a1a,#b5432a' \
  --pitch-mm 1.0 --pitch-delta 0.08 --phase-drift 2.4 \
  --misregister-mm 0.5 \
  --band-width-mm 90 --segments 6 \
  --pen-width-mm 0.3 \
  --crosses \
  -o combined.svg

node scripts/svg-to-png.mjs combined.svg preview.png \
  --width 1600 --background '#f8f6f0'
```

## Wishes

- `ink-field --style ribbon` has no way to bias where the skeleton walk
  starts or how tightly it's allowed to loop — composition is entirely a
  function of seed versus band-width-to-box ratio, found here by
  rendering ~30 seeds at low res and eyeballing. A `--ribbon-loop-bias`
  or similar knob that nudges the walk toward folding back on itself
  (instead of pure seeded chance) would make this whole family of
  compositions easier to aim rather than mine for.
