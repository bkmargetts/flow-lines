import type { FlowLine, Point } from '../flow-lines.js';
import { clamp, lerp } from '../lib/math.js';
import { makeRandom } from '../lib/rng.js';
import type { HeartSpec } from './layout.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export interface HeartBuildOpts {
  shading: number;
  lightAngle: number;
  fillDensity: number;
  hatchAngle: number;
  hatchJitter: number;
  penWidth: number;
  /** 0..1 — how young the hand holding the pen is (0 = adult, the default:
   *  every kid effect is skipped entirely so the adult path is byte-stable). */
  childish?: number;
}

export interface HeartBuild {
  strokes: FlowLine[];
  /** Slightly inflated outline polygon for the shared depth buffer. */
  occluder: Point[];
  depth: number;
}

/** Vertical aspect for a plumpness value: 0 = tall and pointy, 1 = wide and
 *  chubby. Applied to the parametric curve's y before rotation. */
export const heartAspect = (plump: number): number => lerp(1.25, 0.85, clamp(plump, 0, 1));

/** Radius of the bounding circle about the heart's centre. The tip reaches
 *  r·aspect (exact for pointy hearts, aspect ≥ 1); for chubby hearts the
 *  lobe diagonal governs but stays under r, so max(1, aspect) bounds both. */
export const heartBoundRadius = (r: number, plump: number): number =>
  r * Math.max(1, heartAspect(plump));

/** Sample count for a full heart outline, scaled like the sports-balls seam
 *  circles so small hearts stay cheap and big ones stay smooth. */
const heartSamples = (r: number): number => clamp(Math.round(r * 1.6), 24, 96);

/**
 * The classic parametric heart (same harmonic family as `heartRegion` in
 * stickmen/region.ts), sampled as a closed polyline: lobes span ±16/17·r,
 * plumpness stretches or squashes it vertically, rotated about the centre.
 * Insets are just re-evaluations at a smaller r — always simple and closed,
 * with the cleft shallowing toward the centre the way hand-nested hearts do.
 */
export function heartOutline(
  cx: number,
  cy: number,
  r: number,
  rot: number,
  plump: number,
  n = heartSamples(r)
): Point[] {
  const ay = heartAspect(plump);
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    // x ∈ [-16,16], y ∈ [-17,12] (y up); normalize by 17 and flip y for the page.
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const dx = (hx / 17) * r;
    const dy = (-hy / 17) * r * ay;
    pts.push({ x: cx + dx * cosR - dy * sinR, y: cy + dx * sinR + dy * cosR });
  }
  return pts;
}

/** The classic curve in local unit coords (unrotated, y down), radially
 *  scaled by `warp`. */
const localPoint = (t: number, ay: number, warp: (t: number) => number): Point => {
  const hx = 16 * Math.pow(Math.sin(t), 3);
  const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  const w = warp(t);
  return { x: (hx / 17) * w, y: (-hy / 17) * ay * w };
};

/**
 * A kid's heart outline: the classic curve warped lopsided, then SIMPLIFIED —
 * blended toward the polygon through a handful of anchor points on it. Young
 * children draw a schema, not a curve: a few near-straight strokes, angular
 * lobes, a committed notch and tip (anchor count is even so t=0 and t=π are
 * always anchors — the V-notch and the point are what make it a heart, and
 * kids exaggerate rather than lose them). Anchors are convex combinations of
 * on-curve points, so the simplified shape stays inside the bounding circle
 * and nested copies (pure scalings) can never cross.
 */
export function kidOutline(
  cx: number,
  cy: number,
  r: number,
  rot: number,
  plump: number,
  kid: KidHand,
  n = heartSamples(r)
): Point[] {
  const ay = heartAspect(plump);
  const K = kid.anchors;
  const s = kid.simplify;
  const anchor: Point[] = [];
  for (let j = 0; j <= K; j++) anchor.push(localPoint((j / K) * TAU, ay, kid.warp));
  // Kids exaggerate the notch — the V is what makes it a heart. Pull the
  // cleft anchor (t = 0 ≡ 2π) deeper toward the centre with simplification.
  const deepen = 0.14 * ay * s;
  anchor[0] = { x: anchor[0].x, y: anchor[0].y + deepen };
  anchor[K] = { x: anchor[K].x, y: anchor[K].y + deepen };
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const base = localPoint(t, ay, kid.warp);
    const f = (i / n) * K;
    const j = Math.min(K - 1, Math.floor(f));
    const frac = f - j;
    const px = lerp(anchor[j].x, anchor[j + 1].x, frac);
    const py = lerp(anchor[j].y, anchor[j + 1].y, frac);
    const dx = lerp(base.x, px, s) * r;
    const dy = lerp(base.y, py, s) * r;
    pts.push({ x: cx + dx * cosR - dy * sinR, y: cy + dx * sinR + dy * cosR });
  }
  return pts;
}

