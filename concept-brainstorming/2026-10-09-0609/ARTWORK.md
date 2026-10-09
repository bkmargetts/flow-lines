# Tenant of the Moon

## Artist statement

A tower block city climbs a hill of its own shadow, and behind it a hatched gold moon is large enough to be a wall. The moon is drawn the way old lunar plates were engraved (curving form-hatch, traced maria, ringed craters). The towers are drawn the way an architect's hand-sketch would be (single-line outline, diagonal shade hatch, window dashes). The two idioms never touch: a clean band of reserved paper separates every roofline from the moon, so the city reads as cut out of the disc.

It survived the cull against a full-bleed oversized moon (too much ink, city lost), an old-town variant (pretty, but the roofs were too small to hold the moon) and a seed with a lopsided skyline. The 'towers' style at order 0.35 leans just enough to feel human, and the moon's day/night terminator runs diagonally against the city's own light side, giving the piece a tension I keep coming back to: whose light is this?

Two pens, two colours, one night. Nothing here is a filter on a photo; both halves are procedural.

## Materials

- **Paper:** A3 (297 x 420 mm) black or deep-indigo card, 250-300 gsm, smooth (e.g. Colorplan "Ebony" or Canson Mi-Teintes "Indigo"). The preview uses `#14161f`.
- **Layer 1 (moon):** metallic gold gel pen, 0.3-0.4 mm, about `#c9a85c` (Sakura Gelly Roll Metallic Gold, or Uni-ball Signo Gold).
- **Layer 2 (towers):** opaque white gel pen, 0.3-0.4 mm, about `#f2efe6` (Sakura Gelly Roll Classic White / Uni-ball Signo Broad white).
- Low-tack masking tape, a float mount frame or a black mat-board backing.

## Process

1. Tape the card flat on the plotter bed with low-tack tape on all four edges. Mark the paper corners on the bed so the sheet can be removed and replaced.
2. Load the gold pen. Plot `artwork-layer-1-moon.svg` (about 1,500 paths). Gold is slower to dry on dark card: let it rest 30 minutes before touching.
3. Without moving the sheet, swap to the white pen and plot `artwork-layer-2-towers.svg` (about 7,300 paths). If the sheet must come off, re-seat it into the marked corners; the moon layer's reserved-paper halo (9 px / 2.2 mm around every roofline) tolerates about 1 mm misregistration.
4. Optional hand step: with the gold pen, go over the moon's terminator-side limb once more by hand for a slight edge glow. Do not touch the city.
5. Mount floating on black mat board in a deep shadow-box frame, no glass glare (use museum glass).

## Plot settings

- A3 portrait, margin 12 mm (48 px of 1188 x 1680 at 4 px/mm), pen width 0.3 mm (1.2 px), SVG written in mm (297 x 420).
- Two pen layers, one pen change. Plot time roughly 2-3 hours total.

## Reproduction

After `pnpm install && pnpm build`, from the repo root:

```sh
node concept-brainstorming/2026-10-09-0609/make.mjs
```

`make.mjs` (committed in this folder) is the scratch script: `generateCity` (style `towers`, seed 21, order 0.35, 9x5 blocks, lot 70, street 22, building height 330, downtown 0.8) shifted down 240 px, plus `generatePlanet` (moon, seed 11, radiusFrac 0.96, light -40 deg / 28 deg, 90 craters, hatch 5, 3 cross-hatch layers, stipple 0.4) centred at (594, 540), moon lines held off the city by 9 px with `holdOffLines`. It writes `artwork-layer-1-moon.svg` and `artwork-layer-2-towers.svg`. Note: it runs no `optimizePlot`; reorder in your plotter software if desired.

`preview.png` was made by colouring the two layers (`#c9a85c` over `#14161f`, `#f2efe6` on top) and rasterising with `scripts/svg-to-png.mjs --width 1400`.

## Wishes

- A city generator mode that returns a flat skyline silhouette or an oblique street view rather than only isometric blocks.
- A first-class `holdOff` option inside the planet generator (draw a planet "behind" another generator's lines) so the CLI could make this without a scratch script.
- Per-layer pen colours in the planet and city CLIs.
