# Low Tide Metropolis

## Artist statement
A small tower city, drawn leaning and a little unsteady (city generator at
`order 0.3`), stands in still water under a hatched, mostly dark moon. The
pen draws the city once; the water draws it again, sheared into ripple
bands and dissolving into horizontal gaps the deeper it goes, until only
dashes of moon-glint remain. It survived the cull because the
reflection does the emotional work: half the picture is the city being
forgotten. Everything is white and cyan line on midnight blue — a
night-scene as a chalk diagram. Nothing like it exists in the earlier
sessions (no city-over-water, no moon-and-reflection).

## Materials
- Paper: 300 gsm dark navy cotton/card, A3 (297 × 420 mm), landscape.
  Closest: "midnight blue" Colorplan/Canson Mi-Teintes dark blue, approx. `#10223a`.
- Layer 1 (city): white gel pen, 0.35 mm — Sakura Gelly Roll Classic White, `#f2efe4`.
- Layer 2 (water + reflection): pale cyan gel/paint pen, 0.35 mm — e.g.
  Uni-ball Signo pastel blue or Posca PC-1MR in light blue, `#8fd0d6`.
- Layer 3 (moon, glint, stars): warm gold gel pen, 0.35 mm — Sakura
  Gelly Roll Metallic Gold, `#e8c872`.
- Low-tack artist tape; a 2-pin registration jig or tape corners on the plotter bed.
- Presentation: float mount in a deep black box frame, no glass glare.

## Process
1. Tape the navy sheet flat on the plotter, landscape, and mark its corners on the bed.
2. Plot `artwork-layer-1.svg` (city) with the white pen. Let gel ink dry ~30 min.
3. Swap to the cyan pen; without moving the sheet plot `artwork-layer-2.svg`
   (waterline strokes + sheared reflection). Dry ~30 min.
4. Swap to the gold pen; plot `artwork-layer-3.svg` (moon rim + earthshine hatching, stars, glint column).
5. Optional hand step: with a dry-ish white pen, go over the moon's lit crescent
   edge once by hand to thicken it; leave everything else untouched.
6. Float-mount.

## Plot settings
A3 landscape, SVG in mm (420 × 297 viewBox — the drawing's own margin ~14 mm,
so it fits A3 with ~ 0 mm clear; plot onto A3 with 0 offset), pen 0.35 mm for all
layers. Paths: 527 / 508 / 175; plain stroked paths, deterministic.

## Reproduction
`flood.mjs` (in this folder) is the scratch script. It imports the built core
(`pnpm install && pnpm build` first):

```sh
node concept-brainstorming/2026-10-12-0609/flood.mjs 5 0.3 towers out
mv out-city.svg artwork-layer-1.svg
mv out-water.svg artwork-layer-2.svg
mv out-moon.svg artwork-layer-3.svg
```
Seed 5, order 0.3, style `towers` (city) ; the water, moon and star details use
a hash-based rng keyed on the same seed. Verified byte-identical on re-run.
Preview: layers merged, recoloured per the inks above, rasterised with
`node scripts/svg-to-png.mjs merged.svg preview.png --width 1600 --background '#10223a'`.

## Wishes
- A CLI `city` command and a first-class `reflect` compose operator (mirror
  + band-shear + progressive dropout), instead of a scratch script.
- A `moon`/disc primitive with terminator hatching.