/**
 * The per-heart "kid hand": everything a young artist gets wrong, drawn once
 * from the heart's own childSeed in a PINNED order (warp → closure → retrace
 * → drift → arrow) so no render knob can shift a heart's lopsidedness or
 * where its outline fails to close. The residual `rng` is reserved for
 * trailing variable-count draws (per-hatch-segment overshoots) only.
 */
export interface KidHand {
  /** How young: 0..1 (0 = adult; a KidHand is never built for an adult). */
  c: number;
  /** Radial multiplier over the curve parameter t, max exactly 1 (the warped
   *  heart never leaves its bounding circle, so layout stays valid). */
  warp: (t: number) => number;
  /** Anchor count for shape simplification (even, 8 at age 3 → 36 near
   *  adult) — the "number of strokes" the schema is drawn with. */
  anchors: number;
  /** 0..1 blend toward the anchor polygon — the dominant youth effect. */
  simplify: number;
  closure: { mode: 'gap' | 'overshoot'; frac: number } | null;
  /** Bold-pass inset jitters, in pen widths. */
  retraceJit: [number, number];
  /** Signed sloppy-retrace offset in pen widths (young hands re-trace even
   *  unemphasised hearts), or null when the hand is steady enough. */
  extraRetrace: number | null;
  driftAng: number;
  driftK: number;
  /** Signed unit jitters for arrow shaft / barb / fletch angles. */
  arrowJit: [number, number, number];
  rng: () => number;
}

export function kidHand(childSeed: number, c: number): KidHand {
  const rng = makeRandom(childSeed);
  // Lopsidedness: low-order radial asymmetry, normalized so the multiplier
  // peaks at exactly 1 — kid hearts dent inward, never grow outward.
  const a1 = 0.55 + 0.45 * rng();
  const p1 = rng() * TAU;
  const a2 = 0.3 + 0.5 * rng();
  const p2 = rng() * TAU;
  const A = 0.22 * c * c;
  const amp = A / (a1 + a2);
  const warp = (t: number): number =>
    (1 + amp * (a1 * Math.sin(t + p1) + a2 * Math.sin(2 * t + p2))) / (1 + A);

  // Simplicity is the dominant youth signal: fewer anchor "strokes" and a
  // stronger blend toward the polygon through them as age drops.
  const anchors = 2 * Math.round(lerp(4, 18, 1 - c));
  const simplify = Math.min(1, 1.15 * Math.pow(c, 1.3));

  // Closure failure at the cleft (the parametric seam is the cleft dip —
  // exactly where a child starts and finishes a heart).
  const closeRoll = rng();
  const closeMode: 'gap' | 'overshoot' = rng() < 0.5 ? 'gap' : 'overshoot';
  const closeFrac = c * c * (0.03 + 0.05 * rng());
  const closure =
    closeRoll < clamp(1.8 * c - 0.55, 0, 1) ? { mode: closeMode, frac: closeFrac } : null;

  const retraceJit: [number, number] = [(rng() * 2 - 1) * c * 0.8, (rng() * 2 - 1) * c * 0.8];
  const extraRetraceDraw = (rng() * 2 - 1) * c * 1.2;
  const extraRetrace = c >= 0.6 ? extraRetraceDraw : null;

  const driftAng = rng() * TAU;
  const driftK = 0.18 * Math.pow(c, 1.5);

  const arrowJit: [number, number, number] = [
    (rng() * 2 - 1) * c,
    (rng() * 2 - 1) * c,
    (rng() * 2 - 1) * c,
  ];

  return { c, warp, anchors, simplify, closure, retraceJit, extraRetrace, driftAng, driftK, arrowJit, rng };
}

