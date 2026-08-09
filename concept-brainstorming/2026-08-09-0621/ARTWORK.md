# Proof (CMY)

## Artist statement

This drawing contains no violet ink, no green ink, no red ink, and no
black ink. It contains exactly three: a cyan, a magenta, a yellow — each
plotted alone, as its own pass, as a single hatched field radiating from
its own point on the page. Every other colour you see — the indigo where
cyan and magenta cross, the leaf-green where cyan meets yellow, the red
where magenta meets yellow, the near-black core where all three land on
top of each other — never touched the page as ink. It is built entirely
from the eye fusing overlapping lines of pure colour, the same
subtractive arithmetic that has run every colour press since the
19th century, just slowed down from a hundred-thousand halftone dots a
second to five hundred hand-registered pen strokes.

I found this in the repo's `color-field` generator, which nobody had
driven from the CLI-adjacent scratch scripts before — the toolbox
describes it as a soft atmospheric gradient generator, built for
landscape-style ink washes. Run normally it makes exactly that: a wash.
But `color-field` doesn't actually simulate colour — it *places* one
ink's density at a time, as a real, physical, plottable line field, and
lets `mix-blend-mode: multiply` do the rest in preview. That is, by
accident of implementation, a working model of a printing press. Feeding
it one ink at a time, at the halftone industry's own century-old
screen angles — cyan at 15°, magenta at 75°, yellow at 0°, chosen
specifically so three independent line grids never coincide and produce
a genuine rosette instead of a muddy moiré — turns a gradient tool into
a diagram of how colour printing actually works, still legible as a
diagram, but drawn by a plotter arm instead of an offset cylinder.

What kept this candidate over the twenty-some others I threw out this
session (straight tonal washes, a radial sunset gradient, a woven-hatch
abstraction that just looked like fabric) is that it does two things at
once without one weakening the other: it reads immediately as a bold,
confident, poster-worthy image — three ragged ink-stained discs, hand
frayed at the edge like a brush loaded a little too wet — and it survives
a second, slower look as an argument about where colour comes from. The
four corner crosses are real print registration marks, the kind a
finishing guillotine trims away before a proof ever leaves the shop
floor. I left them in on purpose. A proof that hides its own registration
marks is pretending to be a finished product; this is not that. It is
the test sheet, kept.

## Materials

- **Paper**: A3 (297 × 420 mm), hot-press white or a warm off-white
  (e.g. Fabriano Artistico 300gsm HP, or any smooth 200–300gsm stock —
  smooth so three registered passes of fine line stay crisp; avoid cold-
  press/rough, which will scatter a 0.3mm nib). A faint warm-white ground
  (not stark white) keeps the black overlap reading as ink, not a hole.
- **Inks** (four fine technical-pen passes, same physical sheet,
  re-clamped between passes — see Process):
  - **Registration** — pale warm grey, e.g. **Dr. Ph. Martin's Bombay
    India Ink — Neutral Grey** (~`#8f867a`), 0.2mm technical pen (Rotring
    Isograph or similar refillable nib). Faint on purpose; documentary,
    not decorative.
  - **Cyan** — translucent dye-based drawing ink, e.g. **Dr. Ph. Martin's
    Bombay India Ink — Turquoise** (~`#0098b3`), 0.3mm nib.
  - **Magenta** — e.g. **Dr. Ph. Martin's Bombay India Ink — Fuchsia**
    (~`#e2007a`), 0.3mm nib.
  - **Yellow** — e.g. **Dr. Ph. Martin's Bombay India Ink — Sunshine
    Yellow** (~`#f3c000`), 0.3mm nib.
  - Bombay inks are dye-based and genuinely translucent (they're sold
    for exactly this kind of layered/overprint work), so the physical
    overlaps subtractively mix the way the multiply-blended preview
    shows — this is not just a screen approximation. If the plotter's
    pen holder only takes fixed-width fineliners, any translucent
    alcohol- or dye-based 0.3mm marker (Copic Multiliner, Tombow
    Fudenosuke in a brush-pen adapter) will overprint similarly; avoid
    pigment-based archival inks (Micron, Sakura Pigma) here — they're
    opaque and won't let the under-colour show through.
- Low-tack tape or a printer's register jig (pin bar / corner stops) to
  hold the sheet in an identical position across all four passes —
  the registration crosses only do their job if the sheet doesn't shift.

