import { FlowLine, Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { offsetPolyline } from '../lib/polyline.js';
import { clamp, clamp01, lerp } from '../lib/math.js';
import { DEG, pushRun, clipLineToPolygon } from '../landscape/hatching.js';
import type { Morph } from './morph.js';
import type { Face } from './project.js';

/**
 * Facade marks: window grids that decay from
 * perfect rectangles (rigid) to drifting sills and ticks (flow) through one
 * code path, and the shadow-face hatch. Everything is authored in face space
 * `[0, W] × [z0, z1]` — clipping there is trivial — and mapped to the page
 * through `Face.at`, so marks foreshorten and bend with a leaning tower
 * without knowing anything about the projection.
 */

/** Per-building mark craft: one rng stream, taper and angle jitter reach. */
export interface FaceCraft {
  rng: () => number;
  taper: number;
  jitter: number; // radians
}

/** Push a closed occlusion polygon outward by `px` along its edge normals,
 *  so the hand-drawn wobble (applied after occlusion) can't bend background
 *  strokes back across the mass's contour. The landscape's centroid push is
 *  wrong here: on a tall thin building the centroid direction is nearly
 *  vertical at every vertex, so the sides barely inflate at all and
 *  background lines leak through the walls. */
export function inflatePoly(poly: Point[], px: number): Point[] {
  const n = poly.length;
  if (n < 3) return poly.slice();
  // Winding via the shoelace sum decides which side is "out".
  let area2 = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area2 += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  const sign = area2 > 0 ? 1 : -1;
  const out: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const a = poly[(i - 1 + n) % n];
    const b = poly[(i + 1) % n];
    // Adjacent edge normals (unit), averaged with a miter clamp.
    let n1x = p.y - a.y;
    let n1y = a.x - p.x;
    const l1 = Math.hypot(n1x, n1y) || 1;
    let n2x = b.y - p.y;
    let n2y = p.x - b.x;
    const l2 = Math.hypot(n2x, n2y) || 1;
    n1x /= l1;
    n1y /= l1;
    n2x /= l2;
    n2y /= l2;
    let nx = n1x + n2x;
    let ny = n1y + n2y;
    const ln = Math.hypot(nx, ny);
    let reach = px;
    if (ln < 0.3) {
      // Near-reversal (spike) — fall back to one edge's normal.
      nx = n1x;
      ny = n1y;
    } else {
      nx /= ln;
      ny /= ln;
      // Miter: the bisector must travel px / cos(θ/2) for both edges to end
      // up a full px out, clamped so a sharp corner can't spike.
      reach = Math.min(px / Math.max(0.34, nx * n1x + ny * n1y), px * 3);
    }
    out[i] = { x: p.x + sign * nx * reach, y: p.y + sign * ny * reach };
  }
  return out;
}

/** A confident bold outline for a CLOSED ring: repeated offset passes of the
 *  single pen, un-trimmed (a taper gap in a closed silhouette reads as a
 *  leak, not a lifted pen). `corners` are indices of true corners — the ring
 *  is split there into separate runs, because the SVG writer smooths every
 *  short-segment vertex into a curve and a building's corners must stay
 *  corners. Runs meeting at a corner misregister a hair under the wobble,
 *  exactly like hand-ruled ink. */
export function emitRing(
  out: FlowLine[],
  ring: Point[],
  layer: string,
  penWidth: number,
  passes: number,
  corners?: number[]
): void {
  const pts = ring.slice();
  if (pts.length > 1 && (pts[0].x !== pts[pts.length - 1].x || pts[0].y !== pts[pts.length - 1].y)) {
    pts.push({ ...pts[0] });
  }
  const w = Math.max(1, passes);
  for (let k = 0; k < w; k++) {
    const off = (k - (w - 1) / 2) * penWidth * 0.85;
    const pass = off === 0 ? pts : offsetPolyline(pts, off);
    if (!corners || corners.length < 2) {
      pushRun(out, pass, layer, 'bold');
      continue;
    }
    for (let c = 0; c + 1 < corners.length; c++) {
      pushRun(out, pass.slice(corners[c], corners[c + 1] + 1), layer, 'bold');
    }
  }
}

/** Emit an already-mapped (possibly curved) stroke with tapered, randomly
 *  trimmed ends and an occasional pen-lift gap — emitStroke's craft for
 *  point lists that bend through a building's spine. */
