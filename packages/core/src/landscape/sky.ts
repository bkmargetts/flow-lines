import { FlowLine, Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import type { GrayscaleImage } from '../image.js';
import { traceIsoContours } from '../iso-contours.js';
import { trimPolyline } from '../lib/polyline.js';
import { lerp, clamp01 } from '../lib/math.js';
import { type Craft, emitStroke, sampleProfileY, clipLineToPolygon } from './hatching.js';

/**
 * The sky engine: broken vertical hatch whose dash/gap rhythm carries a
 * continuous tonal gradient (no parity columns, no quantized infill bands — the
 * old even/odd scheme drew the sky as stacked rectangles with hard seams), a
 * sun held as clean circular negative space with a stipple-feathered halo, and
 * a cloud mass cleaned to a few large, flat-bottomed shapes.
 *
 * Because every column starts at its own dithered y and breaks at its own
 * rhythm, no two columns share a break line — horizontal seams cannot form,
 * and a light sky genuinely opens to paper instead of a full-height screen.
 */

export interface SunGeometry {
  active: boolean;
  x: number;
  y: number;
  r: number;
  haloR: number;
}

export interface SkyParams {
  x0: number;
  x1: number;
  skyTopY: number;
  usableW: number;
  skyBoundary: Point[];
  skyOccluders: Point[][];
  spacing: number; // px between columns at full darkness
  toneTop: number; // 0..1 coverage at the top of the sky
  toneHorizon: number; // 0..1 coverage at the horizon
  sun: SunGeometry;
  clouds: number; // 0..1 carved-cloud coverage
  taper: number;
  rng: () => number;
  toneNoise: SimplexNoise;
  cloudNoise: SimplexNoise;
}

/** Smoothstep of t in 0..1. */
function smooth01(t: number): number {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

/** Subtract a closed interval [rlo,rhi] from [lo,hi], returning what remains. */
function subtractInterval(lo: number, hi: number, rlo: number, rhi: number): [number, number][] {
  if (rhi <= lo || rlo >= hi) return [[lo, hi]];
  const out: [number, number][] = [];
  if (rlo > lo) out.push([lo, rlo]);
  if (rhi < hi) out.push([rhi, hi]);
  return out;
}

// ——————————————————————————————————————————————————————————————————————
// Cloud mass
// ——————————————————————————————————————————————————————————————————————

const CLOUD_W = 128;
const CLOUD_H = 72;

/**
 * Build the cloud mass as a cleaned binary raster: threshold low-frequency fbm,
 * label the connected components, drop confetti (small blobs), keep only the
 * few largest masses, and flatten each mass's underside — cumulus reads as a
 * flat-bottomed heap, and a raw iso-threshold's amoeba blobs are the strongest
 * "computer" tell in the old sky.
 */
export function buildCloudMask(clouds: number, cloudNoise: SimplexNoise): GrayscaleImage | null {
  if (clouds <= 0.01) return null;
  const cw = CLOUD_W;
  const ch = CLOUD_H;
  const iso = 0.5 - clouds * 0.85;
  const cf = 1.5;
  const bin = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const u = cx / (cw - 1);
      const v = cy / (ch - 1);
      // Bias clouds to the upper sky and flatten them horizontally.
      const n = cloudNoise.fbm(u * cf, v * cf * 3.0 + 11, 4, 0.5, 2, 1) * (1 - v * 0.35);
      bin[cy * cw + cx] = n > iso ? 1 : 0;
    }
  }

  // Connected components (4-neighbour BFS in deterministic scan order).
  const label = new Int32Array(cw * ch).fill(-1);
  interface Comp {
    cells: number[];
    yMin: number;
    yMax: number;
  }
  const comps: Comp[] = [];
  const queue: number[] = [];
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || label[i] >= 0) continue;
    const id = comps.length;
    const comp: Comp = { cells: [], yMin: ch, yMax: 0 };
    label[i] = id;
    queue.length = 0;
    queue.push(i);
    while (queue.length) {
      const j = queue.pop()!;
      comp.cells.push(j);
      const jy = Math.floor(j / cw);
      const jx = j - jy * cw;
      if (jy < comp.yMin) comp.yMin = jy;
      if (jy > comp.yMax) comp.yMax = jy;
      if (jx > 0 && bin[j - 1] && label[j - 1] < 0) {
        label[j - 1] = id;
        queue.push(j - 1);
      }
      if (jx < cw - 1 && bin[j + 1] && label[j + 1] < 0) {
        label[j + 1] = id;
        queue.push(j + 1);
      }
      if (jy > 0 && bin[j - cw] && label[j - cw] < 0) {
        label[j - cw] = id;
        queue.push(j - cw);
      }
      if (jy < ch - 1 && bin[j + cw] && label[j + cw] < 0) {
        label[j + cw] = id;
        queue.push(j + cw);
      }
    }
    comps.push(comp);
  }

  // Keep only the few largest masses; drop confetti below ~2% of the raster.
  const minArea = cw * ch * 0.02;
  const keepCount = 3 + Math.round(clouds * 4);
  const kept = comps
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.cells.length >= minArea)
    .sort((a, b) => b.c.cells.length - a.c.cells.length)
    .slice(0, keepCount);
  if (!kept.length) return null;

  const data = new Float32Array(cw * ch);
  for (const { c, i } of kept) {
    // Flatten the underside: erase rows below ~72% of the mass height, with a
    // ±1-cell noise ripple so the base isn't a ruled line.
    const cut = c.yMin + 0.72 * Math.max(1, c.yMax - c.yMin);
    for (const j of c.cells) {
      const jy = Math.floor(j / cw);
      const jx = j - jy * cw;
      const ripple = cloudNoise.noise2D(jx * 0.35, i * 13.7);
      if (jy <= cut + ripple) data[j] = 1;
    }
  }
  return { width: cw, height: ch, data };
}