/**
 * Exact hatch fill of a simple polygon: for each scanline in the rotated
 * frame, intersect the infinite hatch line with every edge, sort the hits
 * along the line and pair them even-odd into inside runs — the non-convex
 * cleft clips exactly, no rasterization. `phase` (0..1) slides the whole
 * family so no two hearts' hatch registers alike.
 */
export function hatchPolygon(
  poly: Point[],
  angle: number,
  spacing: number,
  phase: number
): Point[][] {
  if (poly.length < 3) return [];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  let minU = Infinity;
  let maxU = -Infinity;
  for (const p of poly) {
    const u = p.x * nx + p.y * ny;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
  }
  const out: Point[][] = [];
  const ts: number[] = [];
  for (let u = minU + spacing * (0.3 + 0.7 * phase); u < maxU; u += spacing) {
    ts.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j];
      const b = poly[i];
      const ua = a.x * nx + a.y * ny;
      const ub = b.x * nx + b.y * ny;
      if ((ua <= u && ub > u) || (ub <= u && ua > u)) {
        const f = (u - ua) / (ub - ua);
        const px = a.x + (b.x - a.x) * f;
        const py = a.y + (b.y - a.y) * f;
        ts.push(px * dx + py * dy);
      }
    }
    if (ts.length < 2) continue;
    ts.sort((p, q) => p - q);
    for (let k = 0; k + 1 < ts.length; k += 2) {
      const t0 = ts[k];
      const t1 = ts[k + 1];
      if (t1 - t0 < spacing * 0.4) continue; // corner slivers read as flecks
      out.push([
        { x: nx * u + dx * t0, y: ny * u + dy * t0 },
        { x: nx * u + dx * t1, y: ny * u + dy * t1 },
      ]);
    }
  }
  return out;
}

/** Rotate a local (heart-frame) point about the heart's centre onto the page. */
const place = (spec: HeartSpec, lx: number, ly: number): Point => {
  const cosR = Math.cos(spec.rot);
  const sinR = Math.sin(spec.rot);
  return { x: spec.x + lx * cosR - ly * sinR, y: spec.y + lx * sinR + ly * cosR };
};

/**
 * One heart: the outline plus its style's interior marks — concentric copies
 * for solid, exact even-odd hatch for hatched, a jagged crack for broken —
 * an optional shadow-side band lit by one shared page-space light, bold
 * multi-pass emphasis, and a cupid's arrow whose shaft is hidden where it
 * passes behind the heart's own body. A young artist (opts.childish > 0)
 * warps the shape lopsided, fails to close the outline at the cleft,
 * re-traces sloppily, nests solid fills off-centre and scribbles the hatch
 * out past the lines; the occluder always stays the CLOSED warped outline so
 * the depth buffer matches the drawn silhouette.
 */
