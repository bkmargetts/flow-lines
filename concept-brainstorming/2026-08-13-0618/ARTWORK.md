# Downthrow

## Artist statement

Before there were geological maps for the public, there were colliery
section drawings for the courts. A 19th-century mining engineer sinking
a shaft, or defending a boundary dispute over who owned which seam,
needed a cross-section: turf, sandstone, shale, the coal itself, the
limestone and mudstone underneath, each band hand-hatched in its own
texture so a reader could tell rock types apart at a glance without
colour. Faults — places where the whole sequence has sheared and one
block has dropped relative to its neighbour — get drawn as clean
vertical steps in the banding, the seam you were following suddenly
resuming a foot or two lower on the other side. The mining term for
that vertical displacement is a *downthrow*. It is also, not
coincidentally, a good description of what it feels like to hit one
underground.

This repo's `lapidary` generator was built for agate slices and rock
slabs — its `strata` mode exists to fake sedimentary banding for
mineral-specimen illustrations, and its `--faults` flag was almost
certainly written with a polished stone's fault-offset bands in mind,
not an actual mine survey. But feed it real lithology textures in the
right order — `grain` for turf, `stipple` for sandstone, `wavy` for
shale, dense `solid` hatch for the coal, diagonal `crystal` for
limestone, `cross`-hatch for the mudstone floor — and two fault throws,
and the tool stops making decorative rock patterns and starts drawing
a correct, legible mine section: a coal seam that steps down twice
across the sheet and thins out where the left-hand block has been
squeezed. I rendered a dozen seeds and fault counts before this one —
most just looked like blocks of hatching stacked on top of each other.
This seed puts the second, larger step in the seam almost exactly
where the eye wants a full stop, and the thinning coal band on the far
left reads as a real stratigraphic pinch, not a rendering quirk. It's
the only candidate from the session that I'd trust a mining historian
to glance at and not immediately clock as generated.

What I'm drawn to here is the same thing that makes the real archival
drawings worth looking at: total representational confidence married
to a task that has nothing to do with beauty. Nobody drawing a section
for a royalty dispute was trying to make art, which is exactly why the
hatching is so unfussy and so good — plain marks, doing plain work,
built to be trusted.

## Materials

- **Paper** — A3 (420 × 297 mm) hot-press watercolour paper, e.g.
  Fabriano Artistico Extra White 300 gsm, portrait sheet used
  landscape. Before plotting, the whole sheet gets a single even wash
  of dilute walnut ink (walnut ink crystals, roughly 1 part ink
  concentrate to 20 parts water — test on an offcut first) applied
  with a large flat wash brush, then dried flat and pressed under
  boards overnight to kill any cockling. Target tone: a warm foxed
  cream-tan, close to `#e9dcc2` — old-document colour, not a strong
  colour cast.
- **Ink** — one pen only: a lightfast sepia/bistre pigment ink, colour
  reference `#4b3319` ("Van Dyke sepia"). A technical pen (Rotring
  Rapidograph or similar) loaded with a bottled sepia pigment ink is
  the plotter-accurate choice; a Sakura Pigma Micron 03 in Sepia is
  the closest off-the-shelf hand equivalent if you ever want to check
  a detail by hand. Line width 0.35 mm.
- **Optional finishing (hand, after the ink has cured)** — a graphite
  scale bar and caption below the plate margin, penciled freehand: a
  50 mm bar divided into five 10 mm ticks labelled "0" and "10 m", and
  a caption reading "SECTION — TWO FAULTS" in small caps. This is
  entirely optional, not part of the generated file, and left to the
  owner's hand — the plate reads complete without it.

## Process

1. Cut the A3 sheet. Tape it out flat on a board.
2. Mix the walnut ink wash (1:20 with water) and lay one continuous,
   even coat over the whole sheet with a large flat brush, working wet
   edge to wet edge to avoid backruns. Let dry flat, then press under
   boards for a few hours or overnight so the sheet stays true for the
   plotter bed.
3. Load the plotter with the sepia pigment pen at 0.35 mm. Home the
   pen and register the sheet.
4. Plot `artwork.svg` — a single pass, single pen. The generator
   already builds the bold coal band from repeated internal offset
   strokes, so nothing further is needed pen-side.
5. Let the ink cure per the ink's own guidance (typically 24 hours)
   before handling.
6. Optional: in pencil, add the scale bar and caption described above,
   a few centimetres below the plate's lower margin.
7. Float-mount on a warm-white mount board, glass with UV-filtering
   acrylic if displaying near a window (walnut-ink washes are not
   especially lightfast; the sepia line ink is, but protect the wash).

## Plot settings

- Paper: A3, landscape orientation
- Margin: 15 mm
- Pen width: 0.35 mm
- Render resolution: 3 px/mm (tool default)
- Seed: 33
- Hand-sketch finish: 0.12, `fine` style (subtle wobble — a surveyor's
  steady hand, not a loose sketch)
- Stroke color embedded in the SVG: `#4b3319`
- Output: 4,417 strokes, single pen, single layer

## Reproduction

Built and rendered against this repo at the commit this folder was
committed on. From the repo root, after `pnpm install && pnpm build`:

```sh
node packages/cli/dist/cli.js lapidary \
  --mode strata \
  --paper a3 --orientation landscape \
  --seed 33 \
  --bands 6 --faults 2 \
  --shapes mixed --waviness 0.55 \
  --textures "grain,stipple,wavy,solid,crystal,cross" \
  --tone-shape seam --tone-strength 0.45 \
  --hand-sketch 0.12 --hand-sketch-style fine \
  --margin-mm 15 --pen-width-mm 0.35 \
  --stroke-color "#4b3319" \
  -o artwork.svg
```

Preview (approximates the walnut-washed paper; does not attempt to
render the optional pencil scale bar):

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background "#e9dcc2"
```

## Wishes

- `lapidary`'s `strata` mode has no way to query or export each band's
  computed boundary (as, say, a JSON side-channel of band index → y
  range per x-column). For this piece it didn't matter — the wash is
  a single overall pre-toning, not per-band colour — but a future
  piece that wanted true per-lithology watercolour washes (mapped
  precisely under the ink, the way real hand-tinted geological survey
  plates were coloured) would need that boundary data to mask each
  wash accurately. Right now the only way to get it is to eyeball the
  render.
- No generator currently emits text (captions, scale bars, legends).
  For a piece built around a real technical-drawing convention, a
  minimal ruled-scale-bar primitive (length + tick pitch + two text
  labels) would be a small, generically useful addition — plottable
  captions are a gap across every generator, not just this one.
