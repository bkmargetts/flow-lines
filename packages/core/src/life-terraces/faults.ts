import { Point } from '../flow-lines.js';
import { GrayscaleImage, sampleBilinear } from '../image.js';
import { makeRandom } from '../lib/rng.js';

/**
 * Strike-slip fault planes sheared through the exposure terrain — the
 * terraces module's signature displacement brought to a map-view field. Each
 * fault is a line through the grid; everything on its positive side is
 * displaced along the fault's tangent, so terrace rings and laminae visibly
 * offset at the scarp the way ridgelines offset across a strike-slip fault
 * on a geological map. The shear is applied to the *sampling* of the already
 * blurred field, never re-blurred, so the discontinuity stays crisp.
 */
export interface FaultPlane {
  /** A point on the fault line, raster coords. */
  px: number;
  py: number;
  /** Unit tangent (the slip direction). */
  tx: number;
  ty: number;
  /** Signed slip in cells — how far the positive side is carried. */
  slip: number;
}

/**
 * Deal the fault planes for a seed. Every per-fault draw happens
 * unconditionally and in a fixed order, so dialing `throwScale` rescales the
 * displacement without ever moving a fault or re-dealing its neighbours
 * (the terraces convention). Faults whose scaled slip is negligible are
 * dropped entirely — `faultThrow: 0` must be a byte-identical no-op.
 */
export function buildFaults(
  seed: number,
  cols: number,
  rows: number,
  count: number,
  throwScale: number
): FaultPlane[] {
  const rng = makeRandom(seed);
  const minDim = Math.min(cols, rows);
  const faults: FaultPlane[] = [];
  for (let k = 0; k < count; k++) {
    // Fixed draw order: x, y, angle, magnitude, sign.
    const px = cols * (0.2 + rng() * 0.6);
    const py = rows * (0.2 + rng() * 0.6);
    const angle = rng() * Math.PI;
    const magnitude = (0.04 + rng() * 0.06) * minDim;
    const sign = rng() < 0.5 ? -1 : 1;
    const slip = magnitude * sign * throwScale;
    if (Math.abs(slip) < 0.05) continue;
    faults.push({ px, py, tx: Math.cos(angle), ty: Math.sin(angle), slip });
  }
  return faults;
}

/** Signed distance of (x, y) from the fault line (positive = displaced side). */
const sideOf = (f: FaultPlane, x: number, y: number): number =>
  (x - f.px) * -f.ty + (y - f.py) * f.tx;

/** Map a target coordinate back to its pre-fault source coordinate. */
export function faultSource(faults: FaultPlane[], x: number, y: number): Point {
  let sx = x;
  let sy = y;
  for (const f of faults) {
    if (sideOf(f, sx, sy) > 0) {
      sx -= f.tx * f.slip;
      sy -= f.ty * f.slip;
    }
  }
  return { x: sx, y: sy };
}

/** Resample a raster through the fault shear (bilinear, edge-clamped). */
export function warpByFaults(img: GrayscaleImage, faults: FaultPlane[]): GrayscaleImage {
  if (faults.length === 0) return img;
  const { width, height } = img;
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = faultSource(faults, x, y);
      data[y * width + x] = sampleBilinear(img, s.x, s.y);
    }
  }
  return { width, height, data };
}

/**
 * The visible scarp traces: each fault line clipped to the grid and broken
 * into the runs where the warped field is actually inked nearby — a scarp
 * across empty paper reads as a stray rule, not a fault.
 */
export function faultTraces(
  faults: FaultPlane[],
  warped: GrayscaleImage,
  faint: number
): Point[][] {
  const { width, height } = warped;
  const traces: Point[][] = [];
  const step = 0.5;
  for (const f of faults) {
    // Clip the infinite line to the grid box by walking it.
    const span = Math.hypot(width, height);
    let run: Point[] = [];
    for (let t = -span; t <= span; t += step) {
      const x = f.px + f.tx * t;
      const y = f.py + f.ty * t;
      const inside = x >= 0 && x <= width - 1 && y >= 0 && y <= height - 1;
      // Probe a cell off each flank: the scarp is drawn only where it
      // actually cuts through toned terrain.
      const lit =
        inside &&
        (sampleBilinear(warped, x - f.ty * 1.2, y + f.tx * 1.2) >= faint ||
          sampleBilinear(warped, x + f.ty * 1.2, y - f.tx * 1.2) >= faint);
      if (lit) {
        run.push({ x, y });
      } else {
        if (run.length >= 4) traces.push(run);
        run = [];
      }
    }
    if (run.length >= 4) traces.push(run);
  }
  return traces;
}