export function buildHeart(spec: HeartSpec, o: HeartBuildOpts): HeartBuild {
  const { x, y, r, plump, rot } = spec;
  const strokes: FlowLine[] = [];
  const spacing = Math.max(2, lerp(o.penWidth * 4.5, o.penWidth * 1.8, clamp(o.fillDensity, 0, 1)));
  const c = clamp(o.childish ?? 0, 0, 1);
  const kid = c > 0 ? kidHand(spec.childSeed, c) : null;
  // Every copy of this heart's shape — outline, retraces, rings, hatch clip,
  // shade rings, arrow clip, occluder — comes through here, so the kid's
  // simplified schema is the ONE shape the whole heart is built from.
  const ring = (rcx: number, rcy: number, rr: number): Point[] =>
    kid ? kidOutline(rcx, rcy, rr, rot, plump, kid) : heartOutline(rcx, rcy, rr, rot, plump);

  const outer = ring(x, y, r);
  strokes.push({ points: kid ? failClosure(outer, spec, kid) : outer, pen: 'fine', layer: 'outline' });
  if (spec.bold) {
    // Bold emphasis is repeated offset passes of the same pen, never a wider
    // stroke — the repo's one-pen contract. A kid re-traces less precisely.
    const insets = [o.penWidth * 0.9, o.penWidth * 1.8];
    for (let k = 0; k < insets.length; k++) {
      const inset = kid
        ? Math.max(o.penWidth * 0.15, insets[k] + kid.retraceJit[k] * o.penWidth)
        : insets[k];
      if (r - inset < 2) break;
      strokes.push({ points: ring(x, y, r - inset), pen: 'fine', layer: 'outline' });
    }
  } else if (kid && kid.extraRetrace !== null) {
    // Young hands go over the line again even without meaning emphasis; a
    // negative offset re-traces just OUTSIDE the outline (≤ ~1.7px past the
    // bound, inside the layout's +2 page inset).
    const rr = r - kid.extraRetrace * o.penWidth;
    if (rr > 2) {
      strokes.push({ points: ring(x, y, rr), pen: 'fine', layer: 'outline' });
    }
  }

  switch (spec.style) {
    case 'outline':
      break;
    case 'solid':
      if (kid && c >= 0.66) {
        // A young kid doesn't nest careful concentric copies — they colour
        // the heart in with a back-and-forth scribble.
        const inset = Math.max(2, r - o.penWidth * 1.2);
        if (inset > 2) {
          const angle = rot + (spec.g[0] * 2 - 1) * 1.4;
          strokes.push(
            ...kidFill(hatchPolygon(ring(x, y, inset), angle, spacing, spec.g[1]), angle, spacing, c, kid)
          );
        }
        break;
      }
      for (let rr = r - spacing; rr > Math.max(2, spacing * 0.6); rr -= spacing) {
        // Kid nesting drifts off-centre, more the deeper it goes; driftK is
        // capped so even the worst-warped cleft keeps every ring inside.
        const d = kid ? kid.driftK * (r - rr) : 0;
        const cxr = x + Math.cos(kid?.driftAng ?? 0) * d;
        const cyr = y + Math.sin(kid?.driftAng ?? 0) * d;
        strokes.push({ points: ring(cxr, cyr, rr), pen: 'fine', layer: 'fill' });
      }
      break;
    case 'hatched': {
      const inset = Math.max(2, r - o.penWidth * 1.2);
      if (inset > 2) {
        const angle =
          o.hatchAngle + rot + (spec.g[0] * 2 - 1) * clamp(o.hatchJitter, 0, 1) * 30 * DEG;
        const segs = hatchPolygon(ring(x, y, inset), angle, spacing, spec.g[1]);
        if (!kid) {
          for (const seg of segs) strokes.push({ points: seg, pen: 'fine', layer: 'fill' });
        } else {
          strokes.push(...kidFill(segs, angle, spacing, c, kid));
        }
      }
      break;
    }
    case 'broken':
      strokes.push({ points: crack(spec, c), pen: 'fine', layer: 'fill' });
      break;
  }

  // Form shading is learned finesse — it fades out entirely below age ~8
  // (full below c 0.4, ramping off toward 0.66) whatever the knob says.
  const effShading = o.shading * (kid ? clamp((0.66 - c) / 0.26, 0, 1) : 1);
  if (effShading > 0) strokes.push(...shade(spec, { ...o, shading: effShading }, ring));
  if (spec.arrow && r >= 9) strokes.push(...arrow(spec, kid, ring));

  const inflate = Math.max(0.6, o.penWidth * 0.75);
  return {
    strokes,
    occluder: ring(x, y, r + inflate),
    depth: spec.depth,
  };
}

/** A kid's outline doesn't quite close at the cleft: either it stops short
 *  (a gap) or swings past the start again (an overshoot drifting slightly
 *  outward, capped inside the layout's +2 page inset). Drawn stroke only —
 *  the occluder stays closed. */
function failClosure(outer: Point[], spec: HeartSpec, kid: KidHand): Point[] {
  if (!kid.closure) return outer;
  const n = outer.length - 1; // last point duplicates the first
  if (kid.closure.mode === 'gap') {
    const k = Math.max(1, Math.round((n * kid.closure.frac) / 2));
    if (outer.length - 2 * k < 3) return outer;
    return outer.slice(k, outer.length - k);
  }
  const k = Math.max(2, Math.round(n * kid.closure.frac * 1.5));
  const growCap = Math.min(1.04, 1 + 2 / heartBoundRadius(spec.r, spec.plump));
  const pts = outer.slice();
  for (let i = 1; i <= Math.min(k, n); i++) {
    const p = outer[i];
    const s = lerp(1, growCap, i / k);
    pts.push({ x: spec.x + (p.x - spec.x) * s, y: spec.y + (p.y - spec.y) * s });
  }
  return pts;
}

