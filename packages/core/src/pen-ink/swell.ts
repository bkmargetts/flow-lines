import { FlowLine, Point } from '../flow-lines.js';
import { trimPolyline, offsetPolyline } from '../lib/polyline.js';

/**
 * Build the offset emphasis passes that thicken a line with a single pen:
 * each pass is the parent polyline offset sideways and trimmed at both
 * ends so the built-up line tapers like a real ink stroke instead of
 * ending in a blunt bar. Shared by bold contour emphasis and the swelling
 * line weight below — the arithmetic (and float order) is exactly the
 * original bold-outline recipe.
 */
export function offsetEmphasisPasses(
  points: Point[],
  passes: number,
  spread: number,
  trimFraction: number
): Point[][] {
  const out: Point[][] = [];
  for (let pass = 1; pass < passes; pass++) {
    const offset = spread * (pass - (passes - 1) / 2);
    const trimmed = trimPolyline(offsetPolyline(points, offset), trimFraction);
    if (trimmed.length >= 2) {
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * Darkness levels at which a hatch line earns another emphasis pass. The
 * ramp starts in the midtone shadows and tops out short of black so the
 * deepest tones read clearly heavier than the mids.
 */
export const SWELL_THRESHOLDS = [0.45, 0.65, 0.8];

/**
 * How many swell passes a point at darkness `d` carries (fractional —
 * smoothstepped across each threshold so the spacing compensation ramps
 * without banding), capped at `maxPasses`.
 */
export function swellPassCount(d: number, maxPasses: number): number {
  let count = 0;
  for (let k = 0; k < Math.min(maxPasses, SWELL_THRESHOLDS.length); k++) {
    const t = Math.min(1, Math.max(0, (d - SWELL_THRESHOLDS[k]) / 0.08));
    count += t * t * (3 - 2 * t);
  }
  return count;
}

export interface LineSwellOptions {
  /** Swell strength 0-1: how many passes the darks earn (up to 3) */
  lineSwell: number;
  /** Physical length scale (see PenInkOptions.scale) */
  scale: number;
  /** Tone at canvas coordinates — the same field that drives spacing */
  darknessAt: (x: number, y: number) => number;
}

/** Number of extra passes the darkest tone earns at this swell strength */
export function swellPasses(lineSwell: number): number {
  return Math.max(1, Math.round(lineSwell * 3));
}

/**
 * Swelling line weight, the engraver's tool: where a stroke passes through
 * shadow it thickens — extra offset passes of the same pen build the weight
 * up and taper back to a single line in the light. Applied to the traced
 * tone layers as a post-pass: each line is scanned for contiguous runs
 * darker than each threshold, and every qualifying run emits one trimmed
 * offset pass, alternating sides so the line fattens symmetrically.
 *
 * Returns the extra pass lines to append; the originals are untouched.
 * Callers must compensate spacing (see swellPassCount) or the darks
 * double-darken into mud.
 */
export function applyLineSwell(lines: FlowLine[], options: LineSwellOptions): FlowLine[] {
  const { lineSwell, scale, darknessAt } = options;
  if (lineSwell <= 0) return [];

  const passes = swellPasses(lineSwell);
  // Sub-pen-width offsets: the passes overlap the parent into one fat
  // stroke rather than reading as separate parallel lines
  const spread = 0.55 * scale;
  // A weight run is a passage along the line, not a dot: short shadow
  // crossings stay single-weight, or the swell reads as barbs
  const minRun = 12 * scale;

  const extra: FlowLine[] = [];

  for (const line of lines) {
    // Bold contours have their own emphasis; solid fill is already ink
    if (line.pen === 'bold' || line.layer === 'fill') continue;
    if (line.points.length < 3) continue;

    // Only lines long enough to read as line-system passages swell —
    // weight on a short tick or stipple mark reads as a thorn
    let parentLength = 0;
    for (let i = 1; i < line.points.length; i++) {
      parentLength += Math.hypot(
        line.points[i].x - line.points[i - 1].x,
        line.points[i].y - line.points[i - 1].y
      );
    }
    if (parentLength < 2 * minRun) continue;

    for (let k = 1; k <= passes; k++) {
      const threshold = SWELL_THRESHOLDS[k - 1];
      // Alternate sides, stepping outward: +1, -1, +2 (in half-spreads)
      const offset = spread * Math.ceil(k / 2) * (k % 2 === 1 ? 1 : -1);

      let run: Point[] = [];
      let runLength = 0;

      const flush = (): void => {
        if (run.length >= 3 && runLength >= minRun) {
          const swelled = trimPolyline(offsetPolyline(run, offset), 0.12);
          if (swelled.length >= 2) {
            const out: FlowLine = { points: swelled };
            if (line.layer !== undefined) out.layer = line.layer;
            extra.push(out);
          }
        }
        run = [];
        runLength = 0;
      };

      for (const p of line.points) {
        if (darknessAt(p.x, p.y) >= threshold) {
          if (run.length > 0) {
            const prev = run[run.length - 1];
            runLength += Math.hypot(p.x - prev.x, p.y - prev.y);
          }
          run.push(p);
        } else {
          flush();
        }
      }
      flush();
    }
  }

  return extra;
}
