# The Arctic Circle

## Artist statement

In 1998, Jockusch, Propp and Shor proved something almost embarrassing to
say out loud: sample a domino tiling of an Aztec diamond *uniformly at
random* — no bias, no aesthetic intent, a fair coin flipped wherever the
sampler needs one — and as the diamond grows, the tiling doesn't stay
random everywhere. Four corners freeze solid into brick-regular order.
The middle stays chaotic. And the boundary between the two, drawn from
nothing but coin flips, converges to a perfect circle — the exact circle
inscribed in the diamond, touching all four edges. Nobody's algorithm
mentions a circle. It falls out anyway, the same way it falls out of
nowhere every winter over the pole: theorists reached for the same word
sea-ice cartographers already used for the ragged edge between pack ice
and open water, because the shape is the same shape.

This piece takes that coincidence at face value and draws it twice. The
first pass is the tiling itself: one of the four domino classes, inked
only where it appears, welded into long unbroken rules wherever three
neighbours of hundreds packed the same way (that's the frozen corner —
solid "pack ice," page-length ridges pressed edge to edge) and left as
short isolated dashes wherever the tiling had a real choice to make
(that's the "open water," broken floes thinning to nothing far from the
edge). Nothing about that pass knows what a circle is. It is combinatorics,
full stop — `packages/core/src/arctic`, exact domino shuffling
(Elkies–Kuperberg–Larsen–Propp), no image, no noise field, no hand-tuned
falloff.

The second pass is a plain dashed circle, plotted from one formula
(centre of the diamond, radius = order/√2) and never shown the tiling's
own coordinates. It's the reference contour a sea-ice chart draws for a
historical median extent, laid over this winter's actual edge to show
how far reality has drifted from the average. Here it's laid over a
mathematical proof instead of a satellite pass, and — because the proof
is true — it doesn't drift. Two completely independent processes,
plotted in two different inks, land on the same line. That agreement is
the whole piece; every dash of black ink is 200-odd domino classes
picking a direction with a fair coin, and the red line never once looked
at what they picked.

Twenty-plus renders went into the bin before this one: full diamonds
inked with all four classes read as dense, even weave — technically
correct, but the tone drowns the theorem in crosshatch, and the circle
never gets to be the one surprising thing on the page. Inking a single
class and cropping to where that class actually appears (rather than
forcing the whole diamond into frame) is what let the "aha" — that
raggedy boundary of accumulated coin-flips *is* a circle — arrive on
its own, with a full page of clean paper standing in for the water.

## Materials

- **Paper:** Fabriano Artistico Extra White, cold-press, 300gsm cotton
  rag, A3 portrait (297×420mm). A cool, bright white — this is meant to
  read as ice and paper at once, not toned or warm.
- **Ink 1 — pack ice / floes (the tiling):** a cool near-black archival
  pigment liner, 0.3mm nib (e.g. Staedtler pigment liner 0.3, or Sakura
  Pigma Micron 03) — hex reference `#14181c`. Waterproof once dry.
- **Ink 2 — reference contour (the theorem's circle):** a warm
  burnt-orange/vermilion archival pigment liner, 0.2mm nib — hex
  reference `#b5451d`. The colour is a deliberate echo of the convention
  sea-ice agencies use for a historical-median extent line drawn over a
  current chart: warm line, cold data.
- Nothing else — no wash, no mask. The piece is two plotted passes and
  the paper's own white.

## Process

1. Load the sheet on the plotter, A3 portrait, registered to the
   machine's usual home corner. Fit **Ink 1** (black, 0.3mm).
2. Plot `artwork-layer-1-black.svg` — the tiling (frozen ridge lines,
   dissolving to broken floes) and the small caption block in the foot
   margin. This is the whole drawing except the reference line; let it
   dry ~2 minutes (fast-drying pigment ink).
3. Without moving the paper, swap to **Ink 2** (vermilion, 0.2mm).
4. Plot `artwork-layer-2-vermilion.svg` — the dashed reference circle.
   Because both files share the exact same page coordinate system, this
   lands in registration automatically; no manual alignment step.
5. Let the second pass cure fully (~10 minutes) before handling.
6. Float-mount on white board under glass, generous mat — the piece
   already keeps most of its own sheet as bare paper, so the mount
   should extend that quiet, not fight it.

`artwork.svg` is a combined reference render (both inks merged into one
file) for previewing or for a single-pass proof print; the physical piece
is the two-file, two-ink version above.

## Plot settings

- Paper: A3, portrait, 297×420mm, 30mm margin.
- Pen 1 (tiling + caption): 0.3mm nib, ~0.28mm drawn line width.
- Pen 2 (reference circle): 0.2mm nib, ~0.22mm drawn line width.
- Hand-drawn wobble: amplitude 0.3px on the tiling only — the reference
  circle and caption plot perfectly straight/geometric, so the contrast
  between "drawn by hand" and "drawn from a formula" is visible on the
  page itself.
- Estimated pen-down travel: ~14.5m (almost entirely Ink 1 — several
  thousand short welded/dashed segments); Ink 2 is a single ~1.1m dashed
  loop.
- Deterministic: Aztec diamond order 200, seed 7. `pnpm test`'s own
  golden-hash harness doesn't cover this file (it's a scratch
  composition script, not a package export), but the tiling sampler
  (`shuffleAztec`) and the render pipeline (`applyHandDrawnStyle`,
  `orderPlot`) are exactly the tested library functions — re-running the
  script below reproduces this file byte-for-byte (verified).

