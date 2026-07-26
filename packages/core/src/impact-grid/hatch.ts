import type { Point } from '../flow-lines.js';

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