/** A kid's hatch fill: every stroke overshoots the outline a little
 *  (coloring outside the lines), and a young-enough hand doesn't lift the
 *  pen between strokes — nearby segments chain into one boustrophedon
 *  scribble. The chain gate (≤ 2.6 spacings) never bridges the cleft: the
 *  two even-odd runs on one scanline sit far apart. */
function kidFill(segs: Point[][], angle: number, spacing: number, c: number, kid: KidHand): FlowLine[] {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const over = (): number => Math.min(4.5, Math.pow(c, 1.2) * (1.5 + 3 * kid.rng()));
  const shot = segs.map(([a, b]) => {
    const e0 = over();
    const e1 = over();
    return [
      { x: a.x - dx * e0, y: a.y - dy * e0 },
      { x: b.x + dx * e1, y: b.y + dy * e1 },
    ];
  });
  const out: FlowLine[] = [];
  if (c < 0.66) {
    for (const seg of shot) out.push({ points: seg, pen: 'fine', layer: 'fill' });
    return out;
  }
  const maxHop = 2.6 * spacing;
  let chain: Point[] = [];
  const flush = (): void => {
    if (chain.length >= 2) out.push({ points: chain, pen: 'fine', layer: 'fill' });
    chain = [];
  };
  for (const [a, b] of shot) {
    if (chain.length === 0) {
      chain.push(a, b);
      continue;
    }
    const end = chain[chain.length - 1];
    const da = Math.hypot(end.x - a.x, end.y - a.y);
    const db = Math.hypot(end.x - b.x, end.y - b.y);
    const [entry, exit] = da <= db ? [a, b] : [b, a];
    if (Math.min(da, db) <= maxHop) {
      chain.push(entry, exit);
    } else {
      flush();
      chain.push(a, b);
    }
  }
  flush();
  return out;
}

/** The broken-heart crack: a jagged polyline from the cleft notch down
 *  toward the tip, lateral swings tapering as it goes — the universally-read
 *  icon, no outline splitting needed. A young kid's crack is simpler: one
 *  big zigzag instead of five. */
function crack(spec: HeartSpec, c = 0): Point[] {
  const { r, plump, g } = spec;
  const ay = heartAspect(plump);
  const y0 = -(5 / 17) * r * ay; // the cleft dip (the t=0 outline sample)
  const y1 = 0.82 * r * ay; // short of the tip
  const side0 = g[2] < 0.5 ? 1 : -1;
  const pts: Point[] = [place(spec, 0, y0)];
  const SEGS = c >= 0.6 ? 3 : 5;
  for (let i = 1; i < SEGS; i++) {
    const t = i / SEGS;
    const amp = r * (0.12 + 0.12 * g[2 + (i % 5)]) * (1 - 0.45 * t);
    const side = i % 2 === 0 ? -side0 : side0;
    pts.push(place(spec, side * amp, lerp(y0, y1, t)));
  }
  pts.push(place(spec, 0, y1));
  return pts;
}

/**
 * Shadow-side band: a few inset copies close under the outline, each split to
 * the runs facing away from the light — crescents hugging the silhouette on
 * the shadow side. The light is page-space and shared by the whole pile
 * (deliberately NOT heart-rotated), like the sports-balls shade rings.
 */
function shade(
  spec: HeartSpec,
  o: HeartBuildOpts,
  ringOf: (cx: number, cy: number, rr: number) => Point[]
): FlowLine[] {
  const { x, y, r } = spec;
  if (r < 6) return []; // rings on a tiny heart turn to mush
  const shading = clamp(o.shading, 0, 1);
  const lx = Math.cos(o.lightAngle);
  const ly = Math.sin(o.lightAngle);
  const spacing = Math.max(2.5, o.penWidth * 2.2);
  const band = r * (0.12 + 0.42 * shading);
  const rings = Math.max(2, Math.round(band / spacing));
  const out: FlowLine[] = [];
  for (let k = 0; k < rings; k++) {
    const rk = r * 0.96 - (k * band) / Math.max(1, rings - 1);
    if (rk < 3) break;
    const ring = ringOf(x, y, rk);
    ring.pop(); // drop the duplicated closing point; we re-walk it cyclically
    const n = ring.length;
    const inShadow = (p: Point): boolean => {
      const dx = p.x - x;
      const dy = p.y - y;
      const len = Math.hypot(dx, dy) || 1;
      return (dx * lx + dy * ly) / len < -0.15;
    };
    // Start the cyclic walk on a lit sample so a shadow arc never splits
    // across the array seam.
    let start = 0;
    while (start < n && inShadow(ring[start])) start++;
    if (start === n) start = 0; // fully shadowed (can't happen with the margin, but safe)
    let run: Point[] = [];
    const flush = (): void => {
      if (run.length >= 3) out.push({ points: run, pen: 'fine', layer: 'shading' });
      run = [];
    };
    for (let i = 0; i < n; i++) {
      const p = ring[(start + i) % n];
      if (inShadow(p)) run.push(p);
      else flush();
    }
    flush();
  }
  return out;
}

