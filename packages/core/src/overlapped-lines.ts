import { createNoise } from './noise.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

/**
 * Overlapped-line texture: each input centreline (a "swatch" trajectory) is
 * plotted as many slightly-offset passes of the pen that all follow the same
 * path. The passes pack into a band whose half-thickness swells and thins
 * along the line under low-frequency noise, so the build-up of overlapping
 * strokes — not stroke width — carries the texture. Every pass is tagged with
 * a `band-NN` layer drawn from `colorCount` inks, so the same drawing plots
 * one pen per colour (the noise reads as patches of mixed ink).
 *
 * Pure and deterministic per `seed`. The web/CLI layer supplies the
 * centrelines; the MVP feeds straight two-point segments, but any polyline
 * works — hand-drawn paths drop in unchanged.
 */
export interface OverlappedLinesOptions {
  width: number;
  height: number;
  /** Clear border kept free of marks, px. */
  margin?: number;
  /** Centreline polylines to thicken, in canvas px. */
  paths: Point[][];
  /** Band half-thickness where the noise peaks, px. */
  maxThicknessPx?: number;
  /** Band half-thickness where the noise troughs, px. */
  minThicknessPx?: number;
  /** Perpendicular gap between neighbouring offset passes, px. */
  passSpacingPx?: number;
  /** Spatial frequency of the thickness noise (cycles per px). */
  thicknessNoiseScale?: number;
  /** Number of ink bands (colours). */
  colorCount?: number;
  /** Spatial frequency of the colour-patch noise (cycles per px). */
  colorNoiseScale?: number;
  /** Random per-point perpendicular shake, px. */
  jitterPx?: number;
  /** Peak low-frequency wobble of each pass, px. */
  wobbleAmpPx?: number;
  /** Wobble wavelength along the pass, px. */
  wobbleWavelengthPx?: number;
  seed?: number;
}

/** The export layer name for ink band index i (zero-padded so layers sort). */
export function bandLayerName(i: number): string {
  return `band-${String(i).padStart(2, '0')}`;
}

/** Resample a polyline to points spaced ~`step` px apart (keeps both ends). */
function resample(path: Point[], step: number): Point[] {
  if (path.length < 2) return path.map((p) => ({ ...p }));
  const out: Point[] = [{ ...path[0] }];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-9) continue;
    let d = step - carry;
    while (d < segLen) {
      const t = d / segLen;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += step;
    }
    carry = segLen - (d - step);
  }
  const last = path[path.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.25) out.push({ ...last });
  return out;
}

interface Sample {
  x: number;
  y: number;
  /** Unit perpendicular to the local tangent. */
  nx: number;
  ny: number;
  /** Arc length from the path start, px. */
  arc: number;
}

/** Attach unit perpendiculars and cumulative arc length to resampled points. */
function withFrames(points: Point[]): Sample[] {
  const out: Sample[] = new Array(points.length);
  let arc = 0;
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    if (i > 0) arc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    out[i] = { x: points[i].x, y: points[i].y, nx: -ty / len, ny: tx / len, arc };
  }
  return out;
}

export function generateOverlappedLines(options: OverlappedLinesOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    paths,
    maxThicknessPx = 24,
    minThicknessPx = 4,
    passSpacingPx = 1.4,
    thicknessNoiseScale = 0.01,
    colorCount = 2,
    colorNoiseScale = 0.015,
    jitterPx = 0.5,
    wobbleAmpPx = 1.5,
    wobbleWavelengthPx = 90,
    seed = Math.floor(Math.random() * 1000000),
  } = options;

  const noise = createNoise(seed);
  const colors = Math.max(1, Math.round(colorCount));
  const spacing = Math.max(0.1, passSpacingPx);
  const maxHalf = Math.max(0, maxThicknessPx) / 2;
  const minHalf = Math.max(0, Math.min(minThicknessPx, maxThicknessPx)) / 2;
  // The widest the band can ever get bounds how many parallel passes we walk.
  const maxOffset = Math.ceil(maxHalf / spacing);
  const lines: FlowLine[] = [];

  const minX = margin;
  const minY = margin;
  const maxX = width - margin;
  const maxY = height - margin;
  const inBounds = (x: number, y: number): boolean =>
    x >= minX && x <= maxX && y >= minY && y <= maxY;

  paths.forEach((path, pathIndex) => {
    const samples = withFrames(resample(path, Math.max(1, spacing)));
    if (samples.length < 2) return;

    // Local half-thickness along the line: low-frequency noise mapped to
    // [minHalf, maxHalf] so the band swells and thins.
    const halfAt = (s: Sample): number => {
      const n = noise.noise2D(
        (s.x + pathIndex * 9173) * thicknessNoiseScale,
        s.y * thicknessNoiseScale
      );
      const t = (n + 1) / 2;
      return minHalf + (maxHalf - minHalf) * t;
    };
    const halves = samples.map(halfAt);

    // One pass per candidate offset, on both sides of the centreline.
    for (let k = -maxOffset; k <= maxOffset; k++) {
      const offset = k * spacing;
      const absOffset = Math.abs(offset);
      // Colour band: low-frequency noise keyed by offset → colours cluster
      // into patches across the band instead of striping.
      let run: Point[] = [];
      const flush = (band: number): void => {
        if (run.length >= 2) lines.push({ points: run, layer: bandLayerName(band), pen: 'fine' });
        run = [];
      };
      let runBand = -1;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        // The pass only exists where the band is wide enough to reach it.
        if (absOffset > halves[i]) {
          flush(runBand);
          continue;
        }
        const cn = noise.noise2D(
          (s.x + offset * s.nx) * colorNoiseScale + pathIndex * 31.7,
          (s.y + offset * s.ny) * colorNoiseScale
        );
        const band = Math.min(colors - 1, Math.floor(((cn + 1) / 2) * colors));
        if (run.length > 0 && band !== runBand) flush(runBand);
        runBand = band;

        const wob =
          wobbleAmpPx *
          noise.fbm(s.arc / wobbleWavelengthPx, k * 0.37 + pathIndex * 2.13, 2, 0.5, 2.2);
        const jit = jitterPx * (noise.noise2D(s.x * 0.5 + k * 11.1, s.y * 0.5) || 0);
        const d = offset + wob + jit;
        const x = s.x + s.nx * d;
        const y = s.y + s.ny * d;
        if (!inBounds(x, y)) {
          flush(runBand);
          continue;
        }
        run.push({ x, y });
      }
      flush(runBand);
    }
  });

  return { lines, width, height, seed };
}
