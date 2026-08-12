import { Point } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { clamp } from '../lib/math.js';
import { pointInPolygon } from '../lib/polyline.js';
import type { ToneFn } from '../landscape/hatching.js';
import type { Region, RegionRadial } from './layout.js';

/**
 * Within-region tone: the internal tonal idea each band carries — the thing
 * that separates a drawn agate from a screen-printed one. The shape function
 * returns 0..1 with 0.5 neutral; `buildRegionTone` maps it through the
 * band's tone strength into a darkness field consumed by the fills (tight
 * rows where dark, open where light).
 *
 * The output is floored well above the fills' paper cutoffs: tone shades a
 * band, it never opens paper inside one — reserved paper stays exclusively
 * the seams' job.
 */

/** Darkness floor/ceiling: at full strength row pitch swings ≈ ×0.5 (dense)
 *  to ×2 (open) through the `spacing / tone` stepping law. */
const TONE_FLOOR = 0.25;

/** Sheet-wide lighting shape: one tonal idea over the whole page, layered
 *  onto every band's own tone so the piece reads as one lit object. */
export type LapidarySheetTone = 'none' | 'light' | 'vignette';

export interface SheetToneSpec {
  shape: LapidarySheetTone;
  /** 0..1, same scale as the per-band tone strength. */
  strength: number;
  /** Direction the light comes from, radians ('light' shape). */
  angleRad: number;
  /** The margin rect the ramp spans. */
  rect: { x0: number; y0: number; x1: number; y1: number };
  /** Vignette focus in page px (the composition centre). */
  focusX: number;
  focusY: number;
}

/**
 * Page-space darkness *offset* (0-centred, unlike the region maps' absolute
 * darkness), or null when off. The offset shares the regional map's gain so
 * both layers speak the same unit; `buildRegionTone` adds it under the
 * common floor — sheet tone shades bands, it never opens paper.
 */
export function buildSheetTone(spec: SheetToneSpec): ToneFn | null {
  if (spec.shape === 'none' || spec.strength <= 0) return null;
  const s = clamp(spec.strength, 0, 1);
  const { x0, y0, x1, y1 } = spec.rect;
  const offset = (shape01: number): number => s * (shape01 - 0.5) * 1.4;

  if (spec.shape === 'light') {
    // One planar ramp across the whole page — the flank facing the light
    // lightens, the far flank darkens (the regional 'light' sign convention,
    // judged from the page centre instead of each region's own centroid).
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const lx = Math.cos(spec.angleRad);
    const ly = Math.sin(spec.angleRad);
    // Half-extent along the light axis, so the far corner reaches full swing.
    const extent = Math.max(1e-6, (Math.abs(lx) * (x1 - x0) + Math.abs(ly) * (y1 - y0)) / 2);
    return (x, y) =>
      offset(0.5 - 0.5 * clamp(((x - cx) * lx + (y - cy) * ly) / extent, -1, 1));
  }

  // 'vignette': light at the composition centre, dark at the page rim,
  // neutral at half-radius.
  const fx = spec.focusX;
  const fy = spec.focusY;
  const rMax = Math.max(
    1e-6,
    Math.hypot(x0 - fx, y0 - fy),
    Math.hypot(x1 - fx, y0 - fy),
    Math.hypot(x0 - fx, y1 - fy),
    Math.hypot(x1 - fx, y1 - fy)
  );
  return (x, y) => offset(clamp(Math.hypot(x - fx, y - fy) / rMax, 0, 1));
}

/** Interpolated per-θ boundary multiplier of a radial region at angle θ. */
function tableAt(radial: RegionRadial, theta: number): number {
  const n = radial.table.length;
  const f = (((theta / (Math.PI * 2)) * n) % n + n) % n;
  const j = Math.floor(f);
  return radial.table[j] + (radial.table[(j + 1) % n] - radial.table[j]) * (f - j);
}

/** Signed radial px distance from p to the radial's boundary: positive
 *  inside (below the boundary), negative outside. */
function radialInset(radial: RegionRadial, x: number, y: number): number {
  const ex = (x - radial.cx) / radial.rx;
  const ey = (y - radial.cy) / radial.ry;
  const r = Math.hypot(ex, ey);
  const theta = Math.atan2(ey, ex);
  const baseLen = Math.hypot(Math.cos(theta) * radial.rx, Math.sin(theta) * radial.ry) || 1e-6;
  return (tableAt(radial, theta) - r) * baseLen;
}

/** Linear-interpolated y of a left→right profile at x (clamped ends). */
function profileY(profile: Point[], x: number): number {
  if (x <= profile[0].x) return profile[0].y;
  const last = profile[profile.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].x >= x) {
      const a = profile[i - 1];
      const b = profile[i];
      const f = (x - a.x) / Math.max(1e-6, b.x - a.x);
      return a.y + (b.y - a.y) * f;
    }
  }
  return last.y;
}

/** Distance from p to the nearest seam of this region, in px — analytic per
 *  region type, no SDF raster. Returns null when the region has no seam
 *  geometry to measure against (e.g. the spiral field). */
