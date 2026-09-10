# Brinicle

## Artist statement

`arctic` (`packages/core/src/arctic`) has never been used in this studio
before. It doesn't draw ice, or anything else — it samples a uniformly
random domino tiling of the Aztec diamond by domino shuffling
(Elkies–Kuperberg–Larsen–Propp), a combinatorics algorithm with no
notion of geometry beyond a diamond-shaped board. The reason it's in a
pen-and-ink toolbox at all is the arctic circle theorem (Jockusch–Propp–
Shor, 1998): as the diamond grows, every such tiling freezes into four
brick-regular corners with a genuinely disordered, patternless middle,
and the boundary between frozen and liquid converges to the circle
inscribed in the diamond. Nothing in the shuffling algorithm mentions a
circle. It falls out of pure counting.

I inked one frozen corner solid and left the other three, plus the
liquid middle, as an even, textureless field — and the first render
already looked like weather: a hard dark mass at one pole feathering
into loose vertical streaks that thin to scattered flecks before they
reach the far edge. That is also, almost stroke for stroke, what a
**brinicle** looks like. When sea ice forms, it rejects salt; the
leftover brine is far colder and denser than the water around it and
sinks in a plume, freezing a fragile tube of ice around itself as it
falls — a "brinicle," nicknamed the finger of death because anything
slow on the seafloor it reaches gets frozen solid. First filmed for BBC's
*Frozen Planet* in McMurdo Sound in 2011, after decades of divers
reporting a phenomenon nobody had believable footage of. The plume
doesn't reliably survive to the bottom — it thins, branches, and
dissipates into the water column, the freezing signature fading out
before it lands.

That is exactly the shape a frozen domino class makes near the arctic
circle: solid where the corner is fully ordered, then dashes that get
shorter and sparser as the tiling liquefies, stopping well short of
"the bottom" — which on this sheet is left as open paper, on purpose.
The piece pairs that spine with a second, much fainter layer: every
domino in the tiling, drawn as a welded outline at one uniform pale
ink, everywhere, regardless of class. On its own this second layer
carries no information at all — an even woven field, which is the
honest picture of what the tiling looks like before you choose how to
read it. It's there because the theorem's real subject isn't the
frozen corner, it's the fact that the *entire board* holds this much
hidden order and shows none of it until one class gets picked out. The
lattice is the sea. The spine is the one plume that happened to freeze
visibly.

Seed 24 at diamond order 110 was picked from a run of about thirty
seeds for the shape of its boundary: most seeds give a single rounded
crown, but this one froze into two lobes with a real notch between them
— close enough to a paired ice front that it stopped reading as a
diagram and started reading as a specific, particular formation, not a
generic demo of the theorem.

## Materials

- **Paper**: A3 (297 × 420mm) black cardstock, smooth finish — e.g.
  Fabriano Black Black 285gsm, or Canson Mi-Teintes 160gsm "Black" as a
  lighter-weight alternative. Needs to take gel ink cleanly without
  feathering; test a corner strip first.
- **Ink 1 — lattice (faint)**: Sakura Gelly Roll Metallic #08 Silver
  (or any pale cool-grey/silver gel pen, hex ≈ `#7d8694` against black
  stock) — every domino outline, the whole sheet, uniformly.
- **Ink 2 — spine (bold)**: Uni-ball Signo Broad UM-153 White, or Sakura
  Gelly Roll White 05 (hex ≈ `#f5faff`, a whisper of blue rather than
  pure white) — the frozen class's welded spine only.
- Pen holder shimmed for two barrel diameters if the plotter takes one
  mount at a time; otherwise two passes with a manual pen change.

## Process

1. Load the silver gel pen. Plot `artwork-grid.svg` — the full domino
   lattice, one pass, no repeats. This lays a faint, perfectly even
   woven texture across the whole diamond; it should look like almost
   nothing from normal viewing distance and only resolve into a lattice
   up close.
2. Let the ink set (gel ink on card: ~15–20 minutes before the second
   pass crosses it, longer in humid air).
3. Load the white gel pen. Plot `artwork-spine.svg` on the *same sheet,
   same origin* — no re-registration needed, both files share one
   viewBox from one coordinate transform, so they land exactly where
   the underlying tiling puts them. This lays the solid frozen mass and
   its descending tendrils in white over the silver field.
