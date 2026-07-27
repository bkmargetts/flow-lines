import type { Point } from '../flow-lines.js';
import { clamp01 } from '../lib/math.js';
import { smoothstep } from '../lib/spatial.js';
import { createNoise } from '../noise.js';
import type { PathField } from './impact.js';

/** One sample of the pane-wide displacement field. */
export interface DriftSample {
  dx: number;
  dy: number;
  /** Field strength 0..1 at this point — rotation/alignment scale from it. */
  f: number;
  /** Path tangent (unit, direction of travel) at the nearest point. */
  tx: number;
  ty: number;
  /** Which side of the path this point sits on (±1). */
  side: number;
}

export interface DriftField {
  at(x: number, y: number): DriftSample;
  /** Beyond this distance from the path, at() is exactly zero. */
  range: number;
}

const ZERO: DriftSample = { dx: 0, dy: 0, f: 0, tx: 1, ty: 0, side: 1 };

/**
 * The smooth displacement the stroke drags through the pane: material is
 * advected predominantly ALONG the direction of travel (laminar drifts —
 * neighbouring cells move together, the way whole neighbourhoods shear off
 * in the reference plates) plus a lateral push that parts the material away
 * from the channel. Coherence comes from one low-frequency noise shared by
 * every query — never per-cell randomness — so the motion reads as flow,
 * not confetti. Intact cells, cracked facets, and shards all ride the same
 * field; shards add their own ballistic scatter on top.
 */
export function makeDrift(
  field: PathField,
  radius: number,
  o: { drift: number; energy: number; seed: number }
): DriftField {
  const range = radius * (0.85 + 0.75 * o.drift);
  const noise = createNoise(o.seed);
  const k = 1.4 / range;
  const at = (x: number, y: number): DriftSample => {
    const hit = field.nearest(x, y);
    if (hit.d >= range) return ZERO;
    // Cubic falloff: the drag concentrates hard on the channel so the far
    // field keeps its pristine order — the reference panes stand still at
    // their ends.
    const g = smoothstep(clamp01(1 - hit.d / range));
    const f = g * g * g;
    // Laminar variation: broad patches travel farther than their
    // neighbours, but the gradient is gentle — coherent, not scattered.
    const coh = 0.55 + 0.45 * clamp01(0.5 + 0.5 * noise.fbm(x * k, y * k, 2, 0.5, 2));
    const speed = 0.35 + 0.65 * hit.speed;
    const advect = o.drift * radius * (0.5 + 0.85 * o.energy) * f * coh * speed;
    const lateral = o.drift * radius * 0.22 * f * g;
    return {
      dx: advect * hit.tx + lateral * hit.side * -hit.ty,
      dy: advect * hit.ty + lateral * hit.side * hit.tx,
      f,
      tx: hit.tx,
      ty: hit.ty,
      side: hit.side,
    };
  };
  return { at, range };
}

/**
 * Map a polyline through the field point-wise, densifying first so straight
 * spans can genuinely bend. This is how big panels near the channel warp —
 * their hatch lines curving with the dragged material — instead of rigidly
 * rotating. Callers skip it entirely for geometry far outside `range`.
 *
 * The anchor (ax, ay) is the field at the parent cell's centre; each point
 * moves by anchor + a SOFT-CLAMPED deviation, so a cell bends by at most
 * ~`maxDev` beyond its rigid ride. Without the clamp, cells straddling the
 * path's medial axis (where the nearest segment — and so the advect
 * direction — flips) smear into taffy ribbons.
 */
export function warpPolyline(
  points: Point[],
  drift: DriftField,
  step: number,
  ax: number,
  ay: number,
  maxDev: number
): Point[] {
  const out: Point[] = [];
  const pushWarped = (p: Point) => {
    const u = drift.at(p.x, p.y);
    let devX = u.dx - ax;
    let devY = u.dy - ay;
    const dev = Math.hypot(devX, devY);
    if (dev > 1e-9) {
      const s = 1 / (1 + dev / maxDev);
      devX *= s;
      devY *= s;
    }
    out.push({ x: p.x + ax + devX, y: p.y + ay + devY });
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    pushWarped(a);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.floor(len / step);
    for (let j = 1; j <= n; j++) {
      const t = j / (n + 1);
      pushWarped({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  pushWarped(points[points.length - 1]);
  return out;
}