/**
 * The cupid's arrow: a shaft through the heart's centre kept only OUTSIDE the
 * outline (the body occludes it), barbs at the exit tip, fletching ticks at
 * the entry — the classic pierced heart. A kid's arrow leans and its barbs
 * and fletching splay at wonky angles.
 */
function arrow(
  spec: HeartSpec,
  kid: KidHand | null,
  ringOf: (cx: number, cy: number, rr: number) => Point[]
): FlowLine[] {
  const { x, y, r, rot, plump, g } = spec;
  const arot = rot - 0.45 + (g[6] - 0.5) * 0.3 + (kid ? kid.arrowJit[0] * 0.25 : 0);
  const barbA = 0.42 + (kid ? kid.arrowJit[1] * 0.35 : 0);
  const fletchA = 0.7 + (kid ? kid.arrowJit[2] * 0.35 : 0);
  const dx = Math.cos(arot);
  const dy = Math.sin(arot);
  const L = heartBoundRadius(r, plump) * 1.45;
  // Even-odd crossings of the infinite shaft with a slightly inflated
  // outline, as params along the shaft — sorted, they bound the inside spans.
  const poly = ringOf(x, y, r + Math.max(1, r * 0.04));
  const nx = -dy;
  const ny = dx;
  const ts: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const ua = (a.x - x) * nx + (a.y - y) * ny;
    const ub = (b.x - x) * nx + (b.y - y) * ny;
    if ((ua <= 0 && ub > 0) || (ub <= 0 && ua > 0)) {
      const f = (0 - ua) / (ub - ua);
      const px = a.x + (b.x - a.x) * f;
      const py = a.y + (b.y - a.y) * f;
      ts.push((px - x) * dx + (py - y) * dy);
    }
  }
  if (ts.length < 2) return [];
  ts.sort((p, q) => p - q);
  const at = (t: number): Point => ({ x: x + dx * t, y: y + dy * t });
  const out: FlowLine[] = [];
  // Outside spans: entry up to the first crossing, gaps between inside spans,
  // last crossing out to the head.
  const bounds = [-L, ...ts, L];
  for (let k = 0; k + 1 < bounds.length; k += 2) {
    if (bounds[k + 1] - bounds[k] > 1) {
      out.push({ points: [at(bounds[k]), at(bounds[k + 1])], pen: 'fine', layer: 'decor' });
    }
  }
  // Head barbs at the exit tip.
  const barb = r * 0.24;
  for (const side of [1, -1]) {
    const ba = arot + Math.PI + side * barbA;
    const tip = at(L);
    out.push({
      points: [tip, { x: tip.x + Math.cos(ba) * barb, y: tip.y + Math.sin(ba) * barb }],
      pen: 'fine',
      layer: 'decor',
    });
  }
  // Fletching: tick pairs near the entry end, swept back along the shaft —
  // three for a practised hand, a young kid manages one.
  const fl = r * 0.2;
  const fletchPairs = kid && kid.c >= 0.6 ? 1 : 3;
  for (let k = 0; k < fletchPairs; k++) {
    const base = at(-L + k * fl * 0.55);
    for (const side of [1, -1]) {
      const fa = arot + Math.PI - side * fletchA;
      out.push({
        points: [base, { x: base.x + Math.cos(fa) * fl, y: base.y + Math.sin(fa) * fl }],
        pen: 'fine',
        layer: 'decor',
      });
    }
  }
  return out;
}
