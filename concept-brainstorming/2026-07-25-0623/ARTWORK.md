# LATENT

## Artist statement

In 1892 Francis Galton published *Finger Prints*, the book that gave
forensic science its founding taxonomy: every human ridge pattern sorted
into one of three families — arch, loop, whorl — a system so durable it
still organises ten-print cards in police stations today. Galton's whole
argument rested on a paradox he stated outright: the pattern *type* is a
banal, repeatable category (a small alphabet, shared by billions of
fingers) while the pattern *itself* is supposedly unrepeatable, unique to
one hand, the strongest proof of individual identity we have. A
classification system for pointing at the thing that resists
classification.

This piece takes his three categories and manufactures them from nothing.
`warp-grid` is an op-art generator built for a different purpose entirely —
a flat ruled grating pushed by hidden domes, ridges and vortices into
Bridget Riley's *Blaze* and *Current* — but the same hidden-relief math
that makes a grid read as a bulging volume also makes it read, at the
right radius and strength, as a ridge pattern. A single dome deformer
over parallel lines crests into a textbook arch. A vortex twisted into a
line field hooks into a loop. A lens pinch on a ring of concentric
circles pulls into a whorl, spiral core and all — the fine ridge breaks
near its edge, which I did not ask for and did not remove, are the
deformer's own compression floor lifting the pen exactly where two rings
crowd too close together, which is also, description for description,
what a bifurcation is in a real print. No finger touched this page. Every
seed left a pattern that will never repeat, and every pattern is
generic — Galton's paradox rebuilt from a page of TypeScript that has
never heard of him.

Of roughly thirty seeds run per pattern type, these three survived
because each sits convincingly on its own page, centred, without the
deformer wandering into a corner and reading as a shear instead of a
form: seed 42 crests as one clean, symmetrical dome; seed 67 hooks a
single unambiguous loop just left of centre; seed 34 spirals to a real
core with a companion delta-like bend at its shoulder, the two features
a fingerprint examiner actually looks for. They are titled plainly —
`ARCH`, `LOOP`, `WHORL` — set in the repo's own single-stroke engraving
font, because the piece's whole joke depends on looking exactly as
clinical as a real specimen card.

## Materials

