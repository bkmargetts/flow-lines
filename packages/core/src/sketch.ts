import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { getSketchStyleConfig, SketchStyle } from './sketch-styles.js';
import { makeRandom, subSeed } from './lib/rng.js';
import { trimPolyline, clipPolylineToRect } from './lib/polyline.js';

export interface SketchOptions {
  /** Character of the hand: loose | fine | gestural | scratchy (default 'loose') */
  style?: SketchStyle;
  /** Overall strength 0..1 (default 0.5). <= 0 returns the input untouched. */
  intensity?: number;
  /** Random seed (default result.seed). Same seed + options => identical output. */
  seed?: number;
  /** Multiplies every px-denominated length, so the look is stable across render resolutions (default 1). */
  scale?: number;
  /** Overdraw passes; overrides the style-derived count (1 = no overdraw). */
  passes?: number;
  /** Overshoot strength 0..1 (default 0.35): jittered tangent extension at open line ends. */
  overshoot?: number;
  /** Pen-lift break frequency 0..1 (default 0.25): 0 = continuous strokes. */
  breaks?: number;
  /** End-taper fraction on overdraw passes 0..0.2 (default 0.08). */
  taper?: number;
  /**
   * Pen layers drawn with a steady hand: damped wobble + misregistration only,
   * a single pass, never broken or overshot (e.g. the page border). Bold-pen
   * lines are always steady — emphasis passes must not double in ink.
   */
  steadyLayers?: string[];
  /** Safety cap on output line count (default 20000): overdraw passes degrade to fit. */
  maxLines?: number;
  /** Clip the sketched output to this rect last (wobble/overshoot move points). */
  clipRect?: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * The unified hand-sketch finish: make any generator's output read as drawn in
 * strokes by a person rather than traced by a machine. Every line gets the
 * shared hand-drawn wobble + misregistration; long strokes occasionally break
 * where the pen lifts and resumes; open ends overshoot their stopping point;
 * and the whole drawing is optionally restated in decorrelated overdraw passes
 * whose frayed (tapered) ends never stack flush. Bold-pen lines and
 * caller-named steady layers keep a single committed pass. Deterministic per
 * seed, plain polylines in = plain polylines out — plottability is preserved.
 */
export function applySketch(result: FlowLinesResult, options: SketchOptions = {}): FlowLinesResult {
  const intensity = options.intensity ?? 0.5;
  if (intensity <= 0 || result.lines.length === 0) return result;

  const style = options.style ?? 'loose';
  const seed = options.seed ?? result.seed;
  const scale = options.scale ?? 1;
  const config = getSketchStyleConfig(style, intensity);
  const passes = Math.max(1, Math.round(options.passes ?? config.passes));
  const wavelength = config.wavelength * scale;
  const amplitude = config.amplitude * scale;
  const jitter = config.jitter * scale;
  const overshoot = options.overshoot ?? 0.35;
  const breaks = options.breaks ?? 0.25;
  const taper = options.taper ?? 0.08;
  const steadyLayers = options.steadyLayers ?? [];
  const maxLines = options.maxLines ?? 20000;

  // ---- Partition: bold emphasis and steady layers are drawn once, calmly ----
  const steadyBold: FlowLine[] = [];
  const steadyLayer: FlowLine[] = [];
  const sketchy: FlowLine[] = [];
  // For reassembly in original order: 0 = bold, 1 = steady layer, 2 = sketchy,
  // paired with the line's index within its partition.
  const slots: Array<{ kind: 0 | 1 | 2; index: number }> = new Array(result.lines.length);
  for (let i = 0; i < result.lines.length; i++) {
    const line = result.lines[i];
    if (line.pen === 'bold') {
      slots[i] = { kind: 0, index: steadyBold.length };
      steadyBold.push(line);
    } else if (line.layer != null && steadyLayers.includes(line.layer)) {
      slots[i] = { kind: 1, index: steadyLayer.length };
      steadyLayer.push(line);
    } else {
      slots[i] = { kind: 2, index: sketchy.length };
      sketchy.push(line);
    }
  }

  // ---- Pen-lift breaks, before the pass loop so every restatement retraces
  //      the same fragments (a hand re-states the same marks) ----
  const minFragPx = 6 * scale;
  const fragments: FlowLine[][] = new Array(sketchy.length);
  let fragCount = 0;
  for (let i = 0; i < sketchy.length; i++) {
    const line = sketchy[i];
    if (breaks > 0 && line.points.length >= 2) {
      const rng = makeRandom(subSeed(seed, 1000 + i));
      const breakEveryPx = (260 * scale) / breaks;
      const frags = breakLine(line.points, rng, breakEveryPx, scale, minFragPx);
      fragments[i] = frags.map((points) => ({ ...line, points }));
    } else {
      fragments[i] = [line];
    }
    fragCount += fragments[i].length;
  }

  // ---- Safety cap: degrade overdraw before it degrades the plot ----
  const effPasses =
    fragCount * passes > maxLines ? Math.max(1, Math.floor(maxLines / Math.max(1, fragCount))) : passes;

  // ---- Steady lines: one damped hand-drawn pass each ----
  const styledBold = steadyBold.length
    ? applyHandDrawnStyle(
        { ...result, lines: steadyBold, seed: subSeed(seed, 511) },
        // hand-drawn damps bold-pen wobble itself (0.55)
        { amplitude, wavelength, jitter, seed: subSeed(seed, 511) }
      ).lines
    : [];
  const styledSteady = steadyLayer.length
    ? applyHandDrawnStyle(
        { ...result, lines: steadyLayer, seed: subSeed(seed, 512) },
        { amplitude: amplitude * 0.55, wavelength, jitter: jitter * 0.55, seed: subSeed(seed, 512) }
      ).lines
    : [];

  // ---- Overdraw passes: taper (restatements only) → overshoot → wobble ----
  const overLen = overshoot * 9 * scale;
  const passLines: FlowLine[][] = [];
  // Fragment offsets per sketchy line within a pass array, for reassembly.
  const fragStart: number[] = new Array(sketchy.length);
  for (let p = 0; p < effPasses; p++) {
    const rng = makeRandom(subSeed(seed, 5000 + p));
    const acc: FlowLine[] = [];
    for (let i = 0; i < sketchy.length; i++) {
      if (p === 0) fragStart[i] = acc.length;
      for (const frag of fragments[i]) {
        let points = frag.points;
        if (p > 0) {
          points = trimPolyline(points, taper * (0.5 + rng()));
          // No restatement confetti: short fragments are stated once
          if (pathLength(points) < 15 * scale) continue;
        }
        if (overshoot > 0 && overLen > 0) {
          points = overshootEnds(points, overLen, scale, rng);
        }
        acc.push({ ...frag, points });
      }
    }
    const pseed = subSeed(seed, p);
    passLines.push(
      applyHandDrawnStyle(
        { ...result, lines: acc, seed: pseed },
        // Restatements stray slightly wider than the primary stroke
        { amplitude: p === 0 ? amplitude : amplitude * 1.15, wavelength, jitter, seed: pseed }
      ).lines
    );
  }

  // ---- Reassemble in original line order (pass 0 sets pen-layer first
  //      appearance, so SVG layer stacking is unchanged), restatements after ----
  const out: FlowLine[] = [];
  for (let i = 0; i < result.lines.length; i++) {
    const slot = slots[i];
    if (slot.kind === 0) out.push(styledBold[slot.index]);
    else if (slot.kind === 1) out.push(styledSteady[slot.index]);
    else {
      const start = fragStart[slot.index];
      const end = slot.index + 1 < sketchy.length ? fragStart[slot.index + 1] : passLines[0].length;
      for (let f = start; f < end; f++) out.push(passLines[0][f]);
    }
  }
  for (let p = 1; p < effPasses; p++) {
    for (const line of passLines[p]) out.push(line);
  }

  // ---- Clip last: wobble and overshoot have moved points ----
  let lines = out;
  if (options.clipRect) {
    const { x0, y0, x1, y1 } = options.clipRect;
    const clipped: FlowLine[] = [];
    for (const line of lines) {
      for (const run of clipPolylineToRect(line.points, x0, y0, x1, y1)) {
        clipped.push({ ...line, points: run });
      }
    }
    lines = clipped;
  }

  return { ...result, lines };
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/**
 * Split a polyline where the pen lifts: cuts arrive every `breakEveryPx`
 * (±40%), each opening a small gap, with exact break points interpolated on
 * the segment they land in. Fragments shorter than `minFragPx` are dropped.
 */
function breakLine(
  points: Point[],
  rng: () => number,
  breakEveryPx: number,
  scale: number,
  minFragPx: number
): Point[][] {
  // Short strokes are single marks — a lift inside one reads as dirt
  if (pathLength(points) < 3 * minFragPx) return [points];

  const frags: Point[][] = [];
  let run: Point[] = [];
  const flush = () => {
    if (run.length >= 2 && pathLength(run) >= minFragPx) frags.push(run);
    run = [];
  };

  let nextLift = breakEveryPx * (0.6 + 0.8 * rng());
  let gapEnd = -1; // arc position where the current gap ends (-1 = drawing)
  let arc = 0;
  run.push(points[0]);

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen === 0) continue;
    const segArcStart = arc;
    arc += segLen;

    // Resolve any lift/resume events that land inside this segment
    while (true) {
      if (gapEnd < 0 && nextLift <= arc) {
        // Pen lifts at `nextLift`
        const t = (nextLift - segArcStart) / segLen;
        run.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        flush();
        gapEnd = nextLift + (2 + 4 * rng()) * scale;
        nextLift += breakEveryPx * (0.6 + 0.8 * rng());
      } else if (gapEnd >= 0 && gapEnd <= arc) {
        // Pen resumes at `gapEnd`
        const t = (gapEnd - segArcStart) / segLen;
        run = [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }];
        gapEnd = -1;
      } else {
        break;
      }
    }