/** Bilinear sample of the cloud mask at a sky-space point (>0.5 = in cloud). */
export function makeInCloud(
  mask: GrayscaleImage | null,
  x0: number,
  usableW: number,
  skyTopY: number,
  skyH: number
): (px: number, py: number) => boolean {
  if (!mask) return () => false;
  const { width: w, height: h, data: d } = mask;
  return (px, py) => {
    const u = (px - x0) / usableW;
    const v = (py - skyTopY) / skyH;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const fx = u * (w - 1);
    const fy = v * (h - 1);
    const ix = Math.min(w - 2, Math.floor(fx));
    const iy = Math.min(h - 2, Math.floor(fy));
    const tx = fx - ix;
    const ty = fy - iy;
    const v00 = d[iy * w + ix];
    const v10 = d[iy * w + ix + 1];
    const v01 = d[(iy + 1) * w + ix];
    const v11 = d[(iy + 1) * w + ix + 1];
    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty) > 0.5;
  };
}

// ——————————————————————————————————————————————————————————————————————
// Sky columns
// ——————————————————————————————————————————————————————————————————————

/**
 * Draw the sky. Emits hatch into `lines` (layer `sky`) and cloud outlines into
 * `detail` (layer `cloud`, so land masses can occlude them before merging).
 */
