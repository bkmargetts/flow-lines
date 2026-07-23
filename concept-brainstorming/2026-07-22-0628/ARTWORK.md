# The Unmapped River

## Artist statement

In 1944 Harold Fisk published *Geological Investigation of the Alluvial
Valley of the Lower Mississippi River* — plates that trace a river's
migration across centuries by drawing every former channel position at
once: the modern course bold and solid, older courses in fading colour,
abandoned loops stranded as oxbow lakes. It's one of the strangest maps
ever made official — decades of erosion compressed into a single
gorgeous, tangled diagram — and it's been reprinted as art ever since,
hanging in offices that have nothing to do with hydrology.

This piece takes that *convention* rather than that river. The meander
generator is a real (if simplified) physical simulation — curvature-driven
bank erosion, an upstream friction lag, bends that grow, migrate
downstream, and pinch off into oxbows exactly the way an actual
alluvial river does — but run on no actual valley. What Fisk surveyed
with a plane table, this plots from a seed number. The piece is honest
about that: it's a real simulation's history, of a river that was never
anywhere.

I built it as a triptych — three A3 sheets in a row, one continuous
370-year channel running left to right across all of them — because a
single sheet kept feeling like a fragment of something bigger, and this
generator's whole subject *is* the accumulation of a long history. Of
roughly thirty seeds tried at this configuration, seed 99 was the one
that didn't just wander at one rhythm start to finish: it opens loose
and searching, tightens into a dense cluster of hairpin bends, then
about a third of the way across the belt finds a long, calm, almost
straight reach — a "chute," where in a real river the current would have
briefly cut through resistant ground — before closing on a tangled,
oxbow-heavy stretch at the far right. That calm reach lands almost
exactly on the join between the first and second panels, so the seam
between sheets falls on the piece's one moment of quiet rather than
cutting through a tangle. I didn't plan that; I noticed it on the
assembled proof and kept the seed for it.

Fisk's plates used a full spectrum of colour, one hue per century of
history — more colours than this project's one-pen-per-layer discipline
would allow, and more than the piece needs. I kept his three-part
*structure* — living channel, fading memory, dead water — and gave each
exactly one ink: a bold, confident indigo for the current course; a
warm, quiet sepia for the scroll-bar history fragmenting with age; a
cool, receding teal for the oxbow lakes, water that stopped moving
generations ago. Three pens, each doing one honest job, on a warm paper
that reads like a real survey sheet rather than a printout.

## Materials

- **Paper**: Fabriano Ingres, Avorio (ivory/cream), 90gsm laid paper —
  three sheets, A3 (297×420mm) each, used **landscape**. A warm, lightly
  textured stock chosen to read as archival survey paper rather than
  bright inkjet white; hex reference for the preview: `#f3ead6`.
- **Pen 1 — the living channel (bold)**: a fine technical pen (e.g.
  Staedtler Pigment Liner or a plotter fineliner) in a deep indigo ink —
  "Diamine Registrar's Ink" or similar iron-gall-adjacent blue-black is a
  good real-world match. Hex reference: `#16223f`. Plotted at 0.35mm,
  built from repeated offset passes (handled entirely by the generator —
  never a wider nib).
- **Pen 2 — the scroll-bar history (fine)**: a warm sepia/walnut-brown
  ink — "Diamine Sepia" or "Noodler's Walnut" — hex reference: `#8a6a44`.
  Same 0.35mm tip.
- **Pen 3 — the oxbow lakes (fine)**: a muted, cool teal — "Diamine
  Marine" leaned cooler, or "Noodler's Zhivago" — hex reference:
  `#3c6e68`. Same 0.35mm tip.
- Nothing else: no wash, no mounting adhesive beyond a standard float
  mount when the assembled triptych is framed.

## Process

Each of the three A3 sheets is plotted three times — once per pen — with
the paper never moving between passes (a locked-down plotter bed or
registration pins), then the sheets are trimmed and butted edge to edge:

1. Load sheet 1 (destined to be the **left** panel), pen 1 (indigo).
   Plot `artwork-r1c1.channel.svg` (the modern course) and
   `artwork-r1c1.register.svg` (corner registration crosses — plot these
   first, in the same pen, so every later pass on this sheet can be
   checked against them).
2. Without moving the paper, swap to pen 2 (sepia) and plot
   `artwork-r1c1.trace.svg` (the scroll-bar history).
3. Swap to pen 3 (teal) and plot `artwork-r1c1.oxbow.svg` (the abandoned
   loops).
