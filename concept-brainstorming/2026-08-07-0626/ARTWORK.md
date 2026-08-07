# The Narrow Water

## Artist statement

The photo this plate comes from (`test-images/sky-clouds.jpg`) is almost
nothing: a wall of storm cloud, a black ridge of hills, and — right at
the bottom, easy to miss — a sliver of loch catching what light survives
the weather. It is the kind of frame most people scroll past. I kept
coming back to it across the session because the repo's `image` pipeline
had never been used in this brainstorming series at all — every prior
run reached for a procedural generator — and this photo is the one that
makes the case for it: the massing/value-bands/solid-blacks machinery
built for *composed* tonal drama turns out to want exactly this kind of
sky.

Two things earned this plate its place over everything else I rendered.
First, the middle distance: the flowing hatch band that reads as a lower
cloud layer above the ridge isn't cross-hatch or stipple, it's the
direction field finding real structure in a part of the photo that has
no label and no depth data — a strip of streamline hatching so
convincingly cloud-shaped I had to check twice that I hadn't hand-tuned
it. Second, `--solid-blacks` — which does nothing on its own; it needs
`--massing` to hand the field a mass plan before it will treat a dark
region as a committed shape rather than a value to hatch — turns the
hillside into a genuine solid mass, the way a mezzotint plate starts
black and the artist works backward into it, burnishing light out of
darkness rather than drawing dark lines into light. That's the opposite
direction from how every hatching-based plate in this repo normally
builds tone, and it's the right direction for a piece whose entire
subject is a huge dark shape with one small bright interruption.

I rendered the full frame first (a square crop, seed 1) and it was
inert — too much incident, not enough weather. Cropping hard to an A3
portrait strip (keeping the full height, losing the flat sky at the
sides) is what turned "a moody photo" into a composition: the ridge now
cuts the sheet on a real diagonal, the sky gets the two-thirds a storm
sky is owed, and the water sliver — maybe 4% of the frame — becomes the
one thing in the piece that isn't shouting. I tried four seeds at that
crop; they're interchangeable at this scale (dot jitter, hatch
squiggle), so I kept the first, seed 7. What isn't interchangeable is
the massing weight: too low and the hillside reads as textured rock
instead of a silhouette; too high and it swallows the pale rim of
terrain along the ridge that the original photo actually has (a thin
strip of unshadowed ground on the lower-left slope). `0.4` keeps both —
the hill is decisively black and the rim survives as a hatched sliver of
grey, which now reads as the only part of the land still catching light.

## Materials

- **Paper** — A3 portrait (297×420mm), a pale storm-grey cotton rag, cold
  press, ~300gsm (e.g. Hahnemühle "Britannia" or Fabriano Artistico in a
  warm grey-white — anything with enough tooth to hold a wash evenly).
  The toned ground does real work here: it reads as "overcast" before a
  single line is drawn, so the plotted stipple has to fight less hard to
  read as *grey sky* rather than *white paper with dots on it*.
- **Ink / pen** — a pigment-based technical fineliner, 0.32mm nib —
  **Sailor Kiwa-Guro nano-Black** (or any lightfast pigment ink of
  equivalent hue; the important property is opacity, not exact hex: a
  dye-based black will streak where the solid-fill passes overlap, a
  pigment ink won't). Plotted colour hex for reference: `#15130f`
  (a true near-black, not a warm sepia — this piece wants the coldest
  black the pen has).
- **Wash** — a granulating watercolour in Payne's Grey or Indigo (e.g.
  Winsor & Newton Payne's Grey), diluted to a thin glaze, brushed over
  the sky region only after the ink is fully dry. Reference hex for the
  glaze at full strength: `#3c4a63`.
- **Masking** — low-tack artist's masking tape (or a strip of frisket
  film) laid along the ridge line to protect the solid-black hillside
  from the wash. The line doesn't need to be exact — a hand-brushed edge
  a few mm proud of the true silhouette reads as *weather*, not *error*;
  the preview's wash boundary is deliberately soft for the same reason.

## Process

1. Plot `artwork.svg` on the dry sheet with the 0.32mm pigment fineliner.
   Expect roughly 21,000 strokes — the solid-fill hillside is the bulk of
   the pen-down time; give the plotter room to run this in one sitting
   rather than swapping paper mid-plot, since the piece has no register
   marks and depends on the sheet not shifting.