export function drawSky(lines: FlowLine[], detail: FlowLine[], p: SkyParams): void {
  const { x0, x1, skyTopY, usableW, rng, sun } = p;
  let skyMaxY = skyTopY;
  for (const pt of p.skyBoundary) if (pt.y > skyMaxY) skyMaxY = pt.y;
  const skyH = Math.max(1, skyMaxY - skyTopY);

  const mask = buildCloudMask(p.clouds, p.cloudNoise);
  const inCloud = makeInCloud(mask, x0, usableW, skyTopY, skyH);

  const craft: Craft = { rng, taper: p.taper * 0.6, jitter: 0.8 * (Math.PI / 180), subStep: 14 };
  const step = p.spacing / 2;

  // Coverage 0..1 from the tonal gradient: below the paper cutoff the sky is
  // held as clean paper; above the saturation point it closes to a solid line.
  const coverage = (x: number, y: number, skyline: number): number => {
    const v = clamp01((y - skyTopY) / Math.max(1, skyline - skyTopY));
    const t = clamp01(lerp(p.toneTop, p.toneHorizon, v) + 0.08 * p.toneNoise.fbm(x * 0.006, y * 0.006, 2, 0.5, 2, 1));
    if (t < 0.22) return 0;
    return smooth01((t - 0.22) / 0.66);
  };

  for (let x = x0 + rng() * step; x <= x1; x += step) {
    const skyline = sampleProfileY(p.skyBoundary, x);
    if (skyline <= skyTopY + 2) continue;

    // Opaque masses poking above the horizon hide the sky column behind them.
    const occ: [number, number][] = [];
    for (const poly of p.skyOccluders) {
      for (const iv of clipLineToPolygon(poly, { x, y: 0 }, { x: 0, y: 1 })) occ.push(iv);
    }

    const dx = x - sun.x;
    const hd = sun.active && Math.abs(dx) < sun.r + 1.2 ? Math.sqrt(Math.max(0, sun.r * sun.r - dx * dx)) : -1;

    // Walk down the column: dash length and gap both ride the local coverage.
    // The start offset spans a whole dash+gap cycle and every gap is jittered,
    // so neighbouring columns never share a phase (aligned dash rows would
    // read as a woven screen).
    let y = skyTopY + rng() * 36;
    let guard = 0;
    while (y < skyline && guard++ < 400) {
      const c = coverage(x, y, skyline);
      if (c <= 0) {
        y += 12 + rng() * 10;
        continue;
      }
      const L = lerp(6, 44, c) * (0.75 + 0.5 * rng());
      const yEnd = Math.min(skyline, y + L);
      const gap = Math.min(60, Math.max(2, (L * (1 - c)) / Math.max(c, 0.08))) * (0.7 + 0.6 * rng());
      // Feather light zones further: sparse coverage keeps only some dashes.
      if (rng() >= Math.min(1, 0.3 + 1.4 * c)) {
        y = yEnd + gap;
        continue;
      }

      let segs: [number, number][] = [[y, yEnd]];
      // Carve the sun disk exactly — no per-column randomness, so the hole is
      // genuinely round (the old jittered carve read as a ragged diamond).
      if (hd >= 0) {
        const next: [number, number][] = [];
        for (const [lo, hi] of segs) for (const piece of subtractInterval(lo, hi, sun.y - hd - 1.2, sun.y + hd + 1.2)) next.push(piece);
        segs = next;
      }
      for (const [olo, ohi] of occ) {
        const next: [number, number][] = [];
        for (const [lo, hi] of segs) for (const piece of subtractInterval(lo, hi, olo, ohi)) next.push(piece);
        segs = next;
      }
      // Carve clouds (sampled cheaply along the dash).
      if (mask) {
        const refined: [number, number][] = [];
        for (const [lo, hi] of segs) {
          let runStart = lo;
          let inside = inCloud(x, lo);
          const stepY = 4;
          for (let yy = lo + stepY; yy <= hi; yy += stepY) {
            const cIn = inCloud(x, yy);
            if (cIn !== inside) {
              if (!inside && yy - runStart > 2) refined.push([runStart, yy - stepY * 0.5]);
              runStart = yy;
              inside = cIn;
            }
          }
          if (!inside && hi - runStart > 2) refined.push([runStart, hi]);
        }
        segs = refined;
      }

      for (let [lo, hi] of segs) {
        if (hi - lo < 2) continue;
        // The halo feathers radially: dashes near the disk drop out with rising
        // probability and the survivors shorten — a stipple ring, not geometry.
        if (sun.active) {
          const mid = (lo + hi) / 2;
          const r = Math.hypot(x - sun.x, mid - sun.y);
          if (r < sun.haloR) {
            const q = clamp01((r - sun.r) / Math.max(1, sun.haloR - sun.r));
            if (rng() < Math.pow(1 - q, 1.5)) continue;
            const keep = lerp(0.45, 1, q);
            const half = ((hi - lo) * keep) / 2;
            lo = mid - half;
            hi = mid + half;
            if (hi - lo < 2) continue;
          }
        }
        emitStroke(lines, { x, y: lo }, { x, y: hi }, 'sky', craft);
      }
      y = yEnd + gap;
    }
  }

  // A faint, lightly trimmed outline along the cleaned cloud mass boundary
  // firms up the carved negative space without scribble.
  if (mask) {
    const contours = traceIsoContours(mask, 0.5);
    for (const c of contours) {
      if (c.length < 24) continue;
      const mapped = c.map((pt) => ({
        x: x0 + (pt.x / (mask.width - 1)) * usableW,
        y: skyTopY + (pt.y / (mask.height - 1)) * skyH,
      }));
      const trimmed = trimPolyline(mapped, 0.12);
      if (trimmed.length >= 2) detail.push({ points: trimmed, layer: 'cloud' });
    }
  }
}
