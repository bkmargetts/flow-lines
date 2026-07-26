import type { Point } from '../flow-lines.js';

/**
 * Sutherland–Hodgman against a single half-plane: keep the part of the closed
 * convex ring on the `(p - a) · n <= 0` side, interpolating crossing points.
 * Input and output rings repeat the first point at the end. A convex input
 * stays convex, so repeated chord splits only ever produce convex fragments.
 */
export function clipHalfPlane(poly: Point[], a: Point, n: Point): Point[] {
  if (poly.length < 4) return [];
  const open = poly.slice(0, -1);
  const out: Point[] = [];
  for (let i = 0; i < open.length; i++) {
    const p = open[i];
    const q = open[(i + 1) % open.length];
    const dp = (p.x - a.x) * n.x + (p.y - a.y) * n.y;
    const dq = (q.x - a.x) * n.x + (q.y - a.y) * n.y;
    if (dp <= 0) out.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  if (out.length < 3) return [];
  return [...out, { x: out[0].x, y: out[0].y }];
}

/** Shoelace area of a closed ring (absolute). */
export function ringArea(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    sum += poly[i].x * poly[i + 1].y - poly[i + 1].x * poly[i].y;
  }
  return Math.abs(sum) / 2;
}

function centroidOf(poly: Point[]): Point {
  let x = 0;
  let y = 0;
  const n = poly.length - 1;
  for (let i = 0; i < n; i++) {
    x += poly[i].x;
    y += poly[i].y;
  }
  return { x: x / n, y: y / n };
}

export interface FragmentOptions {
  /** Falloff at the parent square's centre (0..1). */
  f: number;
  /** Parent push direction (unit). */
  ux: number;
  uy: number;
  /** Parent centre displacement — fragments inherit it before scattering. */
  dx: number;
  dy: number;
  radius: number;
  shatter: number;
  scatter: number;
  debris: number;
  /** Distance from the parent centre to the path, px. */
  d: number;
  penWidth: number;
}

/**
 * Break one square (already a closed ring in page space, at its final resting
 * pose *before* the parent displacement is applied) into convex fragments and
 * scatter them as debris: 1..3 random interior-biased chords split the square,
 * each shard shrinks a little toward its centroid (gaps open — broken, not
 * just cracked), flies outward along the push direction with jitter, and
 * spins. The innermost shards may be dropped entirely — pulverised.
 */
export function shatterSquare(
  square: Point[],
  half: number,
  o: FragmentOptions,
  rng: () => number
): Point[][] {
  const cuts = Math.min(3, 1 + Math.floor(rng() * 2 + o.shatter * 1.5));
  let fragments: Point[][] = [square];
  const centre = centroidOf(square);
  for (let c = 0; c < cuts; c++) {
    const px = centre.x + (2 * rng() - 1) * 0.5 * half;
    const py = centre.y + (2 * rng() - 1) * 0.5 * half;
    const alpha = rng() * Math.PI;
    const n = { x: -Math.sin(alpha), y: Math.cos(alpha) };
    const next: Point[][] = [];
    for (const frag of fragments) {
      const a = clipHalfPlane(frag, { x: px, y: py }, n);
      const b = clipHalfPlane(frag, { x: px, y: py }, { x: -n.x, y: -n.y });
      if (a.length >= 4) next.push(a);
      if (b.length >= 4) next.push(b);
    }
    fragments = next;
  }

  const minArea = (2 * o.penWidth) * (2 * o.penWidth);
  const shatterRadius = o.radius * (0.2 + 0.5 * o.shatter);
  const out: Point[][] = [];
  for (const frag of fragments) {
    if (ringArea(frag) < minArea) continue;
    // Pulverised core: the closest shards lose mass entirely.
    if (o.d < 0.35 * shatterRadius && rng() < o.debris * o.f) continue;
    const g = centroidOf(frag);
    const swing = (2 * rng() - 1) * (30 * Math.PI / 180);
    const cosS = Math.cos(swing);
    const sinS = Math.sin(swing);
    const vx = o.ux * cosS - o.uy * sinS;
    const vy = o.ux * sinS + o.uy * cosS;
    const throwDist = o.scatter * 0.4 * o.radius * o.f * o.f * (0.4 + 0.6 * rng());
    const spin = (2 * rng() - 1) * ((20 + 45 * o.shatter) * Math.PI / 180) * o.f;
    const cosR = Math.cos(spin);
    const sinR = Math.sin(spin);
    const gx = g.x + o.dx + throwDist * vx;
    const gy = g.y + o.dy + throwDist * vy;
    out.push(
      frag.map((p) => {
        // Shrink toward the centroid, spin about it, then translate to the
        // scattered position.
        const lx = (p.x - g.x) * 0.9;
        const ly = (p.y - g.y) * 0.9;
        return { x: gx + lx * cosR - ly * sinR, y: gy + lx * sinR + ly * cosR };
      })
    );
  }
  return out;
}
