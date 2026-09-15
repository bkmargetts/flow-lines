# Unwritten Circle

## Artist statement

`arctic` has sat in `packages/core/src/` since the last session, unused
and not even listed in the README's toolbox table. It doesn't hatch a
photograph or grow a plant — it samples a uniformly random domino tiling
of an Aztec diamond by domino shuffling (Elkies–Kuperberg–Larsen–Propp),
exactly, in closed form, no Markov chain, no burn-in. Nothing about that
process mentions a circle. And yet the arctic circle theorem
(Jockusch–Propp–Shor, 1998) says that as the diamond grows, the tiling
freezes into brick-regular order at the four corners and stays
disordered everywhere inside one exact circle inscribed in the diamond —
a boundary that is *inevitable*, produced by nothing but n(n+1) coin
flips, with no drawing code, no gradient, no noise function anywhere
near it.

I spent the early candidates just looking at that fact — the four
built-in presets (`dissolve`, `horizon`, `brick`, `weave`), several
seeds each, rotated and not. All of them are honest and none of them are
a *picture*: they read as diagrams, correctly, because that's what they
are. The turn came from asking what a domino actually looks like once
you stop thinking of it as a proof object: a short rectangular tile,
exactly the shape of a fragment of sea ice. So I rebuilt the render
myself from `shuffleAztec`/`dominoClass` (the only two things `arctic`
exports beyond the convenience wrapper): one frozen class welded into
long solid rules — a pack-ice shelf — and, inside the theorem's own
inscribed circle, every domino's outline kept at a density that thins
with distance from that shelf, so consolidated floes at the boundary
break up into isolated ones and then nothing, out in open water. No
class but the shelf's is drawn, so the diamond's other three frozen
corners stay blank paper — which, once the whole thing is turned upright
and anchored low on a tall sheet, reads as night sky.

