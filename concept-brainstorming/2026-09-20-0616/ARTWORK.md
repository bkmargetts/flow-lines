# Occultation

## Artist statement

*Occultation*, in astronomy: when one body passes directly in front of
another and hides it completely — the word survives from an older,
unrelated sense, "the state of being hidden, esoteric, beyond ordinary
sight." A total solar eclipse is the one everyday event where both
meanings are literally true at once.

`warp-grid` is an op-art generator built to make Bridget Riley's *Blaze*
and *Current* out of a flat ruled grating pushed by hidden domes, ridges,
vortices and lenses — ninety-some straight rays fired from the sheet's
edge, bent only by a form the generator itself never draws. Aimed at its
own `blaze` preset (rays base, a vortex twist and a lens pinch, sized
generously), that hidden form isn't rendered as a shape at all: it's a
hole in the ray field, a patch of paper the rays refuse to cross. Nothing
was drawn there. The rays simply stop reaching it, the same way the
corona in a real eclipse photograph isn't light emanating from a black
disk — it's sunlight with a disk-shaped bite missing.

I scouted the `blaze` preset across roughly forty seeds looking for one
thing: a void whose *edge* did the work, not just its presence. Most
seeds produce a tidy circle — dead-centre, honest, a little inert, more
diagram than drawing (a bullseye like that is one of the "reads as
computer" traps the repo warns about — see the seed‑63 test render in
this session's scratch history, discarded for exactly that reason).
Seed 9 does something else: the vortex twist drags the void into a
comma, not a disk, and where the lens pinch nearly closes over it a
narrow gap survives — a crescent of fine concentric arcs, precisely the
shape of the sliver of photosphere still showing an instant before or
after totality (what eclipse photographers call the "diamond ring"). A
short triangular flare breaks free of the void's upper edge into the
ray field itself, unprompted, the compression floor doing to a lens
pinch what it does to every warp-grid preset: breaking a line before it
pools into solid ink. Above and below the void the rays don't just bend
toward it, they curl — an S-flex with no equivalent in a real eclipse's
optics, but exactly the gesture an engraver's hand makes describing one
anyway. A hairline `--hand-sketch` pass (0.18, `fine`) is the only other
intervention: it breaks the machine-straight rays at the sheet's edges
into a waver no ruling pen ever fully avoids, without touching the
geometry that makes the void read as a void.

No sun is drawn. No moon is drawn. The entire image is the absence
between them, and the bend in the light that the absence causes — which
is also, description for description, what an occultation *is*.

## Materials

- **Paper:** Canson Mi-Teintes, colour 425 "Night Blue," smooth
  (structure) side up, 160gsm, one A3 sheet (297 × 420mm, portrait). The
  deep indigo-black reads as night sky under gallery light without
  going flat matte-black; it's also forgiving of the metallic ink's
  slightly uneven lay, which a true jet-black stock would show up more.
- **Ink/pen:** one pen, one width, the entire sheet — Sakura Gelly Roll
  Metallic 08, Silver (`#c9c4b3` as plotted; the pigment reads brighter
  and cooler in hand than any flat hex), loaded in a standard AxiDraw
  pen holder. 0.3mm effective line width (the repo default) — fine
  enough to keep the ~180 rays crossing the sheet distinct at the
  9px pitch this piece uses, without the gel ink's wider wet-lay
  bridging adjacent lines the way a technical pen's drier ink wouldn't.
- **Mounting:** black-core museum board, float mount (so the paper's
  own edge reads as the sky's edge, not a framed rectangle inside a
  larger rectangle), simple black timber frame, UV-filtering glazing.

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the
   reproduction command below to generate `artwork.svg`.
2. Tape the A3 Canson Mi-Teintes "Night Blue" sheet to the plotter bed,
   smooth side up, portrait orientation, registered square to the bed's
   home corner.
3. Fit the plotter with the Gelly Roll Metallic Silver 08, primed on
   scrap of the same stock until the line lays down solid (metallic
   gel ink under-fills on the first few centimetres after a pen change;
   don't skip this).
4. Plot `artwork.svg` in one unattended pass — single pen, no swaps,
   no registration required.
5. Let the ink cure fully before handling — gel ink on coloured
   mixed-media stock stays tacky longer than pigment liner on hot-press
   white; two hours flat, ink-side up, away from dust, is the safe
   minimum for this ink/paper pairing.
6. Float-mount and frame as described above.

## Plot settings

- Paper: A3, portrait, 297 × 420mm
- Margin: 25mm clear border
- Pen width: 0.3mm
- Ray pitch (`--spacing`): 9px at 3px/mm — ~180 rays crossing the full
  height of the sheet
- Edge calm: 0.32 (the rays return to dead-straight in a wide band at
  the margin, so the warp reads as emerging from a quiet sheet rather
  than touching the frame)
- Hand-sketch: 0.18, `fine` style (subtle waver only, no extra overdraw
  passes)
- Effective density: 3px/mm (891 × 1260 viewBox)
- Estimated pen-down travel: ~45m of ink; pen-up travel: ~2.6m (401
  strokes after hand-sketch pen-lifts, already nearest-neighbour
  ordered by `optimizePlot`) — a single unattended session
- Single pen layer throughout — nothing to split, no registration
  passes

## Reproduction

```sh
pnpm install && pnpm build

node packages/cli/dist/cli.js warp-grid \
  --preset blaze --seed 9 \
  --paper a3 --orientation portrait --margin-mm 25 --pen-width-mm 0.3 \
  --spacing 9 --edge-calm 0.32 \
  --hand-sketch 0.18 --hand-sketch-style fine \
  --stroke-color '#c9c4b3' \
  -o artwork.svg

node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#0d1023' --stroke '#c9c4b3'
```

Both commands are deterministic given the repo at this commit; `seed 9`
fixes deformer placement, size, strength and sign, and `--hand-sketch-seed`
defaults to the render seed so the waver pass is pinned too.

## Wishes

- Landing this composition took a manual sweep of ~40 seeds at the
  final paper aspect ratio, because a seed's void shape and position
  depend on the canvas's aspect (the same seed looks different at
  square vs. A3-portrait proportions) and there's no way to fix a
  deformer's *position* while still letting its size/strength/sign roll
  freely. A `--anchor cx,cy` (or "keep centre, randomise everything
  else") escape hatch on `warp-grid` would turn this kind of hunt into
  a strength/scale sweep instead of a seed lottery.
- `--occlude` is silently disabled for the `circles`/`rays` base
  patterns (`generateWarpGrid`, guarded in the options resolution) —
  reasonable, since hidden-line removal on a closed ring doesn't mean
  the same thing it does on a straight grating, but the CLI help text
  doesn't say so, and I only found it by reading the source after a
  `--pattern rays --occlude on` run produced byte-identical output to
  the same command without `--occlude`.
