import type { Point } from '../flow-lines.js';

/**
 * Fill a convex closed ring with nested copies shrunk toward the centroid —
 * the classic plotter "solid" that keeps every stroke a closed shape. The
 * scale step is chosen so ring gap ≈ `spacing` at the tightest edge
 * (inradius = min centroid→edge distance); rings stop once they'd collapse
 * below the pen's resolving power.
 */
export function concentricFill(poly: Point[], spacing: number, penWidth: number): Point[][] {
  if (poly.length < 4) return [];
  const n = poly.length - 1;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += poly[i].x;
    cy += poly[i].y;
  }
  cx /= n;
  cy /= n;
  let inradius = Infinity;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    const dist = Math.abs(ex * (cy - a.y) - ey * (cx - a.x)) / len;
    if (dist < inradius) inradius = dist;
  }
  if (!(inradius > spacing)) return [];
  const out: Point[][] = [];
  for (let s = 1 - spacing / inradius; s * inradius > penWidth; s -= spacing / inradius) {
    out.push(poly.map((p) => ({ x: cx + (p.x - cx) * s, y: cy + (p.y - cy) * s })));
  }
  return out;
}

/**
 * Hatch-fill a convex closed ring with parallel lines at `angle`, `spacing`
 * apart, each span pulled in from the outline by `inset` so the fill never
 * kisses the wobbled edge. Convexity means every scanline crosses the ring at
 * most twice — one clean span per line, no even-odd bookkeeping.
 */
export function hatchConvex(
  poly: Point[],
  angle: number,
  spacing: number,
  inset: number
): Point[][] {
  if (poly.length < 4) return [];
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  // Rotate into a frame where hatch lines are horizontal.
  const local = poly.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of local) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const out: Point[][] = [];
  const cosB = Math.cos(angle);
  const sinB = Math.sin(angle);
  for (let y = minY + spacing / 2; y < maxY; y += spacing) {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let i = 0; i < local.length - 1; i++) {
      const a = local[i];
      const b = local[i + 1];
      if ((a.y <= y) === (b.y <= y)) continue;
      const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
    if (x1 - x0 < inset * 2) continue;
    const start = { x: (x0 + inset) * cosB - y * sinB, y: (x0 + inset) * sinB + y * cosB };
    const end = { x: (x1 - inset) * cosB - y * sinB, y: (x1 - inset) * sinB + y * cosB };
    out.push([start, end]);
  }
  return out;
}