4. Optionally, swap to a light non-photo-blue or pencil and plot
   `artwork-r1c1.tile-marks.svg` — trim ticks held just inside the
   margin line on the two edges that meet a neighbouring sheet (the
   right edge only, for this leftmost sheet). These (and the
   registration crosses) live entirely inside the 12mm margin and are
   cut away in step 7 — they never appear in the finished piece.
5. Repeat steps 1–4 for sheet 2 (**centre** panel) with
   `artwork-r1c2.*.svg` — this sheet has tile-marks on *both* long edges
   (it joins a neighbour on each side).
6. Repeat for sheet 3 (**right** panel) with `artwork-r1c3.*.svg` —
   tile-marks on the left edge only.
7. Let all ink cure fully (a wet iron-gall-adjacent line under a teal or
   sepia crossing is the one real risk — plot indigo first, then sepia,
   then teal, and give each pass a few minutes before the next, as above,
   so nothing drags). Trim each sheet's margin along its tile-marks with
   a straightedge and blade — this removes the registration crosses and
   trim ticks entirely, leaving only the artwork out to a clean cut edge.
8. Butt the three trimmed sheets edge to edge in order (left, centre,
   right) so the channel and scroll-bars run continuously across the
   joins, and tape them from behind with linen tape. Float-mount the
   assembled 1188×273mm sheet (minus the trimmed margins — finished
   panel is 396×273mm each, 1188×273mm assembled) in a single frame, or
   frame each panel separately with equal mat spacing so the three read
   as one strip.

## Plot settings

- Virtual sheet (pre-tiling): custom **1188×273mm**, portrait orientation
  flag (the custom size is used as-given; "portrait" here just means
  "don't swap the two numbers I gave you").
- Tiled to **3 × A3, landscape**, 1 row × 3 columns, no tile overlap.
- Margin: **12mm** per sheet (shared by the main canvas and each tile).
- Pen width: **0.35mm**, resolution 3px/mm.
- Registration crosses (`--crosses`) and tile-marks (`--tile-marks`) are
  included as separate guide layers per sheet, meant to be plotted in a
  disposable/guide colour (or skipped and worked from a ruler) and
  trimmed away — they are not part of the finished ink.
- Pen travel: modest — 596 strokes total across the whole belt before
  splitting into layers/tiles (138–161 trace paths, 31–43 oxbow, 17–23
  channel per sheet); no single sheet takes more than a few hundred
  pen-down strokes.

## Reproduction

Built and rendered from a clean `pnpm install && pnpm build` at this
repo's current `main`. Every SVG in this folder comes from one command:

```sh
node packages/cli/dist/cli.js meander \
  --paper 1188x273 --orientation portrait \
  --tile a3 --tile-orientation landscape --tile-marks --crosses \
  --margin-mm 12 --pen-width-mm 0.35 --resolution 3 \
  --preset atlas --seed 99 --flow-angle 0 --valley-width 0.22 \
  --split-layers \
  -o artwork.svg
```

This writes 15 files: `artwork-r1c1.*.svg`, `artwork-r1c2.*.svg`,
`artwork-r1c3.*.svg` (left/centre/right panels), each split into
`channel` / `trace` / `oxbow` / `register` / `tile-marks` layers.

`preview.png` was rendered by taking each panel's three ink layers,
rasterizing them individually with `scripts/svg-to-png.mjs` using
`--background '#f3ead6'` and each layer's ink hex as `--stroke`, cropping
away the 12mm margin (the part a real assembly trims off), compositing
the three inks back together per panel, and concatenating the three
trimmed panels edge to edge — i.e. the preview shows exactly the
finished, assembled, trimmed piece, not the three untrimmed plotter
sheets.

## Wishes

- No way to render a "trimmed assembly preview" directly from the CLI —
  I had to hand-roll the crop-and-composite step in a scratch script
  (crop each tile PNG to its trim rect, recolour each split layer, paste
  the panels edge to edge). A `--tile-assembly-preview` flag (or a
  documented helper script alongside `svg-to-png.mjs`) that renders the
  trimmed, butted, multi-ink composite in one call would help every
  future multi-sheet, multi-pen piece in this folder.
- `MeanderOptions` has no way to ask for *more* age-bands of history than
  `traces` gives without also thickening every band's break pattern via
  `fade` — a touch more independent control over "how many distinct
  memory-generations" vs "how ragged each one looks" would widen the
  Fisk-plate register further.
