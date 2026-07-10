import type { Point } from '../flow-lines.js';
import type { SimplexNoise } from '../noise.js';
import { smoothPolyline } from '../lib/polyline.js';
import { clamp } from '../lib/math.js';
import { smoothstep01, type Spine, type SpineParams } from './types.js';

/**
 * Synthesize one confident arm movement — the "ballistic pen".
 *
 * The spine is a heading integrated with slowly-varying, single-signed
 * curvature: essentially one arc that breathes, never wiggles. Control-point
 * splines read as CAD curves and curvature sign flips read as hesitation, so
 * neither is allowed; the only exception is a single smoothstep-blended
 * reversal late in the stroke (`reverseAt`), the calligraphic "S". A closed
 * sumi enso is the same function with |κ0|·length approaching 2π — no
 * special case.
 */
export function makeSpine(params: SpineParams, noise: SimplexNoise): Spine {
  const { start, heading, length, curvature, energy, reverseAt, track } = params;
  const steps = clamp(Math.round(length / 6), 24, 96);
  const ds = length / steps;

  const raw: Point[] = [{ x: start.x, y: start.y }];
  let theta = heading;
  let x = start.x;
  let y = start.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Low-frequency drift lets the arc breathe; the base sign never changes.
    let k = curvature * (1 + 0.4 * noise.noise2D(t * 1.5, track));
    if (reverseAt > 0) {
      // One committed reversal, blended over a short window.
      const s = smoothstep01((t - reverseAt) / 0.15);
      k *= 1 - 2 * s;
    }
    theta += k * ds;
    x += Math.cos(theta) * ds;
    y += Math.sin(theta) * ds;
    raw.push({ x, y });
  }

  const points = smoothPolyline(raw, 1);

  const arc: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = arc[arc.length - 1] || 1;

  // Asymmetric speed bell: the peak sits past the midpoint, so the exit is
  // the fast end (the flick) and the entry is the press.
  const skew = 0.8 + 0.5 * energy;
  const speed = points.map((_, i) => {
    const t = arc[i] / total;
    return Math.pow(Math.sin(Math.PI * Math.pow(t, skew)), 0.75);
  });

  return { points, speed, arc, length: total };
}

/** Area centroid (by vertex mean — spines are evenly sampled) of a spine. */
export function spineCentroid(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

/** Translate a spine in place so its centroid lands on `target`. */
export function moveSpineTo(spine: Spine, target: Point): void {
  const c = spineCentroid(spine.points);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  for (const p of spine.points) {
    p.x += dx;
    p.y += dy;
  }
}

/** Exit point and tangent (radians) of a spine — where the flick releases. */
export function spineExit(spine: Spine): { point: Point; tangent: number } {
  const pts = spine.points;
  const last = pts[pts.length - 1];
  const prev = pts[Math.max(0, pts.length - 3)];
  return { point: last, tangent: Math.atan2(last.y - prev.y, last.x - prev.x) };
}
