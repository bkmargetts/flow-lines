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
  /**
   * Optional per-location multiplier on the wobble amplitude, sampled at
   * each stroke's midpoint (e.g. to loosen background strokes)
   */
  amplitudeScale?: (x: number, y: number) => number;
  /**
   * Per-layer wobble multipliers keyed by `FlowLine.layer` (e.g.
   * `{ fill: 0.25 }` keeps solid-fill passes calm so no paper gaps open
   * between them). Applies to both wobble and misregistration jitter;
   * layers not listed are unaffected
   */
  layerAmplitude?: Record<string, number>;
  /**
   * Hard cap on each point's TOTAL displacement (wobble + misregistration
   * combined), px. Generators that reserve paper before the hand pass
   * (hidden-line gaps sized to a wobble budget) pass their budget here so
   * the statistical tail of wobble-plus-jitter can never bend erased ink
   * back into a reserved gap. Unset = uncapped (the historical behavior).
   */
  maxDisplacement?: number;
  /**
   * Extra steadiness for `pen: 'bold'` strokes' whole-stroke misregistration,
   * 0..1 (default 1 — unchanged).
   *
   * Bold strokes already get a calmer wobble, but the rigid per-stroke offset
   * below is applied at full strength regardless of pen, so a bold line ends up
   * only about 13% steadier overall rather than the 45% the wobble scale
   * suggests. Generators that lean on `pen: 'bold'` for a confident keyline can
   * damp the offset too; left at 1 every existing caller draws exactly as
   * before.
   */
  boldJitterScale?: number;
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
      return { ...line, points: line.points.map((p) => ({ ...p })) };
    }

    // Bold contour lines are drawn with commitment — less shake
    const penScale = line.pen === 'bold' ? 0.55 : 1;
    // Whole layers can be calmed by name (solid fill must stay tight or
    // paper gaps open between its passes)
    const layerScale =
      (line.layer !== undefined && options.layerAmplitude?.[line.layer]) || 1;

    // Per-line noise track, offset so strokes are decorrelated
    const track = lineIndex * 0.731 + 0.5;

    const midpoint = line.points[Math.floor(line.points.length / 2)];
    const localScale = options.amplitudeScale
      ? options.amplitudeScale(midpoint.x, midpoint.y)
      : 1;

    // Vary how shaky this particular stroke is
    const lineAmplitude =
      amplitude *
      localScale *
      penScale *
      layerScale *
      (0.7 + 0.6 * (noise.noise2D(track, -7.3) * 0.5 + 0.5));

    const boldJitter = line.pen === 'bold' ? (options.boldJitterScale ?? 1) : 1;
    const offsetX = jitter * layerScale * boldJitter * noise.noise2D(track, 11.7);
    const offsetY = jitter * layerScale * boldJitter * noise.noise2D(track, 23.1);

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

      if (options.maxDisplacement === undefined) {
        points[i] = {
          x: p.x + offsetX + (-ty / len) * wobble,
          y: p.y + offsetY + (tx / len) * wobble,
        };
      } else {
        let dx = offsetX + (-ty / len) * wobble;
        let dy = offsetY + (tx / len) * wobble;
        const d = Math.hypot(dx, dy);
        if (d > options.maxDisplacement) {
          const scale = options.maxDisplacement / d;
          dx *= scale;
          dy *= scale;
        }
        points[i] = { x: p.x + dx, y: p.y + dy };
      }
    }

    return { ...line, points };
  });

  return { ...result, lines };
}