What survived the cull is a single luminous disc rising out of a dark
corner: a razor-sharp limb where the mottled body meets open space,
exactly the way a moon or an ice cap photographs. That resemblance is
not designed — it's what a *phase boundary* looks like, and the
combinatorics behind this one happens to carry a name (the "arctic
circle") that is a coincidence of geography, not of astronomy, and
still lands the image dead center on both. I kept coming back to that
double miss — a math theorem named after the wrong kind of circle,
drawing a picture of a third thing neither name intended — as the
reason to stand behind this one over every tidier, more legible
candidate (a full even "brick" grid; the four-way "weave" mandala; the
plain `dissolve` speckle with no shelf underneath it) that I rendered
and set aside.

## Materials

- **Paper:** GF Smith Colorplan, "Marine" (deep indigo-navy), 270gsm,
  smooth (uncoated but calendered — not laid/textured; the floe outlines
  are ~1mm dominoes and need a tooth-free surface to hold), trimmed to
  A3 (297×420mm), portrait. One sheet.
- **Ink 1 — "Shelf White"**, hex `#f4f1ea` (warm opaque white, not
  clinical pure white). An opaque pigment gel roller such as a Sakura
  Gelly Roll 08 White, or a fine paint marker (Posca PC-1M) if the gel
  doesn't lay down solid enough over two passes on dark card. Plots
  `artwork-ice.svg`.
- **Ink 2 — "Floe Blue"**, hex `#bcd6e0` (a pale, cool glacier blue —
  noticeably cooler and less opaque than Ink 1, so the floe outlines
  read as a secondary, glinting layer rather than a repeat of the shelf
  tone). A gel roller in a pale ice blue, or Ink 1's white cut with a
  little Prussian blue if mixing a paint marker by hand. Plots
  `artwork-floe.svg`.
- No wash, no mask, no third pass. The piece is finished at the plot.

## Process

1. Trim the Colorplan Marine to A3 (297×420mm) and tape it to the
   plotter bed, portrait, squared to the bed's home position.
2. Load Ink 1 (Shelf White), 0.45mm effective line. Plot
   `artwork-ice.svg` first — it is the sparser, more structural pass (the
   solid shelf and its dissolving dashes) and establishes the piece's
   one committed mass before anything else goes down.
3. Let the first pass dry ~10 minutes (opaque gel/paint ink on
   uncoated card — enough time that the second pass doesn't drag through
   wet ink where the two layers cross near the shelf's edge).
4. Swap to Ink 2 (Floe Blue), same 0.45mm nib/tip. Plot
   `artwork-floe.svg` on the same sheet, same registration (no
   repositioning — the file shares `artwork-ice.svg`'s exact page
   dimensions and coordinate space).
5. Let cure fully (~30 minutes) before handling. Mount under glass or
   UV-filtering acrylic — dark card fades pigment ink over years of
   direct light faster than white stock will show it. Float mount
   preferred (a visible reveal of dark card around the image reinforces
   the "small bright thing in a dark field" the piece is built on) —
   no window mat touching the plotted area.

## Plot settings

- Paper: A3 (297×420mm), portrait, margin 18mm
- Pen width: 0.45mm, both inks (single width per layer; the shelf's tone
  comes from how densely the theorem welds its own rules, not from
  repeated offset passes)
- Resolution: 3 px/mm (tool default)
- Two layers, ~22,500 strokes total: `artwork-ice.svg` (4,212 strokes,
  ≈18m of line) and `artwork-floe.svg` (18,296 strokes, ≈27m) — ≈45m
  combined, `orderPlot` reordered (not chained — chaining would fuse
  distinct dominoes into one path and round-cap the joins, softening
  the brick geometry that is the entire point)

## Reproduction

`arctic` has no CLI command; this drawing also reaches past its
convenience wrapper (`generateArctic`) into the two primitives it's
built from (`shuffleAztec`, `dominoClass` — the module's own weld/outline
helpers, `spineMarks`/`outlineMarks`, are internal to `arctic/marks.ts`
and aren't re-exported from the package barrel, so this script rebuilds
those two small, already-documented steps itself from domino geometry;
nothing in `packages/core/src` was modified). Both `artwork-*.svg` files
in this folder are byte-reproducible from one run:

```sh
pnpm install && pnpm build     # builds packages/core/dist used below
node unwritten-circle.mjs 7 . 190
```

`unwritten-circle.mjs`:

```js
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const coreDist = './packages/core/dist/index.js';
const {
  shuffleAztec, dominoClass, applyHandDrawnStyle, orderPlot, toSVG,
  toSVGLayers, getPaperSize, pageMetrics,
} = await import(coreDist);

// spineMarks/outlineMarks are internal to arctic/marks.ts, not part of the
// public barrel — only shuffleAztec + dominoClass are exported, so this
// script rebuilds the two small, documented primitives itself from domino
// geometry (a weld pass over spine segments; a deduped outline pass).
function spineOf(d) {
  const a = d.h ? { x: d.x, y: d.y + 0.5 } : { x: d.x + 0.5, y: d.y };
  const b = d.h ? { x: d.x + 2, y: d.y + 0.5 } : { x: d.x + 0.5, y: d.y + 2 };
  return { a, b };
}
function weldSpines(dominoes) {
  const segs = dominoes.map((d) => ({ ...spineOf(d), h: d.h }));
  const k = (p) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
  const ends = new Map();
  for (const s of segs) for (const p of [s.a, s.b]) {
    const kk = k(p);
    if (!ends.has(kk)) ends.set(kk, []);
    ends.get(kk).push(s);
  }
  const used = new Set();
  const out = [];
  for (const s of segs) {
    if (used.has(s)) continue;
    used.add(s);
    const pts = [s.a, s.b];
    for (const end of [0, 1]) {
      for (;;) {
        const tip = end === 0 ? pts[0] : pts[pts.length - 1];
        let grew = false;
        for (const c of ends.get(k(tip)) ?? []) {
          if (used.has(c) || c.h !== s.h) continue;
          const other = k(c.a) === k(tip) ? c.b : c.a;
          used.add(c);
          if (end === 0) pts.unshift(other); else pts.push(other);
          grew = true;
          break;
        }
        if (!grew) break;
      }
    }
    out.push(pts);
  }
  return out;
}
function outlinesOf(dominoes) {
  const seen = new Set();
  const out = [];
  for (const d of dominoes) {
    const w = d.h ? 2 : 1;
    const hgt = d.h ? 1 : 2;
    const corners = [[d.x, d.y], [d.x + w, d.y], [d.x + w, d.y + hgt], [d.x, d.y + hgt]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const kk = [a, b].map((z) => z.join(',')).sort().join('|');
      if (seen.has(kk)) continue;
      seen.add(kk);
      out.push([{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }]);
    }
  }
  return out;
}
// Deterministic hash -> [0,1) for reproducible density thinning: a pure
// function of domino position, so the whole piece stays a pure function
// of (order, seed) with no extra RNG stream to thread through.
function hash01(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function buildUnwrittenCircle({
  order, seed, mainClass = 'N', widthPx, heightPx, marginPx, wobble = 0.3,
  falloffStart = 0.1, falloffEnd = 0.85, falloffPow = 1.2, circleFudge = 1.0,
}) {
  const dominoes = shuffleAztec(order, seed);

  // The shelf: one frozen domino class, welded into long solid rules
  // exactly where the theorem freezes it, breaking into scattered dashes
  // across the disordered core, and vanishing outside it.
  const iceRaw = weldSpines(dominoes.filter((d) => dominoClass(d, order) === mainClass));

  // The floe field: every domino's outline, kept only inside the theorem's
  // own inscribed circle (radius n/sqrt2) and thinned by a smooth,
  // deterministic falloff with distance from the shelf.
  const apex = { x: 0, y: order };
  const R = (order / Math.SQRT2) * circleFudge;
  const maxDist = order * Math.SQRT2;
  const cellOf = (d) => ({ x: d.x + (d.h ? 1 : 0.5), y: d.y + (d.h ? 0.5 : 1) });
  const keep = (d) => {
    const c = cellOf(d);
    if (c.x * c.x + c.y * c.y > R * R) return false;
    const dist = Math.hypot(c.x - apex.x, c.y - apex.y) / maxDist;
    const t = Math.min(1, Math.max(0, (dist - falloffStart) / (falloffEnd - falloffStart)));
    const p = Math.pow(1 - t, falloffPow);
    return hash01(Math.round(c.x * 4), Math.round(c.y * 4)) < p;
  };
  const floeRaw = outlinesOf(dominoes.filter(keep));

  // Turn the diamond upright (45°) so the frozen tips sit at flat edges,
  // then fit the whole diamond's bounding square to the page width and
  // anchor it to the bottom margin: the circle sits low, open paper above
  // standing in for open sky.
  const rot = Math.PI / 4;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const turn = (q) => ({ x: q.x * cos - q.y * sin, y: q.x * sin + q.y * cos });
  const half = order + 0.5;
  const corners = [{ x: half, y: 0 }, { x: -half, y: 0 }, { x: 0, y: half }, { x: 0, y: -half }].map(turn);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of corners) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const spanX = Math.max(1e-6, x1 - x0), spanY = Math.max(1e-6, y1 - y0);
  const boxW = Math.max(1, widthPx - 2 * marginPx);
  const k = boxW / spanX;
  const offX = (widthPx - spanX * k) / 2;
  const offY = heightPx - marginPx - spanY * k;
  const place = (q) => { const t = turn(q); return { x: (t.x - x0) * k + offX, y: (t.y - y0) * k + offY }; };

  const iceLines = iceRaw.map((pts) => ({ points: pts.map(place), layer: 'ice' }));
  const floeLines = floeRaw.map((pts) => ({ points: pts.map(place), layer: 'floe' }));
  let result = { lines: [...iceLines, ...floeLines], width: widthPx, height: heightPx, seed };
  if (wobble > 0) {
    result = applyHandDrawnStyle(result, { amplitude: wobble, wavelength: 90, jitter: wobble * 0.3, seed });
  }
  return orderPlot(result);
}

const seed = Number(process.argv[2] ?? 7);
const outDir = process.argv[3] ?? '.';
const order = Number(process.argv[4] ?? 190);
mkdirSync(outDir, { recursive: true });

const paper = getPaperSize('a3');
const pm = pageMetrics(paper, 'portrait');
const marginPx = 18 * pm.pxPerMm;

const result = buildUnwrittenCircle({ order, seed, widthPx: pm.widthPx, heightPx: pm.heightPx, marginPx });

for (const { layer, svg } of toSVGLayers(result, {
  strokeWidth: 1.35,
  physicalWidth: `${pm.widthMm}mm`,
  physicalHeight: `${pm.heightMm}mm`,
})) {
  writeFileSync(join(outDir, `artwork-${layer}.svg`), svg);
}

// preview.png's source: both layers coloured and laid on the paper's own
// ink, not part of the plotted deliverable.
const combined = toSVG(result, {
  strokeWidth: 1.35,
  layerColors: { ice: '#f4f1ea', floe: '#bcd6e0' },
  backgroundColor: '#0d2a3d',
  includeBackground: true,
  physicalWidth: `${pm.widthMm}mm`,
  physicalHeight: `${pm.heightMm}mm`,
});
writeFileSync(join(outDir, 'combined-preview-source.svg'), combined);
console.log(`${result.lines.length} lines total`);
```

`preview.png`:

```sh
node scripts/svg-to-png.mjs combined-preview-source.svg preview.png --width 1800
```

Seed 7, order 190 are exactly the values used for the committed files —
`shuffleAztec` is deterministic per `(order, seed)`, the floe thinning is
a pure hash of domino position, and `orderPlot` is a stable reorder, so
this run reproduces `artwork-ice.svg` and `artwork-floe.svg` byte for
byte.

## Wishes

- `arctic`'s public surface is just `shuffleAztec`/`dominoClass` plus the
  convenience wrapper — `spineMarks`, `outlineMarks`, and especially the
  weld pass (the step that turns long-range order into visible tone) live
  in `arctic/marks.ts` and aren't re-exported. Every session that wants to
  build a custom mark strategy on top of the tiling (rather than picking
  one of the four fixed presets) ends up re-implementing weld-by-shared-
  endpoint from scratch, as this one did. Exporting those two functions
  (or a lower-level `arctic/marks.js` deep import sanctioned for
  scripting, the way `lib/` is deliberately not) would save the next
  session the trip.
- There's no way to bias *where* the inscribed circle sits relative to
  the page short of recomputing the diamond's own bounding box by hand
  (as this script does) — a `fit`/`anchor` option on `generateArctic`
  itself (mirroring `PaperFit` elsewhere in the repo) would make this
  kind of off-center, bleed-to-one-side composition reachable without
  leaving the convenience wrapper at all.
