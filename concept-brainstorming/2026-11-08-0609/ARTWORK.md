# Totality

## Artist statement

A black sky, a hundred and four white rays, and a hole where the sun should
be. The rays are a plain radial grating pushed by one hidden dome, so they
lean and bunch like corona streamers bent by a magnetic field the viewer
can't see; around the hole sits a thin gold engine-turned ring, the only
warm thing on the sheet — the diamond ring of the last second before the
moon takes over. Nothing is drawn *in* the middle. The black card itself is
the moon, so the darkest, heaviest object in the picture is made entirely
of material rather than line.

It survived the cull because it is the opposite of most of what the
generators do: after trying photo-to-ink renders (boots, cat — competent
but "filter"), op-art presets (vortex, relief, pinch), and one off-centre
corona with a distorted hole (striking, but the ring no longer sat on the
hole), the quietest version won. Two pens, two layers, one decision per
layer, and a lot of unmarked black.

## Materials

- **Paper:** black card, smooth, ≥ 300 gsm (e.g. Colorplan "Ebony" / Canson
  Mi-Teintes Touch black), cut to A3 (297 × 420 mm), portrait.
- **Layer 1 pen:** white/ivory gel pen, 0.5–0.8 mm nib (Sakura Gelly Roll
  Classic White, or Uni-ball Signo UM-153 White). Line colour on screen
  `#f2efe6`.
- **Layer 2 pen:** gold metallic paint marker / fine-liner, 0.3–0.5 mm
  (Pentel Gel Sunburst Metallic Gold, or Uni Posca PC-1MR gold). `#d9a441`.
- Low-tack masking tape; a scrap of the same card for pen tests; matte
  frame with 50 mm mount in black or off-white, float-mounted preferred.

## Process

1. Tape the black card flat to the plotter bed with low-tack tape on the
   outer 5 mm only (the plot starts 10 mm inside the edge). Mark the paper
   corner position on the bed so the sheet can be re-seated.
2. Test the white gel pen on the scrap: it must flow without skipping on a
   slow plotter feed. Shake/prime and plot a tiny line first.
3. Plot `artwork-layer-1.svg` (the 104 rays) with the white gel pen. Pen
   down pressure light; 0.8 mm effective line is ideal for visibility.
4. **Dry 24 hours, untouched** — gel white is slow to cure on card and the
   gold must not drag it.
5. Re-seat the sheet against the registration mark from step 1 (the
   layers share the same centre, so ≤ 1 mm error is invisible; the gold
   ring is meant to sit in the clear halo the rays leave).
6. Swap in the gold pen and plot `artwork-layer-2.svg` (the 9-ring
   rosette). Plot slowly; metallic markers skip if rushed.
7. Dry another 24 hours. Optional: touch up any skipped gold segments by
   hand with the same marker.
8. Do **not** fix, fill or outline the central black disc. Mount behind
   glass; the card must stay unmarked in the centre.

## Plot settings

- A3 portrait, 10 mm margin (defaults), pen width 0.3 mm in the SVG
  (the physical gel nib is thicker — rays are 5+ mm apart so nothing
  merges; the gold rosette is the dense part, keep that pen ≤ 0.4 mm).
- Layer 1: 104 strokes. Layer 2: 9 chained ring paths. Short plot, well
  under 30 minutes per pen with default optimisation.

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js warp-grid --preset blaze --paper a3 \
  --seed 3 --deformers 1 --kinds dome --scale 0.18 -o artwork-layer-1.svg
node packages/cli/dist/cli.js harmonograph --preset rosette --paper a3 \
  --seed 2 --scale 0.2 --rings 9 --waves 40 --wave-amp 0.55 \
  --inner-hole 0.62 --envelope bloom -o artwork-layer-2.svg
```

`preview.png` is the two layers stacked on `#0b0b10` with layer 1 recoloured
`#f2efe6` and layer 2 `#d9a441` (stroke colours replaced in the SVG text,
background rect added), rasterised with
`node scripts/svg-to-png.mjs preview.svg preview.png --width 1400`.

## Wishes

- A `--center` option for `warp-grid` rays and for `harmonograph` rosette,
  so a ring can be dropped onto the blaze's halo at any off-centre point.
- A built-in way to merge two generator outputs onto one sheet with
  per-layer colours (a CLI `stack` recipe exists, but not for these two).
