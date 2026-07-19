import { Point } from '../flow-lines.js';
import { createNoise, SimplexNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { FractureCrack } from './sim.js';

/**
 * Plate extraction and facet hatching. The crack network tessellates the sheet
 * into plates; we recover them on a coarse raster (flood fill between stamped
 * cracks — the crack strokes themselves already draw every plate boundary, so
 * no polygonization is needed) and hatch each plate at its own confident angle,
 * the facet-by-facet way ink artists shade broken ground. A chamfer
 * distance-to-crack transform drives `edgeCurl`: a second, tighter hatch band
 * hugging the crack edges, the shadow of a plate curling up off the sheet.
 */

export interface PlateHatchParams {
  /** Inner frame in page px. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  seed: number;
  /** Hatch line spacing in page px. */
  spacing: number;
  /** Base hatch angle, radians; each plate deviates ±35° from it. */
  baseAngle: number;
  /** 0..1 — fraction of plates that get hatched at all. */
  coverage: number;
  /** 0..1 — strength (band width + density) of the near-crack curl pass. */
  edgeCurl: number;
}

interface PlateRaster {
  cols: number;
  rows: number;
  cellPx: number;
  /** 0 = crack/border, else plate id (1-based). */
  labels: Int32Array;
  regionCount: number;
  /** Chamfer distance to the nearest crack cell, in cell units. */
  dist: Float32Array;
}

const MIN_PLATE_CELLS = 12;

/** Rasterize the cracks and flood-fill the plates between them. */
export function buildPlateRaster(
  cracks: FractureCrack[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cellPx: number
): PlateRaster | null {
  const w = x1 - x0;
  const h = y1 - y0;
  const cols = Math.floor(w / cellPx);
  const rows = Math.floor(h / cellPx);
  if (cols < 8 || rows < 8) return null;
  const n = cols * rows;

  // Mask: 1 = crack. The border ring counts as crack so edge plates close.
  const mask = new Uint8Array(n);
  for (let cx = 0; cx < cols; cx++) {
    mask[cx] = 1;
    mask[(rows - 1) * cols + cx] = 1;
  }
  for (let cy = 0; cy < rows; cy++) {
    mask[cy * cols] = 1;
    mask[cy * cols + cols - 1] = 1;
  }
  const stamp = (x: number, y: number): void => {
    const cx = clamp(Math.floor((x - x0) / cellPx), 0, cols - 1);
    const cy = clamp(Math.floor((y - y0) / cellPx), 0, rows - 1);
    mask[cy * cols + cx] = 1;
  };
  for (const c of cracks) {
    const pts = c.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / (cellPx * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        stamp(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }
  }

  // Flood fill plates (4-connected, explicit stack, row-major discovery order
  // so region ids are deterministic).
  const labels = new Int32Array(n);
  let regionCount = 0;
  const stack: number[] = [];
  for (let start = 0; start < n; start++) {
    if (mask[start] === 1 || labels[start] !== 0) continue;
    regionCount++;
    const id = regionCount;
    const cells: number[] = [];
    stack.length = 0;
    stack.push(start);
    labels[start] = id;
    while (stack.length > 0) {
      const i = stack.pop()!;
      cells.push(i);
      const cx = i % cols;
      const cy = (i / cols) | 0;
      if (cx > 0 && mask[i - 1] === 0 && labels[i - 1] === 0) {
        labels[i - 1] = id;
        stack.push(i - 1);
      }
      if (cx < cols - 1 && mask[i + 1] === 0 && labels[i + 1] === 0) {
        labels[i + 1] = id;
        stack.push(i + 1);
      }
      if (cy > 0 && mask[i - cols] === 0 && labels[i - cols] === 0) {
        labels[i - cols] = id;
        stack.push(i - cols);
      }
      if (cy < rows - 1 && mask[i + cols] === 0 && labels[i + cols] === 0) {
        labels[i + cols] = id;
        stack.push(i + cols);
      }
    }
    // Slivers merge into "no plate" (they'd hatch as noise between close
    // cracks). Ids stay dense because only the most recent one rolls back.
    if (cells.length < MIN_PLATE_CELLS) {
      for (const i of cells) labels[i] = 0;
      regionCount--;
    }
  }

  // Two-pass chamfer distance to the nearest crack cell (3-4 chamfer / 3).
  const INF = 1e9;
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) dist[i] = mask[i] === 1 ? 0 : INF;
  const D1 = 1;
  const D2 = 4 / 3;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx;
      let d = dist[i];
      if (cx > 0) d = Math.min(d, dist[i - 1] + D1);
      if (cy > 0) d = Math.min(d, dist[i - cols] + D1);
      if (cx > 0 && cy > 0) d = Math.min(d, dist[i - cols - 1] + D2);
      if (cx < cols - 1 && cy > 0) d = Math.min(d, dist[i - cols + 1] + D2);
      dist[i] = d;
    }
  }
  for (let cy = rows - 1; cy >= 0; cy--) {
    for (let cx = cols - 1; cx >= 0; cx--) {
      const i = cy * cols + cx;
      let d = dist[i];
      if (cx < cols - 1) d = Math.min(d, dist[i + 1] + D1);
      if (cy < rows - 1) d = Math.min(d, dist[i + cols] + D1);
      if (cx < cols - 1 && cy < rows - 1) d = Math.min(d, dist[i + cols + 1] + D2);
      if (cx > 0 && cy < rows - 1) d = Math.min(d, dist[i + cols - 1] + D2);
      dist[i] = d;
    }
  }

  return { cols, rows, cellPx, labels, regionCount, dist };
}