    if (gapEnd < 0) run.push(b);
  }
  flush();
  return frags.length ? frags : [points];
}

/**
 * Extend a polyline's open ends past their stopping point along the end
 * tangent — the classic sketch tell. Jittered per end and skipped ~30% of the
 * time (uniform overshoot is its own machine tell); closed loops and short
 * marks are left alone. The extension is emitted as two interpolated points so
 * the wobble pass bends it like the rest of the stroke.
 */
function overshootEnds(points: Point[], overLen: number, scale: number, rng: () => number): Point[] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const closed = Math.hypot(last.x - first.x, last.y - first.y) < 1e-6;
  const doStart = rng() < 0.7;
  const doEnd = rng() < 0.7;
  const startLen = overLen * (0.4 + 1.2 * rng());
  const endLen = overLen * (0.4 + 1.2 * rng());
  if (closed || pathLength(points) < 4 * overLen) return points;

  const out = points.slice();
  if (doStart) {
    const dir = endTangent(points, true, 3 * scale);
    if (dir) {
      out.unshift(
        { x: first.x + dir.x * startLen, y: first.y + dir.y * startLen },
        { x: first.x + dir.x * startLen * 0.5, y: first.y + dir.y * startLen * 0.5 }
      );
    }
  }
  if (doEnd) {
    const dir = endTangent(points, false, 3 * scale);
    if (dir) {
      out.push(
        { x: last.x + dir.x * endLen * 0.5, y: last.y + dir.y * endLen * 0.5 },
        { x: last.x + dir.x * endLen, y: last.y + dir.y * endLen }
      );
    }
  }
  return out;
}

/** Outward unit tangent at an end, measured from a point ~`insetPx` inside the
 *  end for stability against vertex-level noise. */
function endTangent(points: Point[], atStart: boolean, insetPx: number): Point | null {
  const end = atStart ? points[0] : points[points.length - 1];
  let inner = atStart ? points[1] : points[points.length - 2];
  let travelled = 0;
  const step = atStart ? 1 : -1;
  let i = atStart ? 1 : points.length - 2;
  let prev = end;
  while (i >= 0 && i < points.length) {
    travelled += Math.hypot(points[i].x - prev.x, points[i].y - prev.y);
    inner = points[i];
    if (travelled >= insetPx) break;
    prev = points[i];
    i += step;
  }
  const dx = end.x - inner.x;
  const dy = end.y - inner.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}
