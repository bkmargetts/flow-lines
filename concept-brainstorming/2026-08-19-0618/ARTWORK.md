# Drift

## Artist statement

A cut and polished agate, drawn as a fortification agate — the real
mineralogical term for a banded stone whose growth rings run in sharp
zigzags rather than smooth curves, so a slice through one shows nested
angular rings that genuinely do look like the star-shaped ramparts of an
old fort. This piece is not a drawing of any actual specimen. It is the
repo's brand-new `lapidary` generator — built for cut-stone
cross-sections and, as far as this studio's records go, never used here
before — run on nothing but a seed number, in `agate` mode with the
`angular` silhouette language turned on.

What earned this seed the keep is a thing the generator does honestly,
not a trick I asked for: `agate` mode nests bands concentrically around
one centre, but the per-band silhouette noise that gives each ring its
hand-cut irregularity is strong enough, at this seed, that the rings stop
agreeing on where "centre" is. A second, smaller nested set drifts up and
to the right of the first, so the piece reads — at a glance — as two
fused stones, or one stone photographed with its own ghost. It isn't a
bug and it isn't a compositing trick. It's exactly what real fortification
agates do: chalcedony deposits in bands, but the growth surface itself
migrates as each new layer goes down, so a genuine polished slice often
shows its rings walking off-centre from rim to core. Collectors have a
name for the more dramatic cases — "eye agates," "drifted centres" — and
usually pay more for them, not less. I rendered thirty-odd seeds before
this one, most of which built a single tidy honeycomb of rings — accurate
to no drift, an evenly good coloring page. This is the one candidate
where the drift reads as a real specimen's geological memory rather than
a rendering glitch, and where the crystal-lined hollow at the smaller
core — quartz-druse texture, added by hand by swapping the reference
preset's innermost stipple for `crystal` — sits exactly where the eye
wants a full stop.

The three-ink interleave is not decoration either. `agate`'s default
`interleave` pen assignment alternates ink stroke-by-stroke within every
band, which happens to be a legitimate description of how real banded
agate actually forms: trace-mineral chemistry drifts in and out with each
deposit, so a single visible band is often itself a fine lamination of
several trace colours, not one flat tint. Running three translucent inks
through that same interleave — rather than one flat colour per ring — is
the generator's stock behaviour pointed at a use it happens to be
mineralogically correct for.

What I'm drawn to is the same thing that draws people to backlit agate
slabs in the first place: the object only fully declares itself with
light coming through it, not bouncing off it. A flat-lit ink plot can't
show that — this SVG, seen on a screen or under a lamp, is the least
interesting way to encounter this piece. It's built to be held to a
window.

## Materials

- **Substrate** — one sheet of heavyweight translucent drafting film, A3
  (420 × 297 mm), landscape. Grafix Dura-Lar Wet Media Film (dual-matte,
  4 mil) or Strathmore 500 Series Translucent Vellum, 90–100 gsm — needs
  enough tooth to hold three passes of dye ink without beading, and
  enough translucency to glow when backlit. Do not use tracing paper —
  too fragile for three registered passes and dulls badly when lit.
- **Ink 1 — "iron"** (`ink-0`, `artwork.ink-0.svg`): a translucent
  burnt-sienna/iron-oxide dye ink, colour reference `#a8501f`. Dr. Ph.
  Martin's Bombay India Ink — Terracotta, or an equivalent translucent
  alcohol marker (Copic E15/E18 range), loaded in a 0.35 mm technical
  pen or brush-tip adapter. Must be genuinely translucent dye, not
  pigment — pigment ink stays opaque under backlight and kills the
  effect (see the studio's 2026‑08‑09 CMY piece for the same
  requirement).
- **Ink 2 — "chalcedony"** (`ink-1`, `artwork.ink-1.svg`): a translucent
  smoky blue-grey dye ink, `#46626c`. Dr. Ph. Martin's Bombay India Ink —
  Denim, or Copic B39/B60 equivalent, same pen/width.
- **Ink 3 — "quartz"** (`ink-2`, `artwork.ink-2.svg`): a translucent
  honey-amber dye ink, `#c1922f`. Dr. Ph. Martin's Bombay India Ink —
  Topaz/Amber, or Copic Y21/YR23 equivalent, same pen/width.
- **Ink 4 — "register"** (`artwork.register.svg`): any spare fine
  pigment liner in a neutral grey, `#6b6156` — these four tiny corner
  crosses exist only to re-align the film between ink swaps and should
  read as close to invisible as the plotter allows (0.2–0.3 mm nib if
  available).
