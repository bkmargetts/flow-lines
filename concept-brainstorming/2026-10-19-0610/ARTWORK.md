# Counter-Current

## Statement

One drawing, plotted twice. A single warp-grid current — a field of flat horizontal lines bent by hidden vortex forms — is drawn in indigo, then the same file is turned through 180° and drawn again in vermilion. Where the two currents agree the lines lie together and the colours fuse to a dark brown-violet; where they disagree they slip apart into interleaved blue and red threads that read as a slow, braided flow around two eddies, one rising, one sinking, each the other's reflection. It survived the cull because the effect is made entirely by the *physical act* — rotate the sheet, change the pen — and it holds up at a glance and up close. Alternatives (misregistered mirror copies, other presets and seeds) were flatter: vortex seed 7 rotated 180° was the one where the two eddies interlock instead of merely overlapping.

## Materials

- Paper: A3 (297×420 mm) smooth hot-press cotton or cream drawing paper, 200–300 gsm, warm off-white (approx. #efe9dc).
- Pen 1: 0.35 mm fineliner/pigment liner, deep indigo (≈ #1b2a6b), e.g. a Navy/Prussian blue pigment liner.
- Pen 2: 0.35 mm fineliner, vermilion (≈ #b3401c), burnt orange-red pigment ink.
- Both inks must be waterproof/pigment-based so the second pass doesn't bleed.
- Low-tack tape (4 corner tabs) and a printed registration L-frame on the plotter bed; mount: float mount in a pale oak frame.

## Process

1. Tape the sheet to the plotter bed against a fixed corner stop so it can be removed and re-seated accurately; pencil-mark the sheet's top-left corner on the back.
2. Load the indigo pen. Plot `artwork-layer-1.svg` (A3 portrait, 10 mm margin). Let dry 10 min.
3. Remove the sheet, rotate it 180° (top-left becomes bottom-right), and re-seat it against the same corner stop. Because the artwork is centred on the sheet and the stop is a fixed reference, the two passes register point-symmetrically. (Alternatively leave the sheet and plot `artwork-layer-2.svg`, which is the same drawing pre-rotated 180° about the sheet centre.)
4. Load the vermilion pen and plot `artwork-layer-2.svg`. Skip the rotation if using the pre-rotated file; with the pre-rotated file, do NOT rotate the sheet.
5. Erase any pencil marks, press under weights overnight, float-mount.

Slight (≤0.5 mm) misregistration is welcome — it adds a hairline halo where the two inks overlap.

## Plot settings

A3 portrait, 10 mm margin, pen width 0.35 mm, two single-pen layers, 79 paths per layer (long continuous strokes, very little pen travel).

## Reproduction

```sh
pnpm install && pnpm build
node packages/cli/dist/cli.js warp-grid --paper a3 --preset vortex --seed 7 --pen-width-mm 0.35 -o artwork-layer-1.svg
python3 - <<'PY'
t=open('artwork-layer-1.svg').read()
i=t.index('<path')
open('artwork-layer-2.svg','w').write(t[:i]+'<g transform="rotate(180 445.5 630)">'+t[i:].replace('</svg>','</g></svg>'))
PY
```

`preview.png`: layer 1 recoloured `#1b2a6b`, layer 2 `#b3401c`, merged into one SVG, then `node scripts/svg-to-png.mjs merged.svg preview.png --width 1600 --background '#efe9dc'`.

## Wishes

- A `--rotate`/`--flip` flag (or `stack` recipe support for warp-grid) so the second pass could be emitted by the CLI without a post-process.