- **Paper:** Fabriano Artistico Extra White, Hot Press (smooth), 300gsm,
  one A3 sheet (420 × 297mm). Hot press is essential, not a preference —
  the panels hold ~180 parallel lines across 116mm (a pitch under 1mm,
  compressing tighter still at each deformer's core), and any cold-press
  tooth would catch the pen and blot adjacent ridges into each other.
- **Ink/pen:** one pen, one width, the entire sheet — Rotring Isograph
  technical pen, 0.13mm nib, loaded with black India ink (`#0a0a0a`).
  0.13mm is a deliberate choice, not the repo's 0.3mm default: it's the
  finest common technical nib, and it's still only just narrow enough to
  keep the tightest ridge compressions from filling in solid.
- **Mounting:** acid-free museum board, float mount (the paper's own
  generous margin already reads as a mat — a window mat would double it
  up), simple black timber frame, UV-filtering glazing.

## Process

1. Build the repo (`pnpm install && pnpm build`) and run the reproduction
   script below to generate `artwork.svg` — one A3 sheet, three framed
   panels, title, and captions, all on a single pen layer.
2. Tape the A3 Fabriano Artistico Extra White HP sheet to the plotter
   bed, landscape orientation, registered square to the bed's home
   corner.
3. Fit the plotter with the 0.13mm Isograph loaded with black India ink.
4. Plot `artwork.svg` in one unattended pass — single pen, no swaps, no
   registration required (there is only one layer).
5. Optional, by hand, once the ink is fully dry (India ink on hot-press
   stock: at least 30 minutes): in soft pencil, sign and number the
   edition in the wide lower margin below `PRINTS OF NO ONE`, in the
   convention of an intaglio proof. The plotted content is complete
   without this step; it's a hand-finishing option, not a dependency.
6. Float-mount and frame as described above.

## Plot settings

- Paper: A3, landscape, 420 × 297mm
- Sheet margin: 20mm outer border (baked into the layout, not a CLI
  `--margin-mm` pass)
- Pen width: 0.13mm
- Panels: three 116 × 116mm squares, 16mm gutters, each ruled with a
  single-stroke frame
- Effective density: 5px/mm (2100 × 1485 viewBox)
- Estimated pen-down travel: ~48m of ink; pen-up travel: ~2m (522
  strokes total, already nearest-neighbour ordered by `optimizePlot`) —
  a short, single-session plot
- Single pen layer throughout (`layer: 'print'`) — nothing to split

## Reproduction

Deterministic from three integer seeds — one per panel (`42` arch,
`67` loop, `34` whorl) — plus fixed layout constants. There is no CLI
command for compositing three `warp-grid` panels onto one sheet with
plotted captions, so this calls the core `generateWarpGrid`, `toSVG`,
`optimizePlot`, and the internal `stroke-font` module directly. Build
the repo, save this as `latent.mjs` **in the repo root** (it imports
`packages/core/dist` by relative-from-root path), then run:

```sh
pnpm install && pnpm build
node latent.mjs artwork.svg
```

```js
// latent.mjs — LATENT: arch / loop / whorl warp-grid triptych on one A3 sheet.
import { writeFileSync } from 'node:fs';
const { generateWarpGrid, toSVG, optimizePlot } = await import(
  './packages/core/dist/index.js'
);
const { textToStrokes, textWidth } = await import(
  './packages/core/dist/stroke-font.js'
);

const OUTFILE = process.argv[2] ?? 'artwork.svg';

const PXPMM = 5;
const SHEET_W_MM = 420;
const SHEET_H_MM = 297;
const PANEL_MM = 116;
const OUTER_MM = 20;
const GUTTER_MM = 16;
const PANEL_PX = PANEL_MM * PXPMM; // 580

const panelX = [
  OUTER_MM,
  OUTER_MM + PANEL_MM + GUTTER_MM,
  OUTER_MM + 2 * (PANEL_MM + GUTTER_MM),
];
const PANEL_TOP_MM = 62;
const PANEL_BOTTOM_MM = PANEL_TOP_MM + PANEL_MM;

const PANELS = [
  {
    name: 'ARCH',
    x: panelX[0],
    config: {
      width: PANEL_PX, height: PANEL_PX, margin: 0, seed: 42,
      basePattern: 'lines', angle: 0, kinds: ['dome'], deformers: 1,
      strength: 0.85, relief: 0.5, scale: 0.35, spacing: 4.5, edgeCalm: 0.3,
    },
  },
  {
    name: 'LOOP',
    x: panelX[1],
    config: {
      width: PANEL_PX, height: PANEL_PX, margin: 0, seed: 67,
      basePattern: 'lines', angle: 90, kinds: ['vortex'], deformers: 1,
      strength: 1, relief: 0.3, scale: 0.42, spacing: 4.5, edgeCalm: 0,
    },
  },
  {
    name: 'WHORL',
    x: panelX[2],
    config: {
      width: PANEL_PX, height: PANEL_PX, margin: 0, seed: 34,
      basePattern: 'circles', kinds: ['lens', 'vortex'], deformers: 1,
      strength: 0.95, relief: 0.55, scale: 0.4, spacing: 4.5, edgeCalm: 0.15,
    },
  },
];

const allLines = [];

for (const panel of PANELS) {
  const res = generateWarpGrid({ ...panel.config, optimize: false });
  const offX = panel.x * PXPMM;
  const offY = PANEL_TOP_MM * PXPMM;
  for (const line of res.lines) {
    allLines.push({
      ...line,
      layer: 'print',
      points: line.points.map((p) => ({ x: p.x + offX, y: p.y + offY })),
    });
  }
}

// Title
const TITLE = 'LATENT';
const TITLE_SIZE_MM = 14;
const titleWidthMm = textWidth(TITLE, TITLE_SIZE_MM);
const titleX = (SHEET_W_MM / 2 - titleWidthMm / 2) * PXPMM;
const titleY = 26 * PXPMM;
for (const stroke of textToStrokes(TITLE, titleX, titleY, TITLE_SIZE_MM * PXPMM)) {
  allLines.push({ points: stroke, layer: 'print' });
}

// Thin single-stroke frame around each panel
PANELS.forEach((panel) => {
  const x0 = panel.x * PXPMM;
  const y0 = PANEL_TOP_MM * PXPMM;
  const x1 = (panel.x + PANEL_MM) * PXPMM;
  const y1 = PANEL_BOTTOM_MM * PXPMM;
  allLines.push({
    layer: 'print',
    points: [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 },
      { x: x0, y: y1 }, { x: x0, y: y0 },
    ],
  });
});

// Captions, centered under each panel
const CAPTION_SIZE_MM = 6.5;
const CAPTION_TOP_MM = PANEL_BOTTOM_MM + 14;
PANELS.forEach((panel) => {
  const w = textWidth(panel.name, CAPTION_SIZE_MM);
  const cx = panel.x + PANEL_MM / 2;
  const x = (cx - w / 2) * PXPMM;
  const y = CAPTION_TOP_MM * PXPMM;
  for (const stroke of textToStrokes(panel.name, x, y, CAPTION_SIZE_MM * PXPMM)) {
    allLines.push({ points: stroke, layer: 'print' });
  }
});

// Bottom anchor line — a small plotted subtitle, low in the signature margin
const SUBTITLE = 'PRINTS OF NO ONE';
const SUBTITLE_SIZE_MM = 5.5;
const subtitleWidthMm = textWidth(SUBTITLE, SUBTITLE_SIZE_MM);
const subtitleX = (SHEET_W_MM / 2 - subtitleWidthMm / 2) * PXPMM;
const subtitleY = 246 * PXPMM;
for (const stroke of textToStrokes(SUBTITLE, subtitleX, subtitleY, SUBTITLE_SIZE_MM * PXPMM)) {
  allLines.push({ points: stroke, layer: 'print' });
}

const combined = {
  lines: allLines,
  width: SHEET_W_MM * PXPMM,
  height: SHEET_H_MM * PXPMM,
  seed: 424267034,
};

const optimized = optimizePlot(combined);

const PEN_WIDTH_MM = 0.13;
const svg = toSVG(optimized, {
  strokeWidth: PEN_WIDTH_MM * PXPMM,
  strokeColor: '#0a0a0a',
  physicalWidth: `${SHEET_W_MM}mm`,
  physicalHeight: `${SHEET_H_MM}mm`,
});

writeFileSync(OUTFILE, svg);
console.log(`wrote ${OUTFILE}`);
```

`preview.png` was rendered with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png --width 2000 \
  --background '#fdfcf6' --stroke '#0f0f0f'
```
approximating Fabriano Artistico Extra White under black India ink.

## Wishes

- `generateWarpGrid`'s deformer placement is rejection-sampled uniformly
  across the canvas, so finding a centred, single-form composition means
  re-rolling the seed and eyeballing the result — there's no way to bias
  placement toward the centre or hand-place a deformer directly. A
  `centerBias` option (or an explicit `{ cx, cy }` override per
  deformer) would have turned this session's seed sweep into a couple of
  direct calls.
- No CLI command exists for `warp-grid` multi-panel composition or for
  mixing generator output with `stroke-font` captions — both had to go
  through a scratch script calling core directly. A `--caption` flag (or
  a general "plot this text at this position" CLI utility) would help
  any future plate/specimen-card piece, not just this one.
