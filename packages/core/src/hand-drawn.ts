import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { createNoise } from './noise.js';

export interface HandDrawnOptions {
  /** Peak perpendicular wobble in px (default 1) */
  amplitude?: number;
  /** Wobble wavelength along the stroke in px (default 60) */
  wavelength?: number;
  /** Random shift of each whole stroke in px, simulating pen misregistration (default amplitude * 0.6) */
  jitter?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Make strokes look hand-drawn: each line gets a smooth low-frequency
 * perpendicular wobble (no two strokes wobble alike), a slight random
 * amplitude variation, and a small whole-stroke offset so repeated parallel
 * lines don't register perfectly — the way real pen hatching never does.
 */
export function applyHandDrawnStyle(
  result: FlowLinesResult,
  options: HandDrawnOptions = {}
): FlowLinesResult {
  const amplitude = options.amplitude ?? 1;
  const wavelength = Math.max(options.wavelength ?? 60, 1);
  const jitter = options.jitter ?? amplitude * 0.6;
  const seed = options.seed ?? result.seed;

  if (amplitude <= 0 && jitter <= 0) {
    return result;
  }

  const noise = createNoise(seed);

  const lines: FlowLine[] = result.lines.map((line, lineIndex) => {
    if (line.points.length < 2) {
      return { points: line.points.map((p) => ({ ...p })) };
    }

    // Per-line noise track, offset so strokes are decorrelated
    const track = lineIndex * 0.731 + 0.5;

    // Vary how shaky this particular stroke is
    const lineAmplitude = amplitude * (0.7 + 0.6 * (noise.noise2D(track, -7.3) * 0.5 + 0.5));

    const offsetX = jitter * noise.noise2D(track, 11.7);
    const offsetY = jitter * noise.noise2D(track, 23.1);

    const points: Point[] = new Array(line.points.length);
    let arc = 0;

    for (let i = 0; i < line.points.length; i++) {
      const p = line.points[i];

      if (i > 0) {
        const prev = line.points[i - 1];
        arc += Math.hypot(p.x - prev.x, p.y - prev.y);
      }

      // Local tangent from neighbouring points
      const ahead = line.points[Math.min(i + 1, line.points.length - 1)];
      const behind = line.points[Math.max(i - 1, 0)];
      const tx = ahead.x - behind.x;
      const ty = ahead.y - behind.y;
      const len = Math.hypot(tx, ty) || 1;

      const wobble =
        lineAmplitude * noise.fbm(arc / wavelength, track, 2, 0.5, 2.2);

      points[i] = {
        x: p.x + offsetX + (-ty / len) * wobble,
        y: p.y + offsetY + (tx / len) * wobble,
      };
    }

    return { points };
  });

  return { ...result, lines };
}