4. Let dry flat, ink-side up, at least an hour before handling.
5. Float-mount on black or deep indigo board, generous mount (60mm+) so
   the paper's black reads as continuous with the mount rather than as
   a cut edge — the piece should look like a window onto open water,
   not a rectangle sitting on a wall.

## Plot settings

- Paper: A3, portrait, 297 × 420mm.
- Margin: 20mm reserved on the fit transform (the diamond itself doesn't
  fill it symmetrically — see Reproduction: the composition is biased
  toward the top of the sheet, leaving a deliberately large clear run of
  paper below the lowest ink mark).
- Pen widths: lattice layer 0.25mm effective line; spine layer 0.4mm
  effective line. Both single pass, single width — no repeated offset
  passes; the spine's weight comes entirely from how densely the welded
  dominoes pack in the frozen zone, not from stroke tricks.
- Line counts / estimated travel (from `measurePenTravel`, un-tiled,
  single sheet): lattice layer 9,339 strokes, ≈43.3m of drawn line +
  ≈14.5m pen-up travel; spine layer 1,442 strokes, ≈7.4m drawn +
  ≈4.7m travel. Total ≈70m of pen movement across roughly 10,800 pen
  lifts — a long plot (likely 1.5–2.5 hours depending on the plotter's
  lift/settle overhead), but well within a single unattended session.

## Reproduction

`arctic` has no CLI command yet (it's core-only, like `city` and
`ribbon-weave`) and the two-layer registration this piece depends on
needs more than `generateArctic()` exposes directly: calling it twice
at the same seed with different `marks` presets does **not** register,
because each call fits *only the points it draws* to the page — the
single inked class doesn't reach every corner of the diamond, so its
bounding box (and therefore its scale) differs from the full lattice's.
The script below reimplements the placement using only the exported
primitives (`shuffleAztec`, `dominoClass`) and computes ONE shared fit
transform from the full lattice, then applies it to both layers, so the
two plotted passes land in exactly the same physical space. It also
welds the outline layer's unit edges into long runs (the library's own
`outlineMarks` leaves every unit edge separate, which is fine on screen
but means tens of thousands of unnecessary pen lifts on paper).

```sh
pnpm --filter @flow-lines/core build   # build core first
node arctic-brinicle.mjs concept-brainstorming/2026-09-10-0624 24 110
```