export function emitFaceStroke(out: FlowLine[], pts: Point[], layer: string, craft: FaceCraft): void {
  if (pts.length < 2) return;
  const arc: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const L = arc[arc.length - 1];
  if (L < 1.5) return;
  const maxTrim = Math.min(L * 0.35, 8) * craft.taper;
  let a = craft.rng() * maxTrim * 0.7;
  let b = L - craft.rng() * maxTrim * 0.7;
  if (b - a < 1.5) {
    a = 0;
    b = L;
  }
  const segs: [number, number][] = [];
  if (craft.taper > 0 && b - a > 16 && craft.rng() < craft.taper * 0.22) {
    const gap = 2 + craft.rng() * 4;
    const m = a + (0.4 + 0.2 * craft.rng()) * (b - a);
    segs.push([a, m - gap / 2], [m + gap / 2, b]);
  } else {
    segs.push([a, b]);
  }
  const at = (t: number): Point => {
    let i = 1;
    while (i < arc.length - 1 && arc[i] < t) i++;
    const t0 = arc[i - 1];
    const t1 = arc[i];
    const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    return { x: lerp(pts[i - 1].x, pts[i].x, f), y: lerp(pts[i - 1].y, pts[i].y, f) };
  };
  for (const [s, e] of segs) {
    if (e - s < 1.5) continue;
    const n = Math.max(1, Math.min(24, Math.round((e - s) / 9)));
    const run: Point[] = [];
    for (let i = 0; i <= n; i++) run.push(at(s + ((e - s) * i) / n));
    pushRun(out, run, layer);
  }
}

export interface WindowOptions {
  /** Window column pitch in world px. */
  pitch: number;
  /** Storey height in world px (rows follow storeys). */
  storey: number;
  /** 0..1 density knob — the probability ceiling a window exists at all. */
  density: number;
  /** Column phase 0..1 (per building, so grids don't register across towers). */
  phase: number;
  /** 'full' = the whole decay path; 'ticks' = sills only (sparse dashes). */
  style: 'full' | 'ticks';
  /** Shared mutable budget: window marks stop when the city's allowance runs out. */
  budget: { left: number };
}

/**
 * A window grid on one face. Rows sit on storeys, columns on the pitch; the
 * morph drifts rows, jitters corners, drops whole windows in noise-clumped
 * passages and decays edges — at the rigid end this is a perfect uniform
 * grid of rectangles, at the flow end drifting rows of sills and ticks, all
 * one code path.
 */
export function drawWindows(
  out: FlowLine[],
  face: Face,
  morph: Morph,
  craft: FaceCraft,
  noise: SimplexNoise,
  o: WindowOptions
): void {
  if (o.density <= 0 || o.budget.left <= 0) return;
  const H = face.z1 - face.z0;
  const insetS = Math.max(o.pitch * 0.4, face.W * 0.08);
  const usable = face.W - 2 * insetS;
  const nCols = Math.floor(usable / o.pitch);
  // Per-building floor offset: neighbours never share storey levels, or the
  // sill rows of a rigid city chain into full-width ruled lines.
  const rowOff = o.phase * 0.6 * o.storey;
  const nRows = Math.floor((H - 0.35 * o.storey - rowOff) / o.storey);
  // A grid the pen can't resolve is mud: skip sub-1px storeys outright.
  if (nCols < 1 || nRows < 1 || o.storey < 3.2) return;
  const colPitch = usable / nCols;
  const winW = 0.55 * colPitch;
  const winH = 0.45 * o.storey;
  const tickOnly = o.style === 'ticks';

  for (let r = 0; r < nRows; r++) {
    const zBase = face.z0 + rowOff + (r + 0.32) * o.storey + 0.15 * o.storey;
    // Row drift: whole rows slide off the grid at the flow end.
    const drift = morph.rowDrift * colPitch * noise.noise2D(r * 0.7 + o.phase * 19, o.phase * 43);
    for (let c = 0; c < nCols; c++) {
      if (o.budget.left <= 0) return;
      const exists = craft.rng();
      const clump = 0.5 + 0.5 * noise.noise2D(c * 0.5 + o.phase * 7, r * 0.5 - o.phase * 11);
      if (exists > o.density) continue;
      if (craft.rng() < morph.winDropout * (0.4 + 1.2 * clump)) continue;
      const s0 = insetS + c * colPitch + (colPitch - winW) / 2 + drift;
      const jit = (): number => (craft.rng() * 2 - 1) * morph.winJitter * winW;
      const sA = clamp(s0 + jit(), 1, face.W - 1);
      const sB = clamp(s0 + winW + jit(), 1, face.W - 1);
      const zA = zBase + jit() * 0.6;
      const zB = zBase + winH + jit() * 0.6;
      if (sB - sA < 0.8) continue;

      const edge = (s1: number, zz1: number, s2: number, zz2: number): void => {
        const pts: Point[] = [];
        for (let i = 0; i <= 2; i++) {
          pts.push(face.at(lerp(s1, s2, i / 2), lerp(zz1, zz2, i / 2)));
        }
        pushRun(out, pts, 'window');
        o.budget.left--;
      };
      // The sill is the last mark to go — a decayed window reads as a tick.
      if (!tickOnly && craft.rng() > morph.edgeDrop) edge(sA, zB, sB, zB); // top
      if (!tickOnly && craft.rng() > morph.edgeDrop * 0.8) edge(sA, zA, sA, zB); // left
      if (!tickOnly && craft.rng() > morph.edgeDrop * 0.8) edge(sB, zA, sB, zB); // right
      if (craft.rng() > morph.edgeDrop * 0.3) edge(sA, zA, sB, zA); // sill
    }
  }
}

