import { Point } from '../flow-lines.js';
import { GrayscaleImage, gaussianBlur, sampleBilinear } from '../image.js';
import { traceIsoContours } from '../iso-contours.js';
import { Simulation } from '../conway/sim.js';
import { FaultPlane, warpByFaults } from './faults.js';

/**
 * The walked terrain: the Conway long-exposure tone field treated as a
 * heightfield, quantized into discrete terrace levels. Coordinates are the
 * simulation's raster space (integer coords sit on cell centres, the same
 * convention conway's contour style maps to the page with).
 */
export type TerrainMode = 'exposure' | 'epochs';

export interface TerraceField {
  cols: number;
  rows: number;
  /** Raw per-cell gamma-lifted exposure tone — drives the hand-drawn wobble scale. */
  tone: Float32Array;
  /**
   * The WALKED field: what the agents integrate along, and what the terrace
   * levels, seams, and section profile cut on. In 'exposure' mode this is the
   * blurred exposure; in 'epochs' mode it is the last-alive age field.
   */
  blurred: GrayscaleImage;
  /**
   * The warped blurred exposure — carries stroke density and the terrain
   * silhouette in BOTH modes (the same object as `blurred` in exposure mode,
   * so that path stays byte-identical).
   */
  exposure: GrayscaleImage;
  /** Bilinear sample of the walked field at raster coords. */
  sample(x: number, y: number): number;
  /** Central-difference gradient of `sample` (may be zero on plateaus). */
  gradient(x: number, y: number): Point;
  /** Bilinear sample of the exposure field — separation/length/density. */
  density(x: number, y: number): number;
  /** Terrace level of a walked value: -1 below the faint cutoff, else 0..levels-1. */
  levelOf(v: number): number;
  /** Iso value of the boundary below level k (k = 1..levels-1). */
  levelIso(k: number): number;
}

export function buildTerraceField(
  sim: Simulation,
  gamma: number,
  blurSigma: number,
  faint: number,
  levels: number,
  faults: FaultPlane[] = [],
  terrain: TerrainMode = 'exposure'
): TerraceField {
  const { cols, rows } = sim;
  // Byte-for-byte the conway tone recipe: normalized exposure, gamma-lifted so
  // comet trails (little exposure per cell) stay visible next to the core.
  const rawTone = new Float32Array(cols * rows);
  for (let i = 0; i < rawTone.length; i++) {
    rawTone[i] = Math.pow(Math.min(1, sim.exposure[i] / sim.maxExposure), gamma);
  }
  // Blur first, shear after — re-blurring would soften the scarp, and the
  // whole point of a fault is the crisp offset of the terrace rings.
  const exposure = warpByFaults(
    gaussianBlur({ width: cols, height: rows, data: new Float32Array(rawTone) }, blurSigma),
    faults
  );
  // The raw tone shears too, so the wobble scale follows the displaced
  // drawing rather than the pre-fault record.
  const tone = warpByFaults({ width: cols, height: rows, data: rawTone }, faults).data;

  // 'epochs': terrace on TIME. lastAlive is *recency*, so the picture is not
  // concentric tree rings but a time-zoned survey map — the turbulent core is
  // constantly re-stamped (youngest), the quiet debris annulus froze early
  // (oldest), and a glider trail carries a monotone time gradient along its
  // length. After the visible-range renormalization below, the oldest epoch
  // lands at level 0 — matching exposure mode's faintest-outermost convention
  // with no inversion flag. Raising `decay` widens the visible time window
  // (the exposure cutoff hides anything last touched too long ago).
  const blurred = terrain === 'epochs' ? buildAgeField(sim, exposure, blurSigma, faint, faults) : exposure;

  const sample = (x: number, y: number): number => sampleBilinear(blurred, x, y);
  const h = 0.5;
  const gradient = (x: number, y: number): Point => ({
    x: (sample(x + h, y) - sample(x - h, y)) / (2 * h),
    y: (sample(x, y + h) - sample(x, y - h)) / (2 * h),
  });
  // In exposure mode `density` IS `sample` (same closure over the same
  // raster), so the historical path stays byte-identical.
  const density =
    blurred === exposure ? sample : (x: number, y: number): number => sampleBilinear(exposure, x, y);
  const span = 1 - faint;
  const levelOf = (v: number): number =>
    v < faint ? -1 : Math.min(levels - 1, Math.floor(((v - faint) / span) * levels));
  const levelIso = (k: number): number => faint + (k / levels) * span;

  return { cols, rows, tone, blurred, exposure, sample, gradient, density, levelOf, levelIso };
}

/**
 * The epoch age field: normalized last-alive generation, blurred by
 * normalized convolution and renormalized over the exposure footprint.
 *
 * - A plain gaussian blur of the spotty age raster would average in
 *   never-alive zeros and drag every epoch toward 0 at the ragged edge;
 *   dividing blur(age·mask) by blur(mask) reconstructs the mean age of only
 *   the ever-alive material.
 * - The exposure faint cutoff biases the footprint toward recency (exposure
 *   is dominated by decay^(G−lastAlive)), so the raw visible age range is
 *   compressed near 1; stretching the visible min..max across [faint, 1]
 *   spreads the epochs over every terrace level.
 * - Masking to the exposure footprint keeps the terrain silhouette identical
 *   between modes: the faint iso of the walked field is the exposure
 *   footprint boundary in both.
 */