function seamDistanceFn(region: Region): ((x: number, y: number) => number) | null {
  if (region.radial) {
    const own = region.radial;
    const inner = region.innerRadial;
    return (x, y) => {
      const d = Math.max(0, radialInset(own, x, y));
      if (!inner) return d;
      // The ring's second seam: distance outward past the inner neighbour's
      // boundary (both tables share the ellipse frame).
      return Math.min(d, Math.max(0, -radialInset(inner, x, y)));
    };
  }
  if (region.fieldRefs && region.fieldRefs.length > 0) {
    const refs = region.fieldRefs;
    return (x, y) => {
      let d = Infinity;
      for (const ref of refs) {
        // Positive outside the stone: the field gathers around it.
        d = Math.min(d, Math.max(0, -radialInset(ref, x, y)));
      }
      return d;
    };
  }
  if (region.strataBand) {
    const { top, bottom } = region.strataBand;
    return (x, y) => Math.max(0, Math.min(y - profileY(top, x), profileY(bottom, x) - y));
  }
  if (region.ribbon) {
    const { outer, inner } = region.ribbon;
    // Coarse nearest-sample scan (edges are sampled every few px); the cut
    // ends are the first/last columns, covered by including both endpoints.
    const samples: Point[] = [];
    for (let i = 0; i < outer.length; i += 3) samples.push(outer[i]);
    for (let i = 0; i < inner.length; i += 3) samples.push(inner[i]);
    samples.push(outer[outer.length - 1], inner[inner.length - 1]);
    return (x, y) => {
      let d2 = Infinity;
      for (const q of samples) {
        const dd = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
        if (dd < d2) d2 = dd;
      }
      return Math.sqrt(d2);
    };
  }
  return null;
}

/** Median seam distance over a coarse interior sample — the region's
 *  characteristic depth, so the seam ramp self-scales and thin bands don't
 *  saturate to solid dark. */
function regionDepth(region: Region, dist: (x: number, y: number) => number): number {
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const p of region.poly) {
    if (p.x < bx0) bx0 = p.x;
    if (p.y < by0) by0 = p.y;
    if (p.x > bx1) bx1 = p.x;
    if (p.y > by1) by1 = p.y;
  }
  const ds: number[] = [];
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const x = bx0 + ((gx + 0.5) / 8) * (bx1 - bx0);
      const y = by0 + ((gy + 0.5) / 8) * (by1 - by0);
      if (!pointInPolygon(region.poly, x, y)) continue;
      const d = dist(x, y);
      if (d > 0) ds.push(d);
    }
  }
  if (ds.length === 0) return 0;
  ds.sort((a, b) => a - b);
  return ds[Math.floor(ds.length / 2)];
}

/** Region centroid + characteristic extent from the polygon. */
function centroidExtent(poly: Point[]): { cx: number; cy: number; extent: number } {
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p.x;
    cy += p.y;
  }
  cx /= poly.length;
  cy /= poly.length;
  let extent = 0;
  for (const p of poly) {
    extent = Math.max(extent, Math.hypot(p.x - cx, p.y - cy));
  }
  return { cx, cy, extent: Math.max(1, extent) };
}

/**
 * The band's darkness field, or null for the flat (constant-pitch) path.
 * Values sit in [0.25, 1] with 0.5 the neutral datum — the 'seam' shape is
 * one-sided (only darkens toward the seams, the interior keeps today's
 * tone); 'core', 'light' and 'noise' swing symmetrically around neutral.
 * A sheet tone (page-space darkness offset from `buildSheetTone`) is added
 * on top under the common floor, so previously-flat bands — including the
 * background field — shade with the rest of the sheet.
 */
export function buildRegionTone(region: Region, sheet: ToneFn | null = null): ToneFn | null {
  const regional = regionalTone(region);
  if (!sheet) return regional;
  const base = regional ?? (() => 0.5);
  return (x, y) => clamp(base(x, y) + sheet(x, y), TONE_FLOOR, 1);
}

/** The within-region tone shapes (the band's own internal idea). */
function regionalTone(region: Region): ToneFn | null {
  const t = region.tex;
  if (t.toneShape === 'none' || t.toneStrength <= 0) return null;
  const s = t.toneStrength;
  const map = (shape01: number): number =>
    clamp(0.5 + s * (shape01 - 0.5) * 1.4, TONE_FLOOR, 1);

  if (t.toneShape === 'seam') {
    const dist = seamDistanceFn(region);
    if (!dist) return null;
    const depth = regionDepth(region, dist);
    if (depth <= 0) return null;
    const ramp = clamp(depth * 0.45, t.spacing * 3, t.spacing * 10);
    // One-sided: neutral in the interior, ramping dark against the seams —
    // the way real agate bands densify against their boundaries.
    return (x, y) => map(0.5 + 0.5 * (1 - clamp(dist(x, y) / ramp, 0, 1)));
  }

  if (t.toneShape === 'core') {
    if (region.radial) {
      const radial = region.radial;
      return (x, y) => {
        const ex = (x - radial.cx) / radial.rx;
        const ey = (y - radial.cy) / radial.ry;
        const g = tableAt(radial, Math.atan2(ey, ex)) || 1e-6;
        return map(1 - clamp(Math.hypot(ex, ey) / g, 0, 1));
      };
    }
    const { cx, cy, extent } = centroidExtent(region.poly);
    return (x, y) => map(1 - clamp(Math.hypot(x - cx, y - cy) / extent, 0, 1));
  }

  if (t.toneShape === 'light') {
    // Flat directional shading: the flank facing the light lightens, the
    // far flank darkens — 2D, judged per region so every band models its
    // own little relief.
    const { cx, cy, extent } = centroidExtent(region.poly);
    const lx = Math.cos(t.lightAngleRad);
    const ly = Math.sin(t.lightAngleRad);
    return (x, y) =>
      map(0.5 - 0.5 * clamp(((x - cx) * lx + (y - cy) * ly) / extent, -1, 1));
  }

  // 'noise': per-region fBm clouds on the band's own seeded stream.
  const noise = createNoise(t.toneSeed);
  const scale = Math.max(24, t.spacing * 20);
  return (x, y) => map(0.5 + 0.5 * noise.fbm(x / scale, y / scale, 2, 0.5, 2));
}