export interface FaceHatchOptions {
  /** Base spacing (px) at full darkness. */
  spacing: number;
  /** 0..1 face tone (1 = darkest). */
  tone: number;
  /** Hatch angle in face space, degrees from horizontal. */
  angleDeg: number;
  /** Cross layer on top (brutalist double hatch). */
  cross: boolean;
}

/**
 * Diagonal shadow hatch across a face. The line family lives in face space —
 * `clipLineToPolygon` against the plain face rectangle — and every stroke is
 * sampled through `Face.at`, so hatch wraps a bowed tower. Tone breathes with
 * low-frequency noise and darkens toward the ground, and spacing carries the
 * lightness (paper does the work — genuinely light faces hold clean paper).
 */
export function hatchFace(
  out: FlowLine[],
  face: Face,
  morph: Morph,
  craft: FaceCraft,
  noise: SimplexNoise,
  o: FaceHatchOptions
): void {
  if (o.tone <= 0.12 || face.W < 3) return;
  const layers: { ang: number; scale: number }[] = [{ ang: o.angleDeg, scale: 1 }];
  if (o.cross) layers.push({ ang: o.angleDeg + 32, scale: 1.8 });
  const rect: Point[] = [
    { x: 0, y: face.z0 },
    { x: face.W, y: face.z0 },
    { x: face.W, y: face.z1 },
    { x: 0, y: face.z1 },
  ];
  for (const lay of layers) {
    const ang = lay.ang * DEG;
    const dir: Point = { x: Math.cos(ang), y: Math.sin(ang) };
    const nrm: Point = { x: -Math.sin(ang), y: Math.cos(ang) };
    let sMin = Infinity;
    let sMax = -Infinity;
    for (const p of rect) {
      const s = nrm.x * p.x + nrm.y * p.y;
      if (s < sMin) sMin = s;
      if (s > sMax) sMax = s;
    }
    let s = sMin + craft.rng() * o.spacing;
    let guard = 0;
    while (s <= sMax && guard++ < 900) {
      const O: Point = { x: nrm.x * s, y: nrm.y * s };
      const runs = clipLineToPolygon(rect, O, dir);
      let toneHere = o.tone;
      for (const [t0, t1] of runs) {
        const mS = O.x + dir.x * ((t0 + t1) / 2);
        const mZ = O.y + dir.y * ((t0 + t1) / 2);
        const depth = clamp01(1 - (mZ - face.z0) / Math.max(1, face.z1 - face.z0));
        toneHere = clamp01(
          o.tone * (1 + 0.2 * noise.noise2D(mS * 0.04, mZ * 0.04)) * lerp(0.85, 1.15, depth)
        );
        // Paper cutoff: a light passage holds clean paper, not faint scratches.
        if (toneHere < 0.13 + 0.04 * craft.rng()) continue;
        const n = Math.max(2, Math.min(10, Math.round((t1 - t0) / 10)));
        const pts: Point[] = [];
        const wob = (craft.rng() * 2 - 1) * craft.jitter;
        for (let i = 0; i <= n; i++) {
          const t = t0 + ((t1 - t0) * i) / n;
          // Angle jitter in face space: rotate about the run's midpoint.
          const rel = t - (t0 + t1) / 2;
          pts.push(
            face.at(
              O.x + dir.x * t - dir.y * rel * wob,
              O.y + dir.y * t + dir.x * rel * wob
            )
          );
        }
        emitFaceStroke(out, pts, 'hatch', craft);
      }
      const step = (o.spacing * lay.scale) / Math.max(0.22, toneHere);
      s += Math.max(1, step * (1 + morph.spacingVar * (craft.rng() * 2 - 1)));
    }
  }
}