## Process

1. Load the grey pen. Plot `artwork-registration.svg`. This lays four
   small crosses near the corners — nothing else. Do not remove the
   sheet from the plotter bed; mark the bed or jig position so the sheet
   can be re-seated identically for the next three passes (or simply
   leave it clamped and only swap pens, if the plotter's pen-change is
   automatic).
2. Swap to the cyan pen. Plot `artwork-cyan.svg` on the same sheet, same
   position. This is a ~245mm-diameter hatched disc, upper-left of centre,
   lines running at 15° off vertical.
3. Swap to the magenta pen. Plot `artwork-magenta.svg`. A second disc,
   upper-right of centre, overlapping the cyan disc's right side; lines
   at 75°.
4. Swap to the yellow pen. Plot `artwork-yellow.svg`. A third disc, lower
   centre, overlapping both of the above along its top edge; lines at 0°
   (vertical).
5. Let the final pass dry fully before handling (Bombay inks are fast but
   give it 10–15 minutes) — the wet-ink overlaps are where the piece
   actually happens, so don't blot or press them.
6. Float-mount or simply frame under glass with a generous white mat —
   the piece wants room, not a tight crop; the paper margin around the
   proof is part of the composition.

If re-registration between passes isn't reliable on the plotter in use,
plot all four SVGs into one job in the order above without lifting the
sheet at all (same clamped bed position throughout, pens changed on the
plotter's own carriage) — this is the safer route and what the
reproduction script below assumes no reordering of.

## Plot settings

- Paper: A3, portrait, 297 × 420mm.
- Margin: 18mm.
- Pen width: 0.3mm for the three ink passes, ~0.2mm for the registration
  pass (deliberately finer/fainter).
- Four passes, one pen each, same sheet, in the order: registration →
  cyan → magenta → yellow.
- Total pen-up travel across all four passes: ≈5.1 m (535–552 lines per
  ink disc, 24 short strokes for the registration crosses).

## Reproduction

Same three seeds, focal points and 15°/75°/0° screen angles produce this
exact drawing byte-for-byte.

```sh
pnpm install && pnpm build
node proof.mjs concept-brainstorming/2026-08-09-0621
```

```js
// proof.mjs — "Proof (CMY)": three radial ink fields (cyan, magenta, yellow),
// each a single-ink colour-field pass at a classic halftone screen angle
// (15°/75°/0°), registered on one A3 sheet so their overlaps mix optically
// and subtractively into violet, green, red and near-black — plus four
// corner registration crosses on their own pass. Run from the repo root
// after `pnpm build`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const {
  generateColorField,
  toSVG,
  accentLayerName,
  getPaperSize,
  pageMetrics,
  BASE_PX_PER_MM,
  orderPlot,
  measurePenTravel,
} = await import(coreDist);

const paper = getPaperSize('a3');
const metrics = pageMetrics(paper, 'portrait', BASE_PX_PER_MM); // 891 x 1260 px, 297 x 420 mm
const { widthPx: W, heightPx: H } = metrics;
const marginPx = 18 * metrics.pxPerMm; // 18mm

const FOCALS = { cyan: [0.35, 0.34], magenta: [0.65, 0.34], yellow: [0.5, 0.6] };
const ANGLES = { cyan: 15, magenta: 75, yellow: 0 }; // classic C/M/Y halftone screen angles
const SEEDS = { cyan: 1511, magenta: 1523, yellow: 1537 };

function inkCircle(name, seed) {
  const [focalXPct, focalYPct] = FOCALS[name];
  const res = generateColorField({
    width: W,
    height: H,
    margin: marginPx,
    inkCount: 2, // 2nd ink is a discarded outer ring; keeping only band-00 below
    gradientMode: 'radial',
    focalXPct,
    focalYPct,
    gradientRadiusPct: 0.66,
    blend: 0.55,
    spacingPx: 1.3 * metrics.scale,
    angleDeg: ANGLES[name],
    fill: 0.96,
    jitterPx: 0.15 * metrics.scale,
    wobbleAmpPx: 1.7 * metrics.scale,
    wobbleWavelengthPx: 45 * metrics.scale,
    minSegmentLengthPx: 0.8 * metrics.scale,
    penWidthPx: 1.0 * metrics.scale,
    seed,
    optimize: true,
  });
  const kept = res.lines.filter((l) => l.layer === 'band-00').map((l) => ({ ...l, layer: name }));
  return { lines: kept, width: W, height: H };
}

function regCross(posAcrossPct, posAlongPct, size, thick) {
  return [
    { type: 'bar', orientation: 'vertical', posPct: posAcrossPct, startPct: posAlongPct - size / 2, lenPct: size, thicknessPx: thick, taper: false, layerIndex: 0 },
    { type: 'bar', orientation: 'horizontal', posPct: posAlongPct, startPct: posAcrossPct - size / 2, lenPct: size, thicknessPx: thick, taper: false, layerIndex: 0 },
  ];
}

function registrationMarks() {
  const size = 0.018;
  const thick = 1.1 * metrics.scale;
  const res = generateColorField({
    width: W,
    height: H,
    margin: marginPx,
    inkCount: 1,
    spacingPx: 99999, // no field strokes — accents only
    penWidthPx: 0.8 * metrics.scale,
    seed: 1,
    accents: [
      ...regCross(0.025, 0.018, size, thick),
      ...regCross(0.975, 0.018, size, thick),
      ...regCross(0.025, 0.982, size, thick),
      ...regCross(0.975, 0.982, size, thick),
    ],
  });
  const kept = res.lines.filter((l) => l.layer === accentLayerName(0)).map((l) => ({ ...l, layer: 'registration' }));
  return { lines: kept, width: W, height: H };
}

const layers = {
  registration: registrationMarks(),
  cyan: inkCircle('cyan', SEEDS.cyan),
  magenta: inkCircle('magenta', SEEDS.magenta),
  yellow: inkCircle('yellow', SEEDS.yellow),
};
for (const key of Object.keys(layers)) layers[key] = orderPlot(layers[key]);

const physicalWidth = `${paper.widthMm}mm`;
const physicalHeight = `${paper.heightMm}mm`;
const fileFor = {
  registration: 'artwork-registration.svg',
  cyan: 'artwork-cyan.svg',
  magenta: 'artwork-magenta.svg',
  yellow: 'artwork-yellow.svg',
};

let totalTravelMm = 0;
for (const [key, result] of Object.entries(layers)) {
  writeFileSync(join(outDir, fileFor[key]), toSVG(result, { physicalWidth, physicalHeight }));
  totalTravelMm += measurePenTravel(result) / metrics.pxPerMm;
  console.log(`${key}: ${result.lines.length} lines -> ${fileFor[key]}`);
}
console.log(`total pen-up travel across 4 passes: ~${Math.round(totalTravelMm)} mm`);

// Combined multiply-blend preview (not a plot file — used to render preview.png).
const combined = {
  lines: [...layers.cyan.lines, ...layers.magenta.lines, ...layers.yellow.lines, ...layers.registration.lines],
  width: W,
  height: H,
};
writeFileSync(
  join(outDir, 'preview-combined.svg'),
  toSVG(combined, {
    strokeWidth: 1.0 * metrics.scale,
    includeBackground: true,
    backgroundColor: '#f7f2e7',
    physicalWidth,
    physicalHeight,
    layerColors: { cyan: '#0098b3', magenta: '#e2007a', yellow: '#f3c000', registration: '#8f867a' },
    layerBlend: { cyan: 'multiply', magenta: 'multiply', yellow: 'multiply' },
  })
);
```

Then rasterize the preview:

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-08-09-0621/preview-combined.svg \
  concept-brainstorming/2026-08-09-0621/preview.png --width 1600
```

(`preview-combined.svg` is a working file for the raster preview only —
it is not one of the four plotted layers and isn't part of this folder's
committed deliverables.)

## Wishes

- `generateColorField` has no first-class way to render a *single* ink as
  a soft-edged radial disc (`inkCount: 1` centres its weight bump at
  `t = 0.5`, not at the focal point). The `inkCount: 2` + narrow `blend`
  + discard-the-second-band trick used here works but is a workaround —
  a `radialFalloff` or `single-ink radial` mode that fades density from
  1 at the focal point to 0 at `gradientRadiusPct` directly would make
  this a one-line call instead of a filter-and-relabel step, and would
  let a future piece combine more than three independently-shaped ink
  fields without the trick compounding.