function buildAgeField(
  sim: Simulation,
  exposure: GrayscaleImage,
  blurSigma: number,
  faint: number,
  faults: FaultPlane[]
): GrayscaleImage {
  const { cols, rows } = sim;
  const n = cols * rows;
  let maxLast = 0;
  for (let i = 0; i < n; i++) {
    if (sim.lastAlive[i] > maxLast) maxLast = sim.lastAlive[i];
  }
  const ageRaw = new Float32Array(n);
  const mask = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (sim.lastAlive[i] >= 0) {
      ageRaw[i] = (sim.lastAlive[i] + 1) / (maxLast + 1);
      mask[i] = 1;
    }
  }
  const num = gaussianBlur({ width: cols, height: rows, data: ageRaw }, blurSigma);
  const den = gaussianBlur({ width: cols, height: rows, data: mask }, blurSigma);
  const age = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    age[i] = den.data[i] > 1e-4 ? num.data[i] / den.data[i] : 0;
  }
  // Shear after blurring, through the SAME fault planes as the exposure, so
  // the two fields stay registered and the scarp stays crisp.
  const warped = warpByFaults({ width: cols, height: rows, data: age }, faults);

  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (exposure.data[i] < faint) continue;
    const v = warped.data[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = Math.max(hi - lo, 1e-6);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (exposure.data[i] < faint) continue;
    const t = Math.min(1, Math.max(0, (warped.data[i] - lo) / range));
    out[i] = faint + (1 - faint) * t;
  }
  return { width: cols, height: rows, data: out };
}

/**
 * Blocking masks rasterized at 2x the simulation grid so a sub-cell seam
 * width doesn't inflate to a whole cell. Fine cell (fx, fy) covers the raster
 * coordinate square [fx/2 - 0.5, fx/2) x [fy/2 - 0.5, fy/2) — i.e. each
 * simulation cell splits into 2x2 fine cells.
 */
export interface BlockMasks {
  /** True where an agent must not walk (seam or present halo). */
  blocked(x: number, y: number): boolean;
  /** True inside the present's reserved-paper halo only. */
  inHalo(x: number, y: number): boolean;
  /** The level-boundary iso polylines, index k-1 for k = 1..levels-1 (raster coords). */
  seamContours: Point[][][];
}

export function buildBlockMasks(
  field: TerraceField,
  finalAlive: Uint8Array,
  levels: number,
  cellSize: number,
  seamWidth: number,
  haloRadius: number,
  scarpTraces: Point[][] = []
): BlockMasks {
  const { cols, rows } = field;
  const fcols = cols * 2;
  const frows = rows * 2;
  const halo = new Uint8Array(fcols * frows);
  const seam = new Uint8Array(fcols * frows);
  const fineOf = (c: number, max: number): number =>
    Math.max(0, Math.min(max - 1, Math.floor((c + 0.5) * 2)));

  // Present halo: dilate the final generation's cells (conway's reserved-paper
  // rule). haloRadius 0 disables blocking entirely, mirroring conway.
  const haloR = Math.ceil(haloRadius / (cellSize / 2));
  if (haloR > 0) {
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (!finalAlive[cy * cols + cx]) continue;
        const fx0 = cx * 2;
        const fy0 = cy * 2;
        for (let dy = -haloR; dy <= haloR + 1; dy++) {
          const yy = fy0 + dy;
          if (yy < 0 || yy >= frows) continue;
          for (let dx = -haloR; dx <= haloR + 1; dx++) {
            const xx = fx0 + dx;
            if (xx < 0 || xx >= fcols) continue;
            halo[yy * fcols + xx] = 1;
          }
        }
      }
    }
  }

  // Reserved-paper seams along every terrace boundary: trace each interior
  // iso once (reused by the outline pass) and stamp fine cells within half a
  // seam width of the polyline.
  const seamContours: Point[][][] = [];
  // Brush radius in fine cells: (seamWidth/2) px over a fine cell of
  // (cellSize/2) px = seamWidth / cellSize.
  const seamR = seamWidth / cellSize;
  const stampR = Math.max(0, Math.ceil(seamR - 1e-9));
  const stampPolyline = (poly: Point[]): void => {
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(len / 0.25));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        const fx = fineOf(px, fcols);
        const fy = fineOf(py, frows);
        for (let dy = -stampR; dy <= stampR; dy++) {
          const yy = fy + dy;
          if (yy < 0 || yy >= frows) continue;
          for (let dx = -stampR; dx <= stampR; dx++) {
            const xx = fx + dx;
            if (xx < 0 || xx >= fcols) continue;
            // Circular brush on fine-cell centres so diagonal seams stay
            // an even width instead of squaring off.
            if (dx * dx + dy * dy <= seamR * seamR + 0.5) seam[yy * fcols + xx] = 1;
          }
        }
      }
    }
  };
  for (let k = 1; k < levels; k++) {
    // Confetti-sized iso islands (a wiggle of the blur around one cell) get
    // neither a seam nor an outline — reserving paper around them would eat
    // the band interiors, and inking them reads as noise.
    const contours = traceIsoContours(field.blurred, field.levelIso(k)).filter((poly) => {
      let len = 0;
      for (let i = 1; i < poly.length; i++) {
        len += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
      }
      return len >= 6;
    });
    seamContours.push(contours);
    if (seamWidth <= 0) continue;
    for (const poly of contours) stampPolyline(poly);
  }

  // Fault scarps reserve paper the same way the seams do, so the sheared
  // discontinuity reads as a deliberate cut, not a rendering glitch.
  if (seamWidth > 0) {
    for (const trace of scarpTraces) stampPolyline(trace);
  }

  const fineIndex = (x: number, y: number): number =>
    fineOf(y, frows) * fcols + fineOf(x, fcols);
  return {
    blocked: (x, y) => halo[fineIndex(x, y)] === 1 || seam[fineIndex(x, y)] === 1,
    inHalo: (x, y) => halo[fineIndex(x, y)] === 1,
    seamContours,
  };
}
