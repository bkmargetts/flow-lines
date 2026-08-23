import { Point } from '../flow-lines.js';

/**
 * The terraces dash/taper mark idiom, shared by the agent laminae and the
 * cross-section bed fills. (Originally duplicated from the closures inside
 * lapidary/textures.ts fillRegion — trimRunEnds / dashPolyline — which
 * aren't exported; re-scaled to cells.) Every function draws from the rng it
 * is handed in a fixed order, so callers own their stream.
 */

export function arcLengths(pts: Point[]): number[] {
  const cum: number[] = new Array(pts.length);
  cum[0] = 0;
  for (let i = 1; i < pts.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return cum;
}

export function sliceAt(pts: Point[], cum: number[], sa: number, sb: number): Point[] {
  const at = (s: number): Point => {
    let i = 1;
    while (i < pts.length - 1 && cum[i] < s) i++;
    const span = cum[i] - cum[i - 1] || 1;
    const f = (s - cum[i - 1]) / span;
    return {
      x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
      y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
    };
  };
  const out: Point[] = [at(sa)];
  for (let i = 0; i < pts.length; i++) {
    if (cum[i] > sa && cum[i] < sb) out.push(pts[i]);
  }
  out.push(at(sb));
  return out;
}

/** Seeded arc-length end shave so a run stops like a lifting pen. */
export function trimEnds(pts: Point[], rng: () => number, cellSize: number, taper: number): Point[] {
  if (taper <= 0 || pts.length < 3) return pts;
  const cum = arcLengths(pts);
  const total = cum[pts.length - 1];
  if (total < cellSize) return pts;
  const maxTrim = Math.min(total * 0.35, cellSize * 1.6) * taper;
  const a = rng() * maxTrim * 0.7;
  const b = total - rng() * maxTrim * 0.7;
  if (b - a < cellSize * 0.3) return pts;
  return sliceAt(pts, cum, a, b);
}

/** Translate a dash a hair off its chord so nested laminae pieces don't
 *  register into one unbroken line. */
export function staggered(pts: Point[], rng: () => number, staggerPx: number): Point[] {
  if (pts.length < 2) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-6) return pts;
  const off = (rng() * 2 - 1) * staggerPx;
  const ox = (-(b.y - a.y) / len) * off;
  const oy = ((b.x - a.x) / len) * off;
  return pts.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

export interface DashOptions {
  cellSize: number;
  taper: number;
  continuous: boolean;
}

/** Hand-fed dashing: chop a run into dashes with small pen-lift gaps at
 *  irregular heights; short runs stay whole (dashing them leaves confetti). */
export function dashRuns(pts: Point[], rng: () => number, opts: DashOptions): Point[][] {
  const { cellSize, taper, continuous } = opts;
  if (continuous) return [trimEnds(pts, rng, cellSize, taper)];
  const cum = arcLengths(pts);
  const total = cum[pts.length - 1];
  if (total <= cellSize * 6) return [trimEnds(pts, rng, cellSize, taper)];
  const out: Point[][] = [];
  let s = 0;
  let guard = 0;
  while (s < total - cellSize * 0.3 && guard++ < 200) {
    const e = Math.min(total, s + cellSize * (3.5 + 5 * rng()));
    out.push(staggered(trimEnds(sliceAt(pts, cum, s, e), rng, cellSize, taper), rng, cellSize * 0.06));
    s = e + cellSize * (0.4 + 0.5 * rng());
  }
  return out;
}
