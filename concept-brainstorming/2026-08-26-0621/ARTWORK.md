# Slack Water

## Artist statement

Flow Lines exists, per its own README, to turn photos into plotter-ready
pen-and-ink drawings. That is the flagship feature — the reason the
`image` command has more CLI flags than any other generator, and the
reason CLAUDE.md spends more words on the tone/hatching/massing pipeline
than on anything procedural. And yet the studio log shows thirty-six
prior sessions, every one of them reaching for a noise field, a
simulation, or a fractal — meander belts, lapidary strata, Conway
exposures, terraced rammed earth — and not one of them pointing the tool
at an actual photograph. This session started by just closing that gap:
run `image` on something from `test-images/`, for what may be the first
time this studio has ever done so, and see what the repo's most
heavily-engineered pipeline actually does with a real scene.

The photo (`boats.jpg`, from Google's public sample-data bucket, a small
harbour with a hazy downtown skyline behind two moored boats) turned out
to be the right test case by accident. Run through `--value-bands 5
--massing 0.4 --calm-water --sky-stipple`, the engine made a decision I
didn't ask for and wouldn't have thought to ask for: the skyline —
objectively the largest, most detailed, most "important" thing in the
frame, an entire downtown of towers and cranes — gets almost no ink. It
survives as a single wavering contour line, thin and uncommitted, with
a dark base band where reflection meets shoreline and nothing above it
but paper. Every drop of black in the piece goes to two ordinary
boats sitting in the water, rendered as fully committed, cross-hatched,
near-solid silhouettes with a reserved-white gunwale catching the light.
A city gets a whisper; two nobody's-boats get the weight of the whole
plate. That's the massing/counterchange machinery working as documented
— tone is redistributed by compositional role, not photographic
luminance — but seeing it choose the foreground over an entire skyline,
unprompted, on a real photograph, is a more convincing demonstration of
"the artist's tonal abstraction" than any of my parameter tweaking
produced on the generative pieces.

The water is doing the second half of the work. `calm-water` reads the
label sidecar and lays long, shallow, broken strokes across the whole
lower two-thirds — not the mechanical diagonal cross-hatch you'd get
from an unlabelled render (I checked; it's worse), but something closer
to the way a harbour actually catches low light: a soft chop that
carries tone without describing every ripple. The name of that
generator option is also, unglamorously, the name of a real tidal
state — the calm period at the turn of the tide, neither flooding nor
ebbing — which gave the piece its title once I noticed it.

What survived the cull: seed 7 at `--resolution 2`. Higher analysis
resolutions (3–4 px/mm, the CLI defaults) resolved the skyline's actual
antenna masts and construction cranes into a frizz of short contour
fragments — accurate to the photo, but it read as scribble, not
restraint, and fought the exact point the massing system was making.
Backing off to a plainer, lower-fidelity pass let the skyline stay a
single confident line instead of a nervous one. Sometimes the fix for
"too busy" is coarser looking, not cleverer settings.

## Materials

- **Paper:** Fabriano Artistico Traditional White, 300gsm, Hot Press,
  A3 (297×420mm) — a hot-press surface for a crisp fine-line plot, heavy
  enough to take a wash afterward without cockling.
- **Ink:** De Atramentis Document Ink, black (`#141110` as drawn) —
  pigment-based and waterproof once cured, loaded into a 0.35mm
  technical pen (Rotring Rapidograph or equivalent) on the plotter.
- **Wash:** Winsor & Newton Payne's Grey watercolour, heavily diluted
  (~1 part paint to 20 parts water), applied by hand with a large flat
  wash brush after plotting.
- **Masking:** low-tack painter's tape (or liquid frisket) to hold the
  wash below the horizon line.

## Process

1. Plot `artwork.svg` on the A3 Fabriano sheet with the 0.35mm technical
   pen loaded with De Atramentis Document Ink black, at the CLI's
   default `--pen-width-mm 0.35` line weight. Single pass, single pen —
   the file is already plot-ready as drawn.
2. Let the ink cure fully (minimum 24 hours) so it is genuinely
   waterproof before any wash touches it — Document Ink is
   waterproof once dry, but the pigment needs the full cure time to set.
3. Mask above the horizon line (the long near-straight contour running
   roughly a third of the way down the sheet, where the skyline's base
   band sits) with painter's tape, so the skyline and the paper around
   it stay untouched by the wash and keep their crisp, uncommitted
   quality — the whole point of the piece.
4. Mix the Payne's Grey wash (~1:20 with water) in a small dish. Test on
   an ink-and-paper offcut first to confirm the cured ink doesn't lift.
5. Working wet-on-dry with a large flat brush, lay the wash freely
   across the water two-thirds of the sheet, below the mask line.
   Let it pool and vary in density rather than aiming for an even
   tint — the point is harbour haze, not a flat colour field. Leave
   the two boat silhouettes and the reserved-white gunwale line alone;
   the wash goes over them exactly as it goes over the water, since in
   the photograph the boats sit low and half in reflection.
6. Let the wash dry completely flat (a couple of hours; weight the
   corners if the sheet wants to cockle). Remove the masking tape.
7. Trim to the plotted margin if desired; float-mount for framing so
   the deckle/trim edge stays visible.

## Plot settings

- Paper: A3, landscape orientation, 20mm margin.
- Pen width: 0.35mm.
- Analysis resolution: 2 px/mm (`--resolution 2`) — deliberately below
  the CLI default of 3, to keep the skyline's antenna/crane detail from
  fragmenting into scribble (see statement above).
- Seed: 7.
- Output: 3190 strokes, single pen layer.
- Estimated pen-up travel: not tiled, no `--tile` needed — single A3
  sheet, `optimizePlot` on by default (the CLI default; not disabled
  here).

## Reproduction

```sh
pnpm install && pnpm build

node packages/cli/dist/cli.js image \
  -i test-images/boats.jpg \
  --label-image test-images/boats.labels.png \
  --paper a3 --orientation landscape --margin-mm 20 \
  --pen-width-mm 0.35 --resolution 2 \
  --value-bands 5 --massing 0.4 --calm-water --sky-stipple \
  -s 7 \
  -o artwork.svg
```

`preview.png` was rasterized with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 2000 --background '#fbf6ea' --stroke '#141110'
```

(the preview approximates the plotted, pre-wash state — ink on paper —
since the hand-applied Payne's Grey wash in step 5 isn't something the
rasterizer can simulate; the wash is a genuine hand step, not encoded
in the SVG).

## Wishes

- A `--water-detail-cap` (or similar) flag would let calm-water's
  eligibility test tolerate photographed ripple/chop without falling
  back to plain diagonal streamline hatch, instead of only reaching for
  a resolution workaround as this session did.
- Some way to bias contour tracing's `minLengthScale` by distance-from-
  camera (depth, when available) rather than only local detail — so a
  busy, distant skyline can be told to commit to fewer, longer lines
  while a near subject keeps full fidelity, instead of tuning global
  `--resolution` down and losing fidelity everywhere.
