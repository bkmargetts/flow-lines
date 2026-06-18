import { createNoise } from './noise.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

/**
 * Interleaved-grating texture. A block of evenly-spaced straight lines is
 * drawn in one ink, then the same grating is repeated for each further ink
 * (`colorCount`) phase-shifted by `spacing / colorCount` so the colours
 * interleave into each other's gaps. The inter-colour offset can be drifted
 * gradually — along the lines, across the block, and by noise — so the inks
 * weave between sitting on top of one another (coincident) and spreading into
 * an even multi-ink grating. That beating is the texture/noise.
 *
 * Pure and deterministic per `seed`. Every line is a real stroked polyline
 * tagged with a `band-NN` layer, so the drawing plots one pen per ink.
 */
export interface OverlappedLinesOptions {
  width: number;
  height: number;
  /** Clear border kept free of marks, px. */
  margin?: number;
  /** Line direction in degrees; 0 = vertical (lines run down the page). */
  angleDeg?: number;
  /** Line length as a fraction of the usable page span, 0..1. */
  lineLengthPct?: number;
  /** Gap between adjacent lines within one ink, px. */
  spacingPx?: number;
  /** Number of inks (interleaved gratings). */
  colorCount?: number;
  /**
   * Extra inter-colour offset built up from one end of each line to the
   * other, px. Non-zero bends the lines and weaves the inks down the page.
   */
  phaseDriftAlongPx?: number;
  /**
   * Extra inter-colour offset built up across the block (perpendicular),
   * px. Non-zero opens and closes the interleave across the page while every
   * line stays straight.
   */
  phaseDriftAcrossPx?: number;
  /** Noise-driven inter-colour offset amplitude, px. */
  phaseNoiseAmpPx?: number;
  /** Spatial frequency of the phase noise (cycles per px). */
  phaseNoiseScale?: number;
  /** Random per-point perpendicular shake, px. */
  jitterPx?: number;
  /** Peak low-frequency wobble of each line, px. */
  wobbleAmpPx?: number;
  /** Wobble wavelength along the line, px. */
  wobbleWavelengthPx?: number;
  seed?: number;
}

/** The export layer name for ink band index i (zero-padded so layers sort). */
export function bandLayerName(i: number): string {
  return `band-${String(i).padStart(2, '0')}`;
}

export function generateOverlappedLines(options: OverlappedLinesOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    angleDeg = 0,
    lineLengthPct = 1,
    spacingPx = 8,
    colorCount = 2,
    phaseDriftAlongPx = 0,
    phaseDriftAcrossPx = 0,
    phaseNoiseAmpPx = 0,
    phaseNoiseScale = 0.01,
    jitterPx = 0,
    wobbleAmpPx = 0,
    wobbleWavelengthPx = 120,
    seed = Math.floor(Math.random() * 1000000),
  } = options;

  const noise = createNoise(seed);
  const colors = Math.max(1, Math.round(colorCount));
  const spacing = Math.max(0.5, spacingPx);
  // Even interleave: ink k sits k/colors of the way into the gap.
  const baseStep = spacing / colors;

  const cx = width / 2;
  const cy = height / 2;
  const rad = (angleDeg * Math.PI) / 180;
  // Line direction (0° = straight down) and its perpendicular.
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const px = Math.cos(rad);
  const py = -Math.sin(rad);

  const usableW = Math.max(0, width - 2 * margin);
  const usableH = Math.max(0, height - 2 * margin);
  // Half-extents of the usable rectangle along the line and across the block.
  const halfA = 0.5 * Math.max(0, Math.min(1, lineLengthPct)) *
    (Math.abs(dx) * usableW + Math.abs(dy) * usableH);
  const halfP = 0.5 * (Math.abs(px) * usableW + Math.abs(py) * usableH);

  const minX = margin;
  const minY = margin;
  const maxX = width - margin;
  const maxY = height - margin;
  const inBounds = (x: number, y: number): boolean =>
    x >= minX && x <= maxX && y >= minY && y <= maxY;

  const lines: FlowLine[] = [];
  if (halfA <= 0 || halfP <= 0 || colors < 1) {
    return { lines, width, height, seed };
  }

  // Sample finely enough that drifting / noisy lines stay smooth.
  const step = Math.max(2, Math.min(8, halfA / 12));

  // The interleave-spread field shared by every ink: ink k is offset by
  // k * field(a, b). field == baseStep is the even interleave; smaller pulls
  // the inks together, larger spreads them past each other.
  const field = (a: number, b: number): number =>
    baseStep +
    phaseDriftAlongPx * (a / halfA) +
    phaseDriftAcrossPx * (b / halfP) +
    phaseNoiseAmpPx * noise.noise2D(b * phaseNoiseScale, a * phaseNoiseScale);

  // Base grating positions across the block, centred.
  const firstB = -Math.ceil(halfP / spacing) * spacing;
  for (let b = firstB; b <= halfP + 1e-6; b += spacing) {
    for (let k = 0; k < colors; k++) {
      let run: Point[] = [];
      const flush = (): void => {
        if (run.length >= 2) lines.push({ points: run, layer: bandLayerName(k), pen: 'fine' });
        run = [];
      };
      for (let a = -halfA; a <= halfA + 1e-6; a += step) {
        const wob =
          wobbleAmpPx > 0
            ? wobbleAmpPx * noise.fbm(a / wobbleWavelengthPx, b * 0.013 + k * 1.7, 2, 0.5, 2.2)
            : 0;
        const jit = jitterPx > 0 ? jitterPx * noise.noise2D(a * 0.5 + k * 13.1, b * 0.5) : 0;
        const perp = b + k * field(a, b) + wob + jit;
        const x = cx + dx * a + px * perp;
        const y = cy + dy * a + py * perp;
        if (!inBounds(x, y)) {
          flush();
          continue;
        }
        run.push({ x, y });
      }
      flush();
    }
  }

  return { lines, width, height, seed };
}
