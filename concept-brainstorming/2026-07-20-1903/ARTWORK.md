# What the Break Remembers

## Artist statement

A square panel of black cotton-rag paper, its surface open and unmarked
except for a single confident fracture running corner to corner — and the
fracture is drawn in gold.

This is the fracture generator turned away from its usual job. Left at
its defaults it renders dried mud, crazed glaze, shattered ice: incident
damage, read cold. Strip the plate-hatch out and keep only the crack
lines themselves, and the same crack-propagation physics — tips
nucleating at stress maxima, screening the ground around them, arresting
against earlier cracks in clean T-junctions, never an X — draws something
else: the seam of a kintsugi repair. A vessel mended with lacquer dusted
in gold, the philosophy that the break is not a flaw to hide but the
object's most truthful line, worth gilding rather than disguising.

Of a dozen candidates across all three fracture presets — `mud`'s busy
tessellated plates, `crazing`'s dense uniform net, `shatter`'s
edge-driven violence — none of them, hatched, ever stopped reading as
"crack pattern." The generator's real gift turned out to be the
*hierarchy* it builds for free: a handful of bold, straight, generation-0
primaries carrying the composition, with finer generation-1 cracks
fraying off them into the plate interiors. Rendered as line alone, on
black, in gold, that hierarchy stops looking procedural and starts
looking like a repair map — a record of exactly where something gave way
and exactly how it was made whole again.

Seed 101, at low crack density and high tip straightness, was the one
candidate (of ~20 seeds tried across two rounds) where the primaries
gathered into a single dominant diagonal spine — top-right to
bottom-centre — with the rest of the network reading as tributaries
feeding it, rather than a scatter of unrelated breaks. That asymmetry,
plus the wide quiet field of untouched black in the upper-right quadrant,
is what earned it the keep over the other candidates: one clear gesture,
not a grid of incidents.

## Materials

- **Paper**: Stonehenge Black, 250gsm, 100% cotton rag, cut to a
  260 × 260mm square (from a larger sheet — plot before trimming to the
  final size, see Process).
- **Ink — bold seam (primary cracks)**: Sakura Gelly Roll Gold, 08 Bold
  tip (~1.0mm laydown). Hex approximation for the digital preview:
  `#C9A227`.
- **Ink — fine seam (secondary crazing)**: Sakura Gelly Roll Gold, 05
  Fine tip (~0.4mm laydown), same ink family/colour as the bold pass so
  the two passes read as one continuous material at two weights.
- **Mount**: black-core float mount, 8mm reveal on all sides, in a
  simple dark walnut or matte-black box frame under UV-filtering glass
  (gel-pigment metallics are prone to fading/abrasion — keep it glazed).

## Process

1. Cut (or have cut) the Stonehenge Black cotton rag sheet to at least
   280 × 280mm — a few mm of working margin beyond the final 260mm
   square, trimmed off after plotting, so the plotter's hold-down and any
   edge wander never touch the finished border.
2. Mount the sheet on the plotter bed, registered square to the axes.
   Fit the pen holder with the **Gelly Roll Gold 08 (Bold)** pen.
3. Plot `artwork.crack-primary.svg` — the seven bold seam lines (each
   already built from repeated offset passes of this one pen, tapered at
   the ends: the file *is* the bold pass, nothing else to configure).
   This is the visible "gold-filled" crack the eye follows first.
4. Let the gel ink set for at least 10 minutes on cotton rag before the
   next pass — gel pigment sits on the surface rather than soaking in,
   and stays smearable longer than on smoother stock.
5. Without moving or re-registering the paper, swap in the **Gelly Roll
   Gold 05 (Fine)** pen and plot `artwork.crack-fine.svg` — the
   fourteen finer secondary cracks that fray off the primaries. Same
   origin, same sheet: the two passes are two pens on one registration,
   not a misaligned double-plot.
6. Leave flat to cure fully, minimum 30 minutes, before any handling.
7. Trim the sheet down to the final 260 × 260mm square along the
   plotted margin line (14mm clear border was plotted in on all four
   edges — trim just inside it, or leave a hairline of that border
   showing as a deliberate frame-within-a-frame).
8. Float-mount and frame as above.

`artwork.svg` in this folder is both layers combined into one file — a
single reference render of the finished piece, not a third plotting
pass.

## Plot settings

- Paper: 260 × 260mm square (custom size, well under the A3 ceiling)
- Margin: 14mm clear border, plotted in
- Pen widths: 1.0mm bold pass, 0.4mm fine pass (physical pens above; the
  `--pen-width-mm` flag used to generate these files only sets the
  cosmetic SVG preview stroke width, 0.5mm, and has no effect on the
  underlying geometry)
- Resolution: 3 px/mm (CLI default)
- Strokes: 22 bold-pass paths (7 primary cracks × up to 3 offset passes
  each) + 14 fine paths = 36 total — a short, fast plot

## Reproduction

Built with `pnpm install && pnpm build` at the repo root, then from
`packages/cli`'s built output:

```sh
# Combined reference render (artwork.svg — both layers merged, one file)
node packages/cli/dist/cli.js fracture \
  --preset mud --no-plate-hatch \
  --generations 2 --crack-density 0.22 --straightness 0.9 \
  --seed 101 \
  --paper 260x260 --margin-mm 14 --pen-width-mm 0.5 \
  -o artwork.svg

# Per-pen layers for plotting (artwork.crack-primary.svg, artwork.crack-fine.svg)
node packages/cli/dist/cli.js fracture \
  --preset mud --no-plate-hatch \
  --generations 2 --crack-density 0.22 --straightness 0.9 \
  --seed 101 \
  --paper 260x260 --margin-mm 14 --pen-width-mm 0.5 \
  --split-layers -o artwork.svg
```

`preview.png` was rendered from `artwork.svg` with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png \
  --width 1600 --background '#141210' --stroke '#c9a227'
```

(`#141210` approximates Stonehenge Black's warm-black cotton surface;
`#c9a227` approximates the Gelly Roll Gold laydown.)

## Wishes

- The fracture generator has no way to bias nucleation toward a chosen
  point (an "impact origin" the cracks radiate from) — every candidate's
  composition came from seed search over the existing stress-noise
  field rather than a placeable focal point. An optional
  `--impact-x`/`--impact-y` (a stress-field hot-spot at a chosen
  location) would make this whole direction — deliberately-composed
  breakage, not just found-and-culled — much more directly steerable.
- `--split-layers` names files by internal layer tag
  (`crack-primary`/`crack-fine`/`plate`), which turned out clearer than
  the README's generic `artwork-layer-1.svg` convention for a two-pen
  piece like this — worth considering as the documented convention
  rather than an incidental implementation detail.
