# Slack Water

## Artist statement

Thirty-five studio sessions have passed through this repository before
this one, and not one of them ever pointed the `image` command at an
actual photograph. Every prior piece was built from a procedural
generator — cracks, cellular automata, fault lines, gears — because
that's where a seed and a slider can be pushed to an interesting
extreme. But the thing this whole toolbox is *for*, the sentence at the
top of its own README, is turning a photograph into a drawing a person
could have made. That capability has sat untouched: streamline hatching
that reads 3D form, a value plan that commits to big tonal shapes, a
massing engine that swells background tone around a subject, calm-water
and sky treatments keyed off real semantic labels, silhouette halos that
hold reserved paper the way an ink artist does. All of it built,
described at length in this repo's own documentation, and never once
asked to do its actual job. This session photographs a harbor instead of
detonating a cellular automaton.

The source is an ordinary snapshot from Google's public sample-data
bank: two small boats at rest on the Charles River, a hazy skyline and
the arches of a bridge behind them, the kind of photo nobody would
call a composition. That's exactly why it earns the treatment — the
pipeline's job is to *find* the picture the camera didn't know it was
taking. `--calm-water` reads the labeled water region and lays broken,
wind-thinned strokes across it instead of hatching it like a wall; the
strokes still carry the water's real surface motion (they were built
from the same orientation field as everywhere else), so the calm
reads as *water holding still*, not as a flat pattern. `--massing`
swells the tone in the ring immediately around the near boat so it
sits in a pool of its own shadow-water without the boat itself getting
crushed into a black silhouette — the far boat, alone in open water
with no swell to help it, stays a light, uncertain gesture, which is
correct: it's smaller, farther, and half-forgotten by the frame. The
distant skyline is deliberately not legible as any specific building —
`--field-smoothing` and a lifted `--white-cutoff` reduce it to the thing
a harbor sketch actually needs from a skyline: a horizon with a
pulse, not an elevation drawing.

The title is the nautical term for the short window at slack tide
when the water is neither flooding nor ebbing — no current, no
push, everything simply floating where the last motion left it. It's
the calmest a tidal body of water ever gets, and it's temporary; the
tide turns again within the hour. That's what stopped me on this
render out of a dozen seeds and a much longer list of failed value-plan
settings (several early passes read the boat's dark hull as one more
shadow to crush solid, which just made a blob — the fix was not
"more contrast," it was less massing and enough white-cutoff to let
the far water actually go quiet): a boat sitting in water that has,
for one photographic instant, stopped moving. Everything in the mark-
making agrees with that stillness — even the near boat's texture
strokes are ticks and thin cross-hatch, not the aggressive engraving
weight this repo's Doré preset would have thrown at the same hull.

## Materials

- **Paper** — one A3 sheet (420 × 297 mm), landscape, Stonehenge Fawn
  250 gsm: a warm cotton-rag cream with enough tooth to hold a fine
  technical pen cleanly without feathering, and a paper-and-ink pairing
  that reads like an old chart rather than a print. Any smooth,
  cream-toned printmaking stock in the same weight range substitutes
  fine (Hahnemühle Bugra "Sand", Fabriano Ingres "Avana").
- **Ink** — a single pen throughout: Diamine "Prussian Blue" bottled
  drawing ink, `#123a5c`, loaded in a refillable 0.3 mm technical pen
  (Rotring Isograph or equivalent). A fixed-width fineliner close to
  that hex (e.g. a Faber-Castell PITT artist pen in "Indigo") works if a
  refillable technical pen isn't available — the point of the colour is
  a cool, slightly desaturated navy that reads as ink-on-water rather
  than office-supply black.
- **Mounting** — narrow dark-walnut or black frame, no mat, glass
  (anti-reflective if available). The cream paper is warm enough to
  hold its own next to a wood frame without a mat buffering it.

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the
   reproduction command below to regenerate `artwork.svg` — one A3
   landscape sheet, single pen layer, already stroke-chained and
   travel-ordered by `optimizePlot` (on by default for the `image`
   command).
2. Tape the Stonehenge Fawn sheet to the plotter bed, landscape
   orientation, 15 mm margin already baked into the SVG (`--margin-mm
   15` — no manual centring needed).
3. Load the 0.3 mm technical pen with Diamine Prussian Blue. Plot
   `artwork.svg` in one pass — it's a single pen, single layer; there is
   no registration or pen-swap step in this piece.
4. Let the ink cure flat for a few minutes (bottled drawing ink in a
   technical pen dries faster than gel, but the sheet has enough solid
   fill in the near boat's hull to want a moment before handling).
5. Frame under glass, no mat, in a slim dark frame.

## Plot settings

- Paper: A3 (420 × 297 mm), landscape orientation, 15 mm margin.
- Pen: one pass, 0.3 mm width, Diamine Prussian Blue.
- Resolution: 3 px/mm (CLI default) → 1260 × 891 px working canvas.
- Strokes: 2,972 plotted paths, single layer, nearest-neighbour
  ordered and chained by `optimizePlot`.

## Reproduction

Built directly with the CLI's `image` command against the repo's own
test photo bank (`test-images/boats.jpg`, sourced from Google's public
`cloud-samples-data` bucket) and its committed semantic-label sidecar
(`test-images/boats.labels.png`, generated by
`scripts/segment-labels.mjs`). Byte-for-byte reproducible from this one
command and seed:

```sh
pnpm install && pnpm build

node packages/cli/dist/cli.js image \
  -i test-images/boats.jpg \
  --label-image test-images/boats.labels.png \
  --seed 3 \
  --paper a3 --orientation landscape --margin-mm 15 --pen-width-mm 0.3 \
  --value-bands 3 --massing 0.2 \
  --calm-water --sky-stipple \
  --line-swell 0.5 --detail 0.5 --layers 2 --field-smoothing 6 \
  --white-cutoff 0.1 --hatch-patchiness 0.25 \
  --focus 599,683 --focus-radius 283 \
  -o artwork.svg
```

`--focus 599,683 --focus-radius 283` centres the importance falloff on
the near boat in this render's own 1260×891 output space (roughly the
hull's centroid, with the radius wide enough that both boats and the
water immediately around them stay fully inked while the far corners of
the sheet fade toward paper).

`preview.png` rasterizes the same SVG with the physical ink and paper
colours substituted for the CLI's default black-on-white:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 2000 --background '#f4ecdd' --stroke '#123a5c'
```

## Wishes

- Composing this from a real photograph made the gap between "detail
  auto-computed from the image" and "detail I want to point at a
  specific subject" much more visible than any procedural generator
  session has: `--focus` takes output-space pixel coordinates, so
  finding the right point meant rendering once, eyeballing where the
  subject actually landed in the output canvas, then hand-computing the
  scaled coordinate for the next resolution or paper size. A
  `--focus-normalized <x,y>` in 0–1 fractional coordinates (independent
  of `--paper`/`--width`/`--height`) would make focal-point tuning
  transferable across the exact iteration loop this session did —
  cheap low-res pass to find the subject, full-resolution final at the
  same relative point.
- `--mask` (an ML subject-segmenter mask) would have located "the near
  boat" far more precisely than a hand-picked focus point and radius —
  this photo bank doesn't ship one, and generating it locally needs a
  segmenter this sandbox can't reach (see the repo's sandbox network
  notes). Worth having `scripts/segment-labels.mjs`'s sibling for masks
  generated by the same CI job that already produces the `.labels.png`
  sidecars, so future sessions get a real subject mask for free instead
  of triangulating one from a focus point.
