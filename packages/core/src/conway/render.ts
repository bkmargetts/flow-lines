import { Point } from '../flow-lines.js';
import { gaussianBlur } from '../image.js';
import { traceIsoContours } from '../iso-contours.js';
import { SimplexNoise } from '../noise.js';

/** Closed square outline for a cell, inset by `inset` px from its bounds */
export function cellSquare(cx: number, cy: number, half: number, inset: number): Point[] {
  const h = half - inset;
  return [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
    { x: cx - h, y: cy - h },
  ];
}

/** Split a polyline into the runs of consecutive points that fall outside the
 * mask — used to hold trails/contours a sliver short of the haloed present. */
export function clipPolylineByMask(points: Point[], inHalo: (p: Point) => boolean): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (inHalo(p)) {
      if (run.length >= 2) runs.push(run);
      run = [];
    } else {
      run.push(p);
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

/**
 * Commit a tone to one of `bands` discrete levels spanning [lo, 1]. Anything
 * below `lo` returns 0 (clean paper), so the faint cutoff still culls empty
 * space — the bands only quantize the *visible* range into committed shapes.
 */
export function posterize(t: number, bands: number, lo: number): number {
  if (bands <= 0) return t;
  if (t < lo) return 0;
  const span = 1 - lo;
  const k = Math.min(bands - 1, Math.floor(((t - lo) / span) * bands));
  return lo + ((k + 0.5) / bands) * span;
}

/** A unit vector whose angle varies smoothly with position via fBm noise. */
export function noiseAngle(noise: SimplexNoise, x: number, y: number, freq: number): Point {
  const theta = Math.PI * noise.fbm(x * freq, y * freq, 2, 0.5, 2.2);
  return { x: Math.cos(theta), y: Math.sin(theta) };
}

/**
 * Trace the outline of the core mass as closed loops in cell coordinates.
 * The blocky 0/1 core raster is lightly blurred so marching squares rounds the
 * staircase into a confident silhouette (the same cloud-carving trick the
 * pen-ink sky treatment uses).
 */
export function coreBoundaryPolylines(isCore: Uint8Array, cols: number, rows: number): Point[][] {
  const data = new Float32Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = isCore[i] ? 1 : 0;
  const blurred = gaussianBlur({ width: cols, height: rows, data }, 0.8);
  return traceIsoContours(blurred, 0.5);
}

/**
 * Parallel hatching at `angleRad`, clipped to a region. Walks scanlines in the
 * rotated frame; spacing and phase are jittered by low-frequency noise so the
 * fill never reads as an arithmetic screen, and each scanline is broken into
 * runs wherever it leaves the region — so strokes terminate at the silhouette,
 * not on cell borders. `coverage` (0..1) gates how much of the region is filled
 * (1 ≈ solid for the base layer; less for a partial cross-hatch). Output
 * segments are in cell coordinates.
 */
export function angledRegionHatch(
  inRegion: (cx: number, cy: number) => boolean,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  angleRad: number,
  baseSpacing: number,
  noise: SimplexNoise,
  jitter: number,
  phaseOffset: number,
  coverage: number
): Point[][] {
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const nx = -dy;
  const ny = dx;
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const c of corners) {
    const u = c.x * nx + c.y * ny;
    const v = c.x * dx + c.y * dy;
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  const threshold = coverage * 2 - 1;
  const segs: Point[][] = [];
  const vStep = 0.4;
  let u = uMin + phaseOffset;
  while (u <= uMax) {
    let run: Point[] = [];
    for (let v = vMin; v <= vMax; v += vStep) {
      const x = nx * u + dx * v;
      const y = ny * u + dy * v;
      const inside =
        inRegion(Math.floor(x), Math.floor(y)) &&
        (coverage >= 1 || noise.noise2D(x * 0.06 + 13.1, y * 0.06 + 7.7) < threshold);
      if (inside) {
        run.push({ x, y });
      } else {
        if (run.length >= 2) segs.push(run);
        run = [];
      }
    }
    if (run.length >= 2) segs.push(run);
    const spacing = baseSpacing * (1 + jitter * 0.5 * noise.noise2D(u * 0.15, phaseOffset));
    u += Math.max(0.3, spacing);
  }
  return segs;
}
