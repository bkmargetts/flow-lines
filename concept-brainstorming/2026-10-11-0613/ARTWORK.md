# Rain Moon, Still Water

## Artist statement

A moon held as bare paper inside a curtain of falling blue lines, over a
lake that has stopped to listen. It survived the cull because it is almost
nothing: the sky is a single direction of stroke, the water a single other,
and the whole picture is carried by what is *left out* — a disc of paper, a
cloud drawn across it, a gap in the rain. It reads as a Japanese woodblock
crossed with a linocut: four tones of one blue, no black, a lot of paper.
Alternatives considered and discarded: photo renders (stiff, mid-tone
mush), wireframe planets (too diagrammatic), the same landscape with heavy
cloud cover (the clouds crowded the moon, which is the whole point).

## Materials

- **Paper:** warm cream cotton rag, ~300 gsm, cold-press, A3 (297×420 mm), portrait. Approx. hex `#f3ecd9`.
- **Pens (four tones of one blue, 0.45 mm fineliners or gel pens, waterproof/pigment):**
  1. Pale cyan-grey blue `#3a6fa0` — 845 strokes (sky rain, far lines)
  2. Mid cobalt `#1f4d78` — 653 strokes
  3. Deep prussian `#13385e` — 382 strokes
  4. Near-black indigo `#0e2a47` — 241 strokes (foreground headland, outlines, moon rim)
- Optional: a dilute pale-blue watercolour wash (Prussian blue, ~5%) applied to the sky only, after the ink is fully dry.

## Process

1. Tape the cream sheet to the plotter bed, portrait, with a registration mark at one corner.
2. Split `artwork.svg` by stroke colour (e.g. in Inkscape: select-same-stroke-colour → export each as its own SVG, or use vpype `lmove`/`pens`-style layering). Four layers, plotted lightest to darkest.
3. Plot layer `#3a6fa0` with the 0.45 mm pen, then `#1f4d78`, then `#13385e`, then `#0e2a47`. Swap pens without moving the paper; if it must move, realign to the corner mark.
4. Let ink cure at least 30 minutes.
5. Optional: wet the sky with clean water, drop the dilute Prussian wash in quickly, and tilt for a soft gradient lightest at the horizon; keep the moon disc dry by masking with a cut circle of low-tack tape (the moon is r=55 px at 3 px/mm ≈ 37 mm Ø — mask 40 mm Ø, centred on the moon rim).
6. Press flat; mount float-style on white mat board.

## Plot settings

A3 portrait, 12 mm margin, 0.45 mm pen, 2121 strokes, `--resolution 3` (default), SVG viewBox 891×1260 (3 px/mm). The landscape generator chains/optimises pen travel by default.

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js landscape --scene alpine-lake \
  --paper a3 --orientation portrait --palette cyanotype \
  --moon-rim --sun-radius 55 --clouds 0.25 --birds 3 \
  --atmosphere 0.6 --focus 0.5 --foreground 0.5 --horizon-frac 0.6 \
  --seed 35 -o artwork.svg
node scripts/svg-to-png.mjs artwork.svg preview.png --width 1600 --background '#f3ecd9'
```

Verified byte-identical on re-run.

## Wishes

- `--split-layers` for the landscape command (currently the four inks are only separable by stroke colour).
- Clouds that avoid, or deliberately pass in front of, the moon as a chosen option.