```js
// arctic-brinicle.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = join(process.cwd(), 'packages', 'core', 'dist', 'index.js');
const outDir = process.argv[2];
mkdirSync(outDir, { recursive: true });

const {
  shuffleAztec, dominoClass, toSVG, PAPER_SIZES, pageMetrics,
  applyHandDrawnStyle, orderPlot,
} = await import(coreDist);

const SEED = Number(process.argv[3] ?? 24);
const ORDER = Number(process.argv[4] ?? 110);
const INKED = 'N';
const paper = PAPER_SIZES.find((p) => p.id === 'a3');
const pm = pageMetrics(paper, 'portrait');
const W = pm.widthPx, H = pm.heightPx;
const MARGIN = 20 * pm.pxPerMm;
const V_BIAS = 0.18; // 0 = pinned to top margin, 1 = pinned to bottom
const GRID_PEN_MM = 0.25;
const SPINE_PEN_MM = 0.4;

function outlineSegs(dominoes) {
  const seen = new Set(), out = [];
  for (const d of dominoes) {
    const w = d.h ? 2 : 1, hgt = d.h ? 1 : 2;
    const corners = [[d.x, d.y], [d.x + w, d.y], [d.x + w, d.y + hgt], [d.x, d.y + hgt]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      const dx = (b[0] - a[0]) / steps, dy = (b[1] - a[1]) / steps;
      for (let s = 0; s < steps; s++) {
        const p = [a[0] + dx * s, a[1] + dy * s];
        const q = [a[0] + dx * (s + 1), a[1] + dy * (s + 1)];
        const kk = [p, q].map((z) => z.join(',')).sort().join('|');
        if (seen.has(kk)) continue;
        seen.add(kk);
        out.push({ a: { x: p[0], y: -p[1] }, b: { x: q[0], y: -q[1] } });
      }
    }
  }
  return out;
}
function spineSeg(d) {
  const a = d.h ? { x: d.x, y: d.y + 0.5 } : { x: d.x + 0.5, y: d.y };
  const b = d.h ? { x: d.x + 2, y: d.y + 0.5 } : { x: d.x + 0.5, y: d.y + 2 };
  return { a: { x: a.x, y: -a.y }, b: { x: b.x, y: -b.y } };
}
function weld(segs) {
  const k = (p) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
  const ends = new Map();
  for (const s of segs) for (const p of [s.a, s.b]) {
    const kk = k(p); let list = ends.get(kk);
    if (!list) ends.set(kk, (list = [])); list.push(s);
  }
  const isHoriz = (s) => Math.abs(s.a.y - s.b.y) < 1e-9;
  const used = new Set(), out = [];
  for (const s of segs) {
    if (used.has(s)) continue;
    used.add(s);
    const pts = [s.a, s.b];
    for (const end of [0, 1]) {
      for (;;) {
        const tip = end === 0 ? pts[0] : pts[pts.length - 1];
        let grew = false;
        for (const c of ends.get(k(tip)) ?? []) {
          if (used.has(c) || isHoriz(c) !== isHoriz(s)) continue;
          const other = k(c.a) === k(tip) ? c.b : c.a;
          used.add(c);
          if (end === 0) pts.unshift(other); else pts.push(other);
          grew = true; break;
        }
        if (!grew) break;
      }
    }
    out.push(pts);
  }
  return out;
}
function fitTransform(allPoints, width, height, margin, vBias) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of allPoints) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const spanX = Math.max(1e-6, x1 - x0), spanY = Math.max(1e-6, y1 - y0);
  const boxW = Math.max(1, width - 2 * margin), boxH = Math.max(1, height - 2 * margin);
  const k = Math.min(boxW / spanX, boxH / spanY);
  const offX = (width - spanX * k) / 2, offY = margin + (boxH - spanY * k) * vBias;
  return (p) => ({ x: (p.x - x0) * k + offX, y: (p.y - y0) * k + offY });
}

const dominoes = shuffleAztec(ORDER, SEED);
const outSegsRaw = outlineSegs(dominoes);
const outChains = weld(outSegsRaw);
const spineSegs = dominoes.filter((d) => dominoClass(d, ORDER) === INKED).map(spineSeg);
const spineChains = weld(spineSegs);

const allPts = outSegsRaw.flatMap((s) => [s.a, s.b]); // full diamond, shared bbox
const place = fitTransform(allPts, W, H, MARGIN, V_BIAS);

const gridLinesRaw = outChains.map((pts) => ({ points: pts.map(place), layer: 'grid' }));
const spineLinesRaw = spineChains.map((pts) => ({ points: pts.map(place), layer: 'spine' }));

function finish(lines) {
  let result = { lines, width: W, height: H, seed: SEED };
  result = applyHandDrawnStyle(result, { amplitude: 0.3, wavelength: 90, jitter: 0.1, seed: SEED });
  return orderPlot(result); // reorder-only: chaining would fuse welded runs and round-cap the joins
}
const gridResult = finish(gridLinesRaw);
const spineResult = finish(spineLinesRaw);

const physicalWidth = `${pm.widthMm}mm`, physicalHeight = `${pm.heightMm}mm`;
writeFileSync(join(outDir, 'artwork-grid.svg'), toSVG(gridResult, {
  strokeWidth: GRID_PEN_MM * pm.pxPerMm, physicalWidth, physicalHeight,
}));
writeFileSync(join(outDir, 'artwork-spine.svg'), toSVG(spineResult, {
  strokeWidth: SPINE_PEN_MM * pm.pxPerMm, physicalWidth, physicalHeight,
}));
```

The preview was rendered from a third, merged SVG (both layers' lines in
one document, `layerColors: { grid: '#7d8694', spine: '#f5faff' }`,
`preserveLayerOrder: true`) built the same way, then rasterized with:

```sh
node scripts/svg-to-png.mjs merged.svg preview.png --width 1600 --background '#0c0e13'
```

## Wishes

- `ArcticOptions` has no way to render two mark selections against one
  shared fit — every call re-fits to its own subset's bounding box.
  A `fitTo: 'full' | 'marks'` option (or simply always fitting to the
  full diamond regardless of `marks`) would make two-layer arctic pieces
  reproducible without reimplementing placement in userland.
- `outlineMarks` doesn't weld collinear unit edges the way `spineMarks`
  does, so the `brick`/`outline` preset is far more expensive to plot
  than it needs to be for a texture that's visually identical once
  welded (confirmed here: 24,930 → 6,326 strokes at order 90, same
  drawing). Worth fixing at the source rather than in every consumer.
