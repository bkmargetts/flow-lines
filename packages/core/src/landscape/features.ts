import { FlowLine, Point } from '../flow-lines.js';
import { pointInPolygon } from '../lib/polyline.js';
import { lerp } from '../lib/math.js';
import { TAU, pushRun, sampleProfileY } from './hatching.js';

/** Closed region polygon from an upper (L→R) and lower (L→R) boundary. */
export function closeRegion(upper: Point[], lower: Point[]): Point[] {
  const poly = upper.slice();
  for (let i = lower.length - 1; i >= 0; i--) poly.push(lower[i]);
  return poly;
}

/** A small rough rock silhouette centred at (cx, baseY): 6–9 vertices along an
 *  off-centre peak envelope, occasionally with a second lump — the fixed
 *  5-point version stamped identical tents across the water. */
export function rockShape(cx: number, baseY: number, w: number, h: number, rng: () => number): Point[] {
  const left = cx - w / 2;
  const tStar = 0.3 + 0.4 * rng(); // dominant apex position
  const twin = rng() < 0.35;
  const t2 = tStar < 0.5 ? 0.68 + 0.2 * rng() : 0.12 + 0.2 * rng();
  const twinH = 0.3 + 0.25 * rng();
  const n = 6 + Math.floor(rng() * 4);
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Piecewise peak envelope with jitter; faceted rather than smooth.
    let env = t <= tStar ? t / Math.max(0.05, tStar) : (1 - t) / Math.max(0.05, 1 - tStar);
    env = Math.pow(Math.max(0, env), 0.7);
    if (twin) env = Math.max(env, twinH * Math.exp(-Math.pow((t - t2) / 0.14, 2)));
    if (i > 0 && i < n) env *= 0.82 + 0.36 * rng();
    pts.push({ x: left + t * w + (i > 0 && i < n ? (rng() - 0.5) * (w / n) * 0.6 : 0), y: baseY - h * env });
  }
  return pts;
}

// ——————————————————————————————————————————————————————————————————————
// Occlusion (vector painter's algorithm)
// ——————————————————————————————————————————————————————————————————————

/** Parameter t along a→b where it crosses segment c→d, or null. Half-open on the
 *  edge (u in [0,1)) so a shared vertex isn't double-counted. */
function segSegT(a: Point, b: Point, c: Point, d: Point): number | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  if (t > 1e-9 && t < 1 - 1e-9 && u >= 0 && u < 1) return t;
  return null;
}

/** The runs of a polyline lying OUTSIDE a closed polygon — each sub-segment is
 *  classified by its own midpoint, so it is robust to vertex/edge degeneracies. */
export function subtractPolygon(points: Point[], poly: Point[]): Point[][] {
  if (points.length < 2) return points.length ? [points.slice()] : [];
  const runs: Point[][] = [];
  let run: Point[] = [];
  const flush = (): void => {
    if (run.length >= 2) runs.push(run);
    run = [];
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ts: number[] = [0, 1];
    for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
      const t = segSegT(a, b, poly[k], poly[j]);
      if (t !== null) ts.push(t);
    }
    ts.sort((p, q) => p - q);
    for (let s = 0; s < ts.length - 1; s++) {
      const t0 = ts[s];
      const t1 = ts[s + 1];
      if (t1 - t0 < 1e-7) continue;
      const mid = (t0 + t1) / 2;
      if (pointInPolygon(poly, a.x + (b.x - a.x) * mid, a.y + (b.y - a.y) * mid)) {
        flush();
        continue;
      }
      const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
      const p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };
      if (run.length === 0) run.push(p0);
      else if (Math.hypot(p0.x - run[run.length - 1].x, p0.y - run[run.length - 1].y) > 1e-6) {
        flush();
        run.push(p0);
      }
      run.push(p1);
    }
  }
  flush();
  return runs;
}

/** Remove the parts of already-drawn strokes that fall behind an opaque mass
 *  `poly` (drawn back-to-front, so the mass occludes everything before it).
 *  Bounding-box culled, so most strokes pass straight through. */
export function occludeBehind(lines: FlowLine[], poly: Point[]): FlowLine[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const out: FlowLine[] = [];
  for (const ln of lines) {
    let lx0 = Infinity;
    let ly0 = Infinity;
    let lx1 = -Infinity;
    let ly1 = -Infinity;
    for (const p of ln.points) {
      if (p.x < lx0) lx0 = p.x;
      if (p.x > lx1) lx1 = p.x;
      if (p.y < ly0) ly0 = p.y;
      if (p.y > ly1) ly1 = p.y;
    }
    if (lx1 < minX || lx0 > maxX || ly1 < minY || ly0 > maxY) {
      out.push(ln);
      continue;
    }
    const runs = subtractPolygon(ln.points, poly);
    if (runs.length === 1 && runs[0].length === ln.points.length) out.push(ln);
    else for (const r of runs) if (r.length >= 2) out.push({ ...ln, points: r });
  }
  return out;
}

/** Small trees with a short trunk and a lumpy rounded canopy, set along a crest
 *  profile. The canopy is a single closed scalloped outline (a few interior
 *  shading strokes), so it reads as a tree rather than a scribble. */
export function drawTrees(out: FlowLine[], crest: Point[], count: number, usableW: number, rng: () => number): void {
  const x0 = crest[0].x;
  const x1 = crest[crest.length - 1].x;
  for (let i = 0; i < count; i++) {
    const x = lerp(x0 + usableW * 0.05, x1 - usableW * 0.05, rng());
    const baseY = sampleProfileY(crest, x);
    const s = usableW * (0.022 + rng() * 0.016);
    const cy = baseY - s * 1.7;
    const rx = s * 0.85;
    const ry = s * 1.0;
    // Trunk.
    pushRun(out, [{ x, y: baseY }, { x, y: cy + ry * 0.6 }], 'tree');
    // Lumpy canopy outline: an ellipse roughened by a few low-frequency bumps.
    const segs = 30;
    const bumps = 4 + Math.floor(rng() * 3);
    const phase = rng() * TAU;
    const canopy: Point[] = [];
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * TAU;
      const lump = 1 + 0.16 * Math.sin(a * bumps + phase);
      canopy.push({ x: x + Math.cos(a) * rx * lump, y: cy + Math.sin(a) * ry * lump });
    }
    pushRun(out, canopy, 'tree');
    // A couple of short interior shading flicks.
    for (let b = 0; b < 2; b++) {
      const ax = x + (rng() - 0.5) * rx;
      const ay = cy + (rng() - 0.2) * ry * 0.6;
      pushRun(out, [{ x: ax, y: ay }, { x: ax + rx * 0.3, y: ay + ry * 0.4 }], 'tree');
    }
  }
}