- **Mounting** — a slim black metal float-frame sized for A3 with a
  diffusing acrylic or frosted-glass backing panel and a slim LED edge-
  or panel-light behind it (a photographer's slim lightbox insert works
  directly), OR simply four black binder clips holding the sheet against
  a window pane — the piece is designed to work either way, and to look
  different in the two settings.

## Process

1. Cut/select one A3 sheet of the translucent film, matte side up
   (matte holds ink; the glossy face resists it). Register the plotter
   for a 420 × 297 mm landscape sheet, 15 mm margin all round.
2. Load the register ink (grey, fine nib). Plot `artwork.register.svg`
   (4 corner crosses). This lays the alignment marks before anything
   else touches the sheet.
3. Load Ink 1 ("iron", `#a8501f`), 0.35 mm. Plot `artwork.ink-0.svg`.
   Let dry flat 10–15 minutes — dye inks on film stay workable longer
   than on paper; don't rush this or the next pass will drag.
4. Swap to Ink 2 ("chalcedony", `#46626c`), same width. Re-register the
   sheet against the corner crosses (the plotter's own registration if
   it holds position between jobs; otherwise realign the film by eye
   against the printed crosses through the film — this is why they're
   there). Plot `artwork.ink-1.svg`. Dry 10–15 minutes.
5. Swap to Ink 3 ("quartz", `#c1922f`), same width. Re-register, plot
   `artwork.ink-2.svg`. Dry fully — at least 30 minutes flat — before
   handling.
6. Trim the sheet to the plotted margin line if a hard edge is wanted;
   otherwise leave the full A3 sheet, since the four register crosses
   sit just inside the trim line and read as a deliberate printer's
   mark either way.
7. Mount: float in the LED-backed frame for a controlled, always-on
   glow, or clip to a window for a piece that shifts with the day —
   both are the intended presentation, not a fallback for the other.

## Plot settings

- Paper: A3, landscape orientation, 15 mm margin.
- Pen width: 0.35 mm, all four layers.
- Pens: 3 ink layers (`ink-0`/`ink-1`/`ink-2`, interleaved by the
  generator) plus 1 register layer.
- Resolution: 3 px/mm (CLI default).
- Strokes: 1,731 total across the three ink layers before splitting;
  optimize/reorder left on (default) — pen-up travel is not the
  constraint here, registration accuracy between the three passes is.

## Reproduction

Built with `packages/core`'s `lapidary` generator via the CLI, seed 60,
`agate` mode with the `angular` silhouette language:

```sh
node packages/cli/dist/cli.js lapidary \
  --mode agate --bands 6 --pens 3 --coverage 0.92 --shapes angular \
  --irregularity 0.55 \
  --textures "lines:0:1.2,contour::1,contour::0.7,lines:90:1.4,contour::0.9,crystal::1.1" \
  --center-x 0.18 --center-y -0.12 --seed 60 \
  --paper a3 --orientation landscape --margin-mm 15 --pen-width-mm 0.35 \
  --split-layers --crosses --cross-offset 3 \
  -o artwork.svg
```

This writes `artwork.ink-0.svg`, `artwork.ink-1.svg`, `artwork.ink-2.svg`
and `artwork.register.svg` — all four are byte-identical to the files in
this folder except for stroke colour (the CLI emits `#000000` for every
layer; the committed files have each layer's physical ink hex baked in
by a one-line `sed` substitution: `ink-0` → `#a8501f`, `ink-1` →
`#46626c`, `ink-2` → `#c1922f`, `register` → `#6b6156`).

`preview.png` is the four recoloured layers merged into one SVG (paint
order: register, then ink-0, ink-1, ink-2 — the same order as the plot)
and rasterized:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 1800 --background '#f5f0e4'
```

(`merged.svg` is a throwaway concatenation of the four recoloured files
sharing one `viewBox`; it is not committed, since the four layer SVGs it
merges already are.)

## Wishes

- `--palette` on the `lapidary` command only offers a fixed list of
  named pen sets; there's no way to pass arbitrary per-pen hex colours
  on the command line the way `--vein-color` lets you for the vein
  layer alone. Not a blocker — recolouring the exported layer SVGs by
  hand is one line each — but a `--pen-colors` CSV flag (mirroring
  `--textures`'s per-item syntax) would save the manual step next time.
- Nothing else: `agate` + `angular` + a hand-picked seed did everything
  this piece needed without touching the generator's code.
