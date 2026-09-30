# The Cat, Leaving

## Artist statement

One photograph of a cat walking away through snow, drawn twice by the
same machine in two opposed drawing languages, and plotted on the same
sheet in perfect register.

Underneath, in a cool slate blue, is the *natural-history plate*: a
Doré-style engraving that describes the animal — outline, cross-hatched
flank, tail, the flurry of snow ticks. Over it, in warm black, is the
*sumi-e gesture*: the same body reduced to a single bundle of confident
brush-like strokes that follows the arch of the spine and falls down the
haunch, and abandons the head entirely. The engraving says *what the cat
is*; the brush says *how it moves*. Where the two overlap the gesture
lifts off the description and the animal seems to be stepping out of its
own portrait.

It survived the cull because it was the only candidate that got stronger
when simplified. The Doré and ballpoint styles alone were merely charming
(the ballpoint scribble-loops read as a knitted toy); the sumie style
alone was elegant but anonymous. Layered, they make an image about
drawing itself. This is the repo's first use of the photo → ink path as a
two-pen register piece.

## Materials

- **Paper:** A3 (297 × 420 mm), warm off-white/cream, smooth cold-press
  drawing or watercolour paper, 200–300 gsm — e.g. Hahnemühle Bamboo or
  a cream Canson Montval. Preview approximates it as `#efe6d2`.
- **Layer 1 pen — slate blue:** 0.3–0.4 mm gel/fineliner, "Slate Blue-Grey",
  approx `#6f8aa0` (e.g. a Pilot Juice 0.38 in grey-blue, or any
  grey-blue fineliner).
- **Layer 2 pen — sumi black:** 0.5 mm waterproof brush-tone black,
  "Sumi Black" `#15110d` (e.g. a Sakura Pigma Micron 05 in black,
  waterproof).
- **Hand finish:** one small red seal (hanko/carved eraser stamp) in
  vermilion ink, e.g. Shachihata vermilion, `#c0392b`, placed by hand at
  lower right, ~12 mm square.
- Low-tack masking tape; light table or a pencil-marked corner
  registration for re-loading the sheet.
- Float mount in a plain pale-oak frame, museum glass.

## Process

1. Tape the sheet flat to the plotter bed, landscape, corner against a
   fixed stop. Mark the sheet corners lightly in pencil at the bed edges
   so it can be re-seated.
2. Load the slate-blue pen. Plot `artwork-layer-1.svg` (engraving) at
   A3 landscape. Do not move the paper.
3. Let the ink dry fully (10 min for gels; 30 min if the pen is
   pigment/pigmented ink) so the black pass cannot drag it.
4. Swap in the sumi-black pen **without moving the sheet**. If the sheet
   must be removed, re-seat it against the pencil corner marks and the
   original stop. Plot `artwork-layer-2.svg` (gesture). Register between
   the layers should be within ~0.3 mm; a hair of misregistration reads
   as intentional.
5. By hand, stamp the vermilion seal at lower right, about 15 mm from the
   edge, slightly off-square. Let dry 24 h.
6. Float-mount with archival hinges; sign and number in pencil.

## Plot settings

- Paper A3, landscape, plotter native margin default of the CLI.
- Both SVGs share the same 420 × 297 mm frame (viewBox 1260 × 891), so
  no offset is needed between passes.
- Layer 1: 1403 paths, 0.3 mm pen (the SVG is authored at a nominal
  0.9 user-unit stroke ≈ 0.3 mm). Layer 2: 83 paths, 0.5 mm pen is fine.
- Pen travel is optimised (`optimizePlot` on by default); the black pass
  is short, roughly 10 minutes; the blue pass is longer.

## Reproduction

```sh
pnpm install && pnpm build
D=concept-brainstorming/2026-09-30-0609
node packages/cli/dist/cli.js image -i test-images/cat-snow.jpg \
  --style dore  --paper a3 --orientation landscape --seed 3 -o $D/artwork-layer-1.svg
node packages/cli/dist/cli.js image -i test-images/cat-snow.jpg \
  --style sumie --paper a3 --orientation landscape --seed 3 -o $D/artwork-layer-2.svg
# preview: layers recoloured (#6f8aa0 then #15110d) on #efe6d2 and rasterised
node scripts/svg-to-png.mjs preview.svg $D/preview.png --width 1600
```

Preview compositing: concatenate the `<path>` elements of layer 1 with
stroke `#6f8aa0`, then layer 2 with stroke `#15110d`, in a 1260×891
viewBox 420×297 mm SVG on a `#efe6d2` rect.

## Wishes

- The sumie style discards the head and forelegs (it keeps only the
  long, tonal structure). A per-region "gesture completeness" control
  would let the brush layer keep the ear line.
- `--style` should not silently override `--layers` / `--pen-width-mm`;
  they had no effect when passed with `dore`.
- An `image --split-layers` option, or a `stack` recipe entry for the
  `image` generator, would replace the manual two-render composite.
