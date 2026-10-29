# Frozen Weather

## Artist statement

A uniformly random domino tiling of a diamond, sampled exactly by domino
shuffling, with two of its four domino classes inked in two different
metals. Nothing in the algorithm mentions a circle, yet the tiling freezes
into two solid, perfectly ordered corners (silver top-right, copper
bottom-left) separated from a turbulent interior by an almost razor-sharp
curved boundary: the *arctic circle*. It reads like a weather system or a
planet seen from orbit, but every mark is a straight diagonal pen stroke
and every gradient is combinatorics. Two inks make the two frozen poles
read as warm and cold fronts. It survived the cull against the one-ink
`dissolve` (too diagrammatic) and the four-class `weave` (too even and
grey): two classes on a dark ground gives the boldest shape with the most
restraint. The paper does half the work.

## Materials

- **Paper:** dark midnight-navy card, ~250 gsm, smooth, A3 (297×420 mm), approx. `#14182e` (e.g. a deep indigo/"midnight" cover stock).
- **Pen 1 (layer `domino-n`):** opaque silver-white gel pen, e.g. Sakura Gelly Roll Moonlight/white, 0.3-0.5 mm nib. Colour ≈ `#e9e6dc`.
- **Pen 2 (layer `domino-s`):** metallic copper paint/gel pen, 0.5 mm nib. Colour ≈ `#d98a4e`.
- Low-tack masking tape for registration marks on the sheet corners.

## Process

1. Tape the card flat to the plotter bed; mark the sheet corners lightly with tape so the sheet can be removed and replaced.
2. Plot `artwork-domino-n.svg` with the silver-white pen, A3 portrait, pen-down line width 0.3 mm in the file. Test pen flow on scrap first; gel pens skip on first strokes, so allow a prime stroke off-sheet if the plotter supports it.
3. Let dry 30 minutes (gel/opaque inks smear).
4. Re-seat the sheet against the taped corners and plot `artwork-domino-s.svg` with the copper pen. The two layers never cross on the same stroke (they are different domino classes), so small misregistration shows as slight gaps, not overprint: keep it under 0.5 mm.
5. Optional hand step: with a fine brush, a single dilute pearl-white wash is *not* recommended; leave the dark paper bare.
6. Float-mount unframed behind museum glass with a 40 mm navy window-mat gap.

## Plot settings

A3 portrait (297×420 mm), 25 mm margin, pen width 0.3 mm in the files (the diamond fills ≈ 247 mm wide; the stroke spacing is ≈ 1.6 mm so a 0.5 mm physical nib is fine). Order 150 Aztec diamond (22 650 dominoes); ~7 800 strokes total across two layers, already pen-travel ordered.

## Reproduction

```sh
pnpm install && pnpm build
node concept-brainstorming/2026-10-29-0609/reproduce.mjs
```

`reproduce.mjs` (included in this folder) calls `generateArctic({ seed: 7, preset: 'horizon', upright: true, order: 150, margin: 25mm })` at A3 and writes
`artwork-domino-n.svg` and `artwork-domino-s.svg` via `toSVGLayers`.
`preview.png` was made by merging the layers coloured `#e9e6dc` / `#d98a4e` and rasterising with
`node scripts/svg-to-png.mjs merged.svg preview.png --width 1400 --background '#14182e'`.

## Wishes

- An `arctic` CLI command (currently core-only).
- Per-class colour/pen assignment flags like `--split-layers` offers elsewhere.