2. Let the ink cure fully — at least 30 minutes for a pigment fineliner,
   longer in humid conditions — before anything wet touches the sheet.
   Pigment ink is chosen specifically so this step is safe; a dye-based
   ink would lift or feather under the wash in step 4.
3. Lay masking tape along the ridge line (the diagonal boundary where the
   solid black hillside begins), erring a few millimetres into the sky
   side rather than hugging the silhouette exactly — a slightly generous
   mask reads as a natural wash edge, a mask that hugs the ink line too
   precisely reads as a stencil.
4. Wet the exposed sky region evenly with clean water first (a light
   even damp, not pooling), then drop in the diluted Payne's Grey/Indigo
   wash from the top of the sheet, letting it graduate lighter toward
   the ridge — heaviest at the top margin, nearly clear by the time it
   reaches the tape line. One pass is enough; a second glaze once the
   first is bone dry can deepen it further if the first pass dried too
   pale.
5. Remove the tape once the wash is completely dry (test the edge with a
   fingertip before lifting — masking tape pulled off damp paper tears
   the surface). The solid-black hillside and the water sliver stay pure
   ink-on-paper; only the sky carries colour.
6. Float-mount on a single backing board, no window mat bleed — the
   image should run close to the sheet's own edge so the storm reads as
   continuing past the frame rather than contained by it.

## Plot settings

| | |
|---|---|
| Paper | A3, portrait, 297×420mm |
| Fit | `fill` — the source photo (square, 1536×1536) is cropped to the full printable height and centred, losing the flat sky at both sides |
| Margin | 15mm |
| Pen width | 0.32mm |
| Render resolution | 4 px/mm (1188×1680 working canvas) |
| Seed | 7 |
| Strokes | 20,997 (`optimizePlot`-reordered and chained; on by default) |

## Reproduction

Both the SVG and the preview come from files already committed to the
repo (`test-images/sky-clouds.jpg` + its `.labels.png` sidecar) — no
external input images were created for this piece.

```sh
pnpm install && pnpm build

node packages/cli/dist/cli.js image \
  -i test-images/sky-clouds.jpg \
  --label-image test-images/sky-clouds.labels.png \
  --paper a3 --orientation portrait --fit fill --margin-mm 15 --resolution 4 \
  --seed 7 \
  --value-bands 4 --massing 0.4 --solid-blacks \
  --sky-stipple --calm-water \
  --white-cutoff 0.06 --pen-width-mm 0.32 \
  -o artwork.svg
```

`preview.png` recolours the plotted line work onto the storm-grey paper
tone and near-black ink described above, then composites a soft
Payne's-Grey/Indigo gradient (multiplied, Gaussian-feathered at the
edge) over the sky region to approximate the hand-brushed wash — the
gradient boundary is a straight diagonal read directly off the render
(sky occupies the frame from the top down to roughly `y=970` at the left
edge and `y=300` at the right edge, in the SVG's own `0 0 1188 1680`
viewBox), then blurred by 24px so it reads as a brushed edge rather than
a mask cut. This compositing step is a preview convenience only — it is
not part of the plotted SVG and has no bearing on reproducing
`artwork.svg` itself, which is single-pen black line work exactly as the
command above produces it.

## Wishes

- `--mask`'s suppression is a fade (`importance`), not a hard cutoff —
  I initially tried rendering the sky and the hillside as two separate
  masked passes (for a genuine two-ink plot instead of a hand wash) and
  found faint stray strokes bleeding across the mask boundary in both
  directions at `--mask-strength 1`. That's correct behaviour for the
  documented use case (fading a background, not gone), but a true
  "clip, don't fade" mode would have let this piece exist as two clean
  registered pen layers instead of one pass plus a hand-brushed wash.
- `--solid-blacks` silently no-ops without `--massing` (it needs
  `field.hasMassTone()`, which only `--massing` sets). The CLI accepts
  `--solid-blacks` on its own without a warning and just renders regular
  cross-hatch instead — cost me a render before I found the gate in
  `packages/core/src/pen-ink/index.ts`. A `--solid-blacks` with no
  `--massing` should probably warn, since the two flags are
  independently documented but not independently usable.
