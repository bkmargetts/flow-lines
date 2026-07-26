import type { Point } from '../flow-lines.js';
import { hatchConvex } from './hatch.js';

/** The fill-texture vocabulary each cell draws from — the dense, varied
 *  patchwork that makes the mosaic read as fabric rather than empty frames.
 *  Every texture is plain stroked polylines clipped to the (convex) cell. */
export const TEXTURES = [
  'hatch',
  'crosshatch',
  'lines-h',
  'lines-v',
  'dots',
  'waves',
  'zigzag',
  'scales',
] as const;
export type Texture = (typeof TEXTURES)[number];

/** Clip a horizontal-ish sample line y=f(x) to a convex ring by walking its
 *  samples and keeping the inside runs. Cheap and robust for dense fills. */
function clipSampled(poly: Point[], samples: Point[]): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  for (const p of samples) {
    if (pointInConvex(poly, p.x, p.y)) {
      run.push(p);
    } else if (run.length > 1) {
      out.push(run);
      run = [];
    } else {
      run = [];
    }
  }
  if (run.length > 1) out.push(run);
  return out;
}

function pointInConvex(poly: Point[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function bbox(poly: Point[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** A tiny ring that plots as a dot. */
function dotAt(cx: number, cy: number, r: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/**
 * Render one texture into a convex closed ring. `spacing` is the pattern
 * pitch; `rng` supplies per-cell phase/angle so no two cells register.
 * Sampled curves (waves, zigzag, scales) are clipped by inside-runs — the
 * pen simply lifts at the cell border.
 */
export function textureFill(
  poly: Point[],
  texture: Texture,
  spacing: number,
  penWidth: number,
  rng: () => number
): Point[][] {
  const { x0, y0, x1, y1 } = bbox(poly);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < spacing || h < spacing) return [];
  const inset = penWidth;
  const step = Math.max(0.75, penWidth);
  const phase = rng() * spacing;

  switch (texture) {
    case 'hatch': {
      const angle = (rng() < 0.5 ? 1 : -1) * (Math.PI / 4 + (rng() - 0.5) * 0.5);
      return hatchConvex(poly, angle, spacing, inset);
    }
    case 'crosshatch': {
      const angle = Math.PI / 4 + (rng() - 0.5) * 0.4;
      return [
        ...hatchConvex(poly, angle, spacing * 1.4, inset),
        ...hatchConvex(poly, angle + Math.PI / 2, spacing * 1.4, inset),
      ];
    }
    case 'lines-h':
      return hatchConvex(poly, 0, spacing, inset);
    case 'lines-v':
      return hatchConvex(poly, Math.PI / 2, spacing, inset);
    case 'dots': {
      const out: Point[][] = [];
      const pitch = spacing * 1.5;
      const r = Math.max(0.4, penWidth * 0.4);
      for (let y = y0 + phase; y < y1; y += pitch) {
        for (let x = x0 + phase; x < x1; x += pitch) {
          if (pointInConvex(poly, x, y)) out.push(dotAt(x, y, r));
        }
      }
      return out;
    }
    case 'waves': {
      const out: Point[][] = [];
      const amp = spacing * 0.35;
      const wl = spacing * 3;
      for (let y = y0 + phase; y < y1; y += spacing) {
        const samples: Point[] = [];
        for (let x = x0; x <= x1; x += step) {
          samples.push({ x, y: y + amp * Math.sin(((x - x0) / wl) * Math.PI * 2 + phase) });
        }
        out.push(...clipSampled(poly, samples));
      }
      return out;
    }
    case 'zigzag': {
      const out: Point[][] = [];
      const amp = spacing * 0.4;
      const wl = spacing * 1.6;
      for (let y = y0 + phase; y < y1; y += spacing) {
        const samples: Point[] = [];
        for (let x = x0; x <= x1; x += step) {
          const t = ((x - x0) / wl) % 1;
          samples.push({ x, y: y + amp * (2 * Math.abs(2 * t - 1) - 1) });
        }
        out.push(...clipSampled(poly, samples));
      }
      return out;
    }
    case 'scales': {
      // Rows of overlapping half-circle arcs — the fish-scale fill.
      const out: Point[][] = [];
      const pitch = spacing * 1.6;
      const r = pitch * 0.55;
      let row = 0;
      for (let y = y0 + phase; y < y1 + r; y += pitch * 0.62) {
        const offset = row % 2 === 0 ? 0 : pitch / 2;
        for (let cx = x0 - pitch + offset; cx < x1 + pitch; cx += pitch) {
          const samples: Point[] = [];
          for (let a = 0; a <= 12; a++) {
            const th = Math.PI + (a / 12) * Math.PI;
            samples.push({ x: cx + r * Math.cos(th), y: y - r * Math.sin(th) });
          }
          out.push(...clipSampled(poly, samples));
        }
        row++;
      }
      return out;
    }
  }
}
