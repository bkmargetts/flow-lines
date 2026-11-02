# Lantern Moon, Wired

## Artist statement

Most of the studio's planet work so far has been black on cream, plate-style.
This inverts it: the `planet` generator's moon, drawn in light ink on black
card, reads less like a diagram and more like a lamp. Hatch lines hug the
terminator and thin to nothing toward the lit limb, while a low sun
(`--light-elevation 12`) rakes across 140 craters with central peaks and four
sinuous rilles. Where the hatching overlaps it weaves into a wire-mesh
sphere — a moon built like a hot-air-balloon frame, or a lantern waiting for
a candle. Light-weight fine hand-sketch overdraw keeps the mesh from looking
machined. It survived the cull against a cream-paper phase strip (too
diagrammatic), a ringed-planet eclipse (too tidy), and a labelled
"Mare Incognitum" plate (the generated place names are charming but shrink
the disk). The big, near-full-bleed disk on black is the one that held up
at a glance.

## Materials

- Paper: black card, 300 gsm, A3 (297 × 420 mm), smooth (e.g. Colorplan Ebony or Canson Mi-Teintes black).
- Pen: Sakura Gelly Roll Moonlight white/cream 0.3–0.5 mm, or Uni-ball Signo
  UM-153 white (~#E8E4D8 ink equivalent). Test on offcut first; opaque gel
  white works best on black.
- Optional: one pass of a pale-gold metallic gel pen (#C9B27C) over the
  terminator hatch only, by hand, for a warm limb.
- Mounting: float mount in a black box frame, no glass glare — or unframed pinned.

## Process

1. Tape the black card to the plotter bed; fit the white gel pen (nib 0.3 mm).
2. Plot `artwork.svg` in one pass, slow speed (about 40%) so the gel flows
   evenly; wipe the nib at the one pause mid-job if lines break.
3. Let dry 24 h. Do not stack or rub.
4. Optional: hand-warm the terminator with the gold pen along the densest hatch.
5. Mount.

## Plot settings

A3 portrait, 20 mm margin, pen width 0.3 mm, single pen layer, optimised
pen travel (default).

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js planet --paper a3 --orientation portrait \
  --margin-mm 20 --pen-width-mm 0.3 --type moon --craters --crater-count 140 \
  --crater-detail --rilles 4 --light-elevation 12 --light-angle -60 \
  --ambient 0.05 --stipple 0.5 --terminator-emphasis 0.6 \
  --hand-sketch 0.3 --hand-sketch-style fine --seed 21 --radius-frac 0.9 \
  -o artwork.svg
node scripts/svg-to-png.mjs artwork.svg preview.png --width 1400 \
  --background '#121212' --stroke '#e8e4d8'
```

## Wishes

- Feature labels that don't shrink the disk (keep radius, put names in margin).
- A `--paper-tone` aware hatch density so light-on-dark can invert tone mapping.
