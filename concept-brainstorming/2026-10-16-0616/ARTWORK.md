# Vigil of the Domes — St Basil's in Negative

## Artist statement

A daytime photograph of St Basil's Cathedral, drawn as if the pen had
been working in the dark. The `image` generator's sky stipple, built to
carry *grey overcast* as a spray of black dots on white, becomes on
midnight paper a snowfall — or a starfield — with the one cloud-shaped
hole left as deep indigo, a moon-sized absence. The domes, which the
Doré style hatches and cross-hatches by tone, flip from shadow to light:
the pattern of scratches reads as frost on the onion domes, lamp-glow in
the facets of the towers. I did not invert the tone; the same line set
is simply put on a dark ground, so the ink *is* the light. Earlier
candidates (solid-black value masses, a boats-on-water sheet, a street
scene) were dropped: solid blacks became blobby on this subject and the
others lacked a single strong silhouette. What survived is restrained
where it counts — the cloud clearing and the hatch-free sky between
domes — and dense only on the building and the foreground wall.

## Materials

- **Paper:** A3 (297 × 420 mm) deep midnight-blue cover stock, 200–300 gsm,
  smooth (e.g. any ~#14213d dark indigo).
- **Pen:** one white/ivory opaque gel or paint pen, 0.3–0.4 mm tip
  (Sakura Gelly Roll Classic white or Uni-ball Signo UM-153 white),
  ink tone approx. warm ivory `#f1ead8` (pure white is also fine).
- Low-tack masking tape, soft eraser for smudges after drying.
- Optional: mat board with a thin float mount.

## Process

1. Tape the paper flat on the plotter bed; fit the white pen, 0.3 mm.
2. Test one corner stroke; opaque gel pens skip on dark stock, so slow the
   plotter pen speed (~20–30 mm/s) and use light pen pressure.
3. Plot `artwork.svg` (single layer). Expect the sky stipple to take the
   longest; stop and re-prime the pen if dots begin to fade.
4. Let dry 30 min; lift tape; gently erase pen-up smudges.
5. Mount with 20 mm border clear (the SVG already holds a 20 mm margin).

## Plot settings

A3 portrait, 20 mm margin, pen width 0.3 mm, single pen, stroke path
chaining/ordering on (default optimisation).

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js image \
  -i test-images/landmark-stbasils.jpg \
  --label-image test-images/landmark-stbasils.labels.png \
  --paper a3 --orientation portrait --margin-mm 20 --pen-width-mm 0.3 \
  --seed 11 --style dore --facet-hatch --contour-halo 1 \
  --value-bands 4 --massing 0.7 --white-cutoff 0.25 --max-stroke 60 \
  -o artwork.svg
node scripts/svg-to-png.mjs artwork.svg preview.png --width 1400 \
  --background '#14213d' --stroke '#f1ead8'
```

## Wishes

- A tone-invert flag on `image` so white-ink-on-dark work can map
  highlights to dense ink rather than relying on the viewer's reversal.
- Hatch that avoids the lower-left wall texture swarm (labels for
  "ground/wall" mark-making).