/**
 * Parallel hatch one plate at `angle`, walking scanlines in the rotated frame
 * (the shared angled-region technique, restricted by the label raster). Returns
 * segments in page px. `distGate` (cell units) restricts to the near-crack band
 * when set (the curl pass).
 */
function hatchPlate(
  raster: PlateRaster,
  regionId: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  angle: number,
  spacingCells: number,
  x0: number,
  y0: number,
  noise: SimplexNoise,
  phase: number,
  distGate: number
): Point[][] {
  const { cols, rows, cellPx, labels, dist } = raster;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
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
  const inPlate = (x: number, y: number): boolean => {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return false;
    const i = cy * cols + cx;
    if (labels[i] !== regionId) return false;
    return distGate <= 0 || dist[i] <= distGate;
  };
  const toPx = (x: number, y: number): Point => ({
    x: x0 + (x + 0.5) * cellPx,
    y: y0 + (y + 0.5) * cellPx,
  });
  const segs: Point[][] = [];
  const vStep = 0.4;
  let u = uMin + phase;
  while (u <= uMax) {
    let run: Point[] = [];
    for (let v = vMin; v <= vMax; v += vStep) {
      const x = nx * u + dx * v;
      const y = ny * u + dy * v;
      if (inPlate(x, y)) {
        run.push(toPx(x, y));
      } else {
        if (run.length >= 2) segs.push(run);
        run = [];
      }
    }
    if (run.length >= 2) segs.push(run);
    const wave = noise.noise2D(u * 0.15, phase + regionId * 0.37);
    u += Math.max(0.3, spacingCells * (1 + 0.25 * wave));
  }
  return segs;
}

/**
 * Facet-hatch the plates: each hatched plate gets its own angle near
 * `baseAngle`, `coverage` gates which plates are hatched (paper does the
 * work), and `edgeCurl` adds a half-spacing pass inside the near-crack band.
 */
export function hatchPlates(raster: PlateRaster, p: PlateHatchParams): Point[][] {
  const { cols, rows, cellPx, labels, regionCount } = raster;
  const rand = makeRandom(subSeed(p.seed, 3));
  const noise = createNoise(subSeed(p.seed, 4));
  const spacingCells = Math.max(1.2, p.spacing / cellPx);
  const segs: Point[][] = [];

  // Per-region bounds in one pass.
  const minX = new Int32Array(regionCount + 1).fill(cols);
  const minY = new Int32Array(regionCount + 1).fill(rows);
  const maxX = new Int32Array(regionCount + 1).fill(-1);
  const maxY = new Int32Array(regionCount + 1).fill(-1);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const id = labels[cy * cols + cx];
      if (id <= 0) continue;
      if (cx < minX[id]) minX[id] = cx;
      if (cx > maxX[id]) maxX[id] = cx;
      if (cy < minY[id]) minY[id] = cy;
      if (cy > maxY[id]) maxY[id] = cy;
    }
  }

  const curlBand = p.edgeCurl > 0 ? clamp(p.edgeCurl * 3.5, 1, 6) : 0;

  // Draw rand in region-id order, the same four rolls per plate, so a plate's
  // angle/coverage never shifts with its neighbours' outcomes.
  for (let id = 1; id <= regionCount; id++) {
    const angle = p.baseAngle + (rand() - 0.5) * (70 * Math.PI) / 180;
    const covRoll = rand();
    const phase = rand() * spacingCells;
    const curlRoll = rand();
    if (maxX[id] < 0) continue;
    const bounds = { minX: minX[id], minY: minY[id], maxX: maxX[id] + 1, maxY: maxY[id] + 1 };
    const hatched = covRoll < p.coverage;
    if (hatched) {
      segs.push(...hatchPlate(raster, id, bounds, angle, spacingCells, p.x0, p.y0, noise, phase, 0));
      if (curlBand > 0) {
        segs.push(
          ...hatchPlate(
            raster,
            id,
            bounds,
            angle,
            spacingCells * 0.5,
            p.x0,
            p.y0,
            noise,
            phase + spacingCells * 0.25,
            curlBand
          )
        );
      }
    } else if (curlBand > 0 && curlRoll < p.edgeCurl * 0.6) {
      // Unhatched plates can still carry a curl shadow along their edges —
      // broken ground reads through the shadows even where facets stay paper.
      segs.push(
        ...hatchPlate(raster, id, bounds, angle, spacingCells * 0.6, p.x0, p.y0, noise, phase, curlBand)
      );
    }
  }
  return segs;
}