## Reproduction

Requires the repo built once (`pnpm install && pnpm build`, which
produces `packages/core/dist/`). Save as `ice-plate.mjs` and run
`node ice-plate.mjs <outDir> --order 260 --seed 7`:

```js
// ice-plate.mjs — "The Arctic Circle"
//
// One frozen corner of a uniformly random Aztec-diamond domino tiling (the
// arctic-circle theorem's "pack ice"), dissolving through its own boundary
// into scattered broken dashes ("floes") on the open paper — plus a second,
// dashed pen pass tracing the theorem's PREDICTED circle (radius n/sqrt(2),
// centred on the diamond), drawn from the formula alone, never from the
// tiling's own points. The two coincide by proof, not by fitting.
//
// Usage: node ice-plate.mjs <outDir> --order 260 --seed 7 [--width 297]
//   [--height 420] [--margin 30] [--wobble 0.3]
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  shuffleAztec,
  applyHandDrawnStyle,
  orderPlot,
  toSVG,
  toSVGLayers,
  BASE_PX_PER_MM,
  measurePenTravel,
} from '@flow-lines/core/dist/index.js';
import { spineMarks } from '@flow-lines/core/dist/arctic/marks.js';
import { textToStrokes } from '@flow-lines/core/dist/stroke-font.js';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

const INK_BLACK = '#14181c';
const INK_VERMILION = '#b5451d';

export function renderIcePlate(opts) {
  const {
    order = 260,
    seed = 7,
    widthMm = 297,
    heightMm = 420,
    marginMm = 30,
    wobble = 0.3,
  } = opts;

  const px = BASE_PX_PER_MM;
  const width = widthMm * px;
  const height = heightMm * px;
  const margin = marginMm * px;

  const dominoes = shuffleAztec(order, seed);
  const rot = Math.PI / 4; // upright: the inked corner lands on a page edge
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rotate = (p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });

  const raw = spineMarks(dominoes, order, ['N'], 1).map((r) => r.points.map(rotate));

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pts of raw) {
    for (const p of pts) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
  }
  const spanX = Math.max(1e-6, x1 - x0);
  const spanY = Math.max(1e-6, y1 - y0);
  const boxW = Math.max(1, width - 2 * margin);
  const boxH = Math.max(1, height - 2 * margin);
  const k = Math.min(boxW / spanX, boxH / spanY);
  const offX = (width - spanX * k) / 2;
  const offY = (height - spanY * k) / 2;
  const place = (p) => ({ x: (p.x - x0) * k + offX, y: (p.y - y0) * k + offY });

  const lines = raw.map((pts) => ({ points: pts.map(place), layer: 'black' }));

  // The theorem's inscribed circle — computed from the formula alone (diamond
  // {|x+0.5|+|y+0.5| <= order} is centred at (-0.5,-0.5); the circle touching
  // all four edges has radius order/sqrt(2)) — in the SAME lattice frame as
  // the tiling, so it lands on the page without ever consulting the dominoes.
  const cx = -0.5, cy = -0.5;
  const R = order / Math.SQRT2;
  const N = 720;
  const dashDeg = 5.5, gapDeg = 4.5;
  let seg = [];
  for (let i = 0; i <= N; i++) {
    const deg = (i / N) * 360;
    const on = deg % (dashDeg + gapDeg) < dashDeg;
    const a = (deg * Math.PI) / 180;
    const p = place(rotate({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }));
    if (on) seg.push(p);
    else if (seg.length > 1) {
      lines.push({ points: seg, layer: 'guide' });
      seg = [];
    } else seg = [];
  }
  if (seg.length > 1) lines.push({ points: seg, layer: 'guide' });

  // Caption, tucked in the generous foot margin the centred content leaves.
  const capSize = 3.4 * px;
  const quoteSize = capSize * 0.62;
  const capY = height - marginMm * 0.62 * px;
  const title = 'THE ARCTIC CIRCLE';
  const sub = `AZTEC DIAMOND, ORDER ${order}, SEED ${seed}`;
  const quote = 'NOTHING IN THE ALGORITHM MENTIONS A CIRCLE';
  for (const s of textToStrokes(title, margin, capY - capSize * 2.7, capSize)) {
    lines.push({ points: s, layer: 'caption' });
  }
  for (const s of textToStrokes(sub, margin, capY - capSize * 1.05, quoteSize)) {
    lines.push({ points: s, layer: 'caption' });
  }
  for (const s of textToStrokes(quote, margin, capY, quoteSize)) {
    lines.push({ points: s, layer: 'caption' });
  }

  let result = { lines, width, height, seed };
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: 90,
    jitter: wobble * 0.3,
    seed,
    layerAmplitude: { guide: 0, caption: 0 },
  });
  for (const l of result.lines) if (l.layer === 'caption') l.layer = 'black';
  result = orderPlot(result);
  return { result, width, height, widthMm, heightMm };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args._[0] || '.';
  mkdirSync(outDir, { recursive: true });
  const { result, widthMm: wmm, heightMm: hmm } = renderIcePlate({
    order: Number(args.order ?? 260),
    seed: Number(args.seed ?? 7),
    widthMm: Number(args.width ?? 297),
    heightMm: Number(args.height ?? 420),
    marginMm: Number(args.margin ?? 30),
    wobble: Number(args.wobble ?? 0.3),
  });

  const svgOpts = {
    strokeWidth: 0.85,
    layerColors: { black: INK_BLACK, guide: INK_VERMILION },
    layerWidths: { black: 0.85, guide: 0.66 },
    includeBackground: true,
    backgroundColor: '#fefdfb',
    physicalWidth: `${wmm}mm`,
    physicalHeight: `${hmm}mm`,
  };

  writeFileSync(`${outDir}/artwork.svg`, toSVG(result, svgOpts));
  for (const { layer, svg } of toSVGLayers(result, svgOpts)) {
    const name = layer === 'black' ? 'artwork-layer-1-black' : 'artwork-layer-2-vermilion';
    writeFileSync(`${outDir}/${name}.svg`, svg);
  }
  const travelMm = measurePenTravel(result) / BASE_PX_PER_MM;
  console.log('wrote', outDir, 'lines:', result.lines.length, 'pen travel (mm):', Math.round(travelMm));
}
```

(`@flow-lines/core/dist/...` — run from the repo root after `pnpm build`,
with the import specifiers resolved to the built package, e.g.
`packages/core/dist/arctic/marks.js`. Verified byte-identical to the
committed SVGs.)

Then rasterize the preview with the repo's own tool (materials are
already baked into the SVG's colours, so no recolour flags are needed):

```sh
node scripts/svg-to-png.mjs concept-brainstorming/2026-09-25-0622/artwork.svg \
  concept-brainstorming/2026-09-25-0622/preview.png --width 1600
```

## Wishes

- `generateArctic`'s built-in page-fit (used by the `dissolve`/`weave`
  presets) is bounded by whichever marks are actually inked, which is
  exactly the "crop to where the interesting class lives" behaviour this
  piece wants — but there's no supported way to get a *second*,
  independently-computed layer (like this piece's analytic reference
  circle) registered into that same fit without reimplementing the fit
  by hand, since the transform isn't returned or exposed. A
  `fitArcticFrame(dominoes, order, {width,height,margin,marks,upright})`
  helper returning `{ place, rotate }` would let a composition add
  reference geometry (circles, radii, the diamond's own outline as a
  ghost) in exact registration without copying the placement math out of
  `arctic/index.ts` by hand, the way this script had to.
