import type { Point } from '../flow-lines.js';
import { pointInPolygon } from '../lib/polyline.js';
import { makeRandom } from '../lib/rng.js';

const TAU = Math.PI * 2;

/**
 * Placement region for the stick-men crowd, in NORMALIZED drawable-box
 * coordinates: (0,0) = top-left of the margin box, (1,1) = bottom-right.
 * The region confines figure ground anchors (the feet); bodies rise above
 * the region's top edge naturally — a crowd filling a heart is a heart of
 * feet with heads fringing the top, which is the correct drawn look.
 *
 * Normalized x scales by the box width and y by the box height, so an
 * ellipse with rx === ry is circular only on a square box — callers that
 * want circular shapes on any page compensate by aspect (the web UI sizes
 * from min(boxW, boxH) and divides per-axis). The `ring` is the exception:
 * its radii are fractions of the smaller box dimension, so it is always
 * circular. The preset polygon builders below take separate rx/ry for the
 * same reason.
 */
export type StickmenRegion =
  | { kind: 'full' } // legacy overflowing ground — identical to region: undefined
  | { kind: 'rect'; cx: number; cy: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'ring'; cx: number; cy: number; rOuter: number; rInner: number }
  | { kind: 'polygon'; points: Point[] };

/** A region compiled to page px: a containment test plus its page bbox. */
export interface PageRegion {
  contains(x: number, y: number): boolean;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface Frame {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Compile a normalized region against the drawable box. Returns null for
 * 'full' (callers treat that exactly like no region at all).
 */
export function compileRegion(region: StickmenRegion, frame: Frame): PageRegion | null {
  const bw = frame.x1 - frame.x0;
  const bh = frame.y1 - frame.y0;
  const px = (nx: number): number => frame.x0 + nx * bw;
  const py = (ny: number): number => frame.y0 + ny * bh;

  switch (region.kind) {
    case 'full':
      return null;
    case 'rect': {
      const cx = px(region.cx);
      const cy = py(region.cy);
      const hw = Math.abs((region.w / 2) * bw);
      const hh = Math.abs((region.h / 2) * bh);
      return {
        contains: (x, y) => Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh,
        bbox: { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh },
      };
    }
    case 'ellipse': {
      const cx = px(region.cx);
      const cy = py(region.cy);
      const rx = Math.abs(region.rx * bw);
      const ry = Math.abs(region.ry * bh);
      return {
        contains: (x, y) => {
          if (rx <= 0 || ry <= 0) return false;
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          return dx * dx + dy * dy <= 1;
        },
        bbox: { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry },
      };
    }
    case 'ring': {
      // Radii are fractions of the smaller box dimension so a ring is a
      // true circle on any page aspect.
      const cx = px(region.cx);
      const cy = py(region.cy);
      const m = Math.min(bw, bh);
      const rO = Math.abs(region.rOuter * m);
      const rI = Math.min(Math.abs(region.rInner * m), rO);
      return {
        contains: (x, y) => {
          if (rO <= 0) return false;
          const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          return d2 <= rO * rO && d2 >= rI * rI;
        },
        bbox: { x0: cx - rO, y0: cy - rO, x1: cx + rO, y1: cy + rO },
      };
    }
    case 'polygon': {
      const poly = region.points.map((p) => ({ x: px(p.x), y: py(p.y) }));
      if (poly.length < 3) return { contains: () => false, bbox: { ...frame } };
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const p of poly) {
        if (p.x < x0) x0 = p.x;
        if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.y > y1) y1 = p.y;
      }
      return {
        contains: (x, y) => pointInPolygon(poly, x, y),
        bbox: { x0, y0, x1, y1 },
      };
    }
  }
}

/** A `points`-pointed star (point up), outer radius rx/ry, inner radius a
 *  fraction `inner` of the outer. Normalized coords. */
export function starRegion(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  inner = 0.5,
  points = 5
): StickmenRegion {
  const n = Math.max(3, Math.round(points));
  const k = Math.min(Math.max(inner, 0.05), 0.95);
  const pts: Point[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? 1 : k;
    pts.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  }
  return { kind: 'polygon', points: pts };
}

/** The classic parametric heart, sampled as a polygon. rx/ry are the
 *  half-extents; the lobes fill rx and the tip reaches ry. */
export function heartRegion(cx: number, cy: number, rx: number, ry: number): StickmenRegion {
  const N = 64;
  const pts: Point[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    // x ∈ [-16,16], y ∈ [-17,12] (y up); normalize by 17 and flip y for the page.
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x: cx + (hx / 17) * rx, y: cy - (hy / 17) * ry });
  }
  return { kind: 'polygon', points: pts };
}

/** An axis-aligned diamond (rhombus) with half-extents rx/ry. */
export function diamondRegion(cx: number, cy: number, rx: number, ry: number): StickmenRegion {
  return {
    kind: 'polygon',
    points: [
      { x: cx, y: cy - ry },
      { x: cx + rx, y: cy },
      { x: cx, y: cy + ry },
      { x: cx - rx, y: cy },
    ],
  };
}

/**
 * A seeded organic blob: unit radius modulated by low-order harmonics
 * (k = 2..4) with seeded amplitudes/phases — always closed and simple for
 * irregularity ≲ 0.6. Deterministic per seed.
 */
export function blobRegion(
  seed: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  irregularity = 0.45
): StickmenRegion {
  const rng = makeRandom(seed);
  const irr = Math.min(Math.max(irregularity, 0), 0.6);
  const amps: number[] = [];
  const phases: number[] = [];
  for (let k = 0; k < 3; k++) {
    amps.push(rng() / (k + 2)); // 1/k falloff keeps low harmonics dominant
    phases.push(rng() * TAU);
  }
  const N = 48;
  const pts: Point[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let r = 1;
    for (let k = 0; k < 3; k++) r += irr * amps[k] * Math.sin((k + 2) * a + phases[k]);
    pts.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  }
  return { kind: 'polygon', points: pts };
}
