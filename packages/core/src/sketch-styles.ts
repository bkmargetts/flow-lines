/**
 * Shared "sketch" character for hand-drawn overdraw. A sketch redraws every line
 * a few times with low-frequency wobble; the style sets the character (how many
 * passes, the wobble wavelength / amplitude / per-stroke jitter) and `intensity`
 * (0..1) scales it. Used by the Vine, Planet and Landscape generators (via the
 * `applySketch` finishing pass below) and by the web app's per-layer sketch
 * finishing stage, so every generator shares one vocabulary of hand-drawn looks.
 */
import { applyHandDrawnStyle } from './hand-drawn.js';
import type { FlowLine, FlowLinesResult } from './flow-lines.js';

export type SketchStyle = 'loose' | 'fine' | 'gestural' | 'scratchy';

export interface SketchStyleConfig {
  /** Number of decorrelated redraw passes. */
  passes: number;
  /** Wobble wavelength along the stroke, px. */
  wavelength: number;
  /** Peak perpendicular wobble, px. */
  amplitude: number;
  /** Whole-stroke misregistration jitter, px. */
  jitter: number;
}

/** Map a style + intensity to concrete hand-drawn-pass parameters. */
export function getSketchStyleConfig(style: SketchStyle, intensity: number): SketchStyleConfig {
  const s = style;
  const passes =
    s === 'fine' || s === 'scratchy' ? 1 + Math.round(intensity * 3) :
    s === 'gestural' ? 1 + Math.round(intensity) :
    1 + Math.round(intensity * 2);
  const wavelength = s === 'gestural' ? 70 : s === 'fine' ? 16 : s === 'scratchy' ? 12 : 28;
  const amplitude =
    s === 'gestural' ? 0.8 + intensity * 3 :
    s === 'fine' ? 0.3 + intensity * 0.9 :
    s === 'scratchy' ? 0.4 + intensity * 1.2 :
    0.5 + intensity * 1.6;
  const jitter = s === 'scratchy' ? intensity * 2 : s === 'gestural' ? intensity * 1.6 : intensity * 1.1;
  return { passes, wavelength, amplitude, jitter };
}

/**
 * Apply a sketch overdraw to a finished set of lines: redraw every line
 * `passes` times with the style's low-frequency wobble, concatenating the
 * passes so the strokes read as hand-drawn. This is the one shared mechanism
 * behind the sketch look — the Vine / Planet / Landscape generators call it,
 * and the web app runs it as a generic per-layer finishing stage.
 *
 * Returns `result` untouched when `intensity` is negligible, or when
 * `opts.lineCap` is set and the multiplied line count would exceed it (a guard
 * against exploding huge line sets — matches the Vine Generator's cap). The
 * per-pass seed scheme (`seed + p * 9301 + 7`) is preserved exactly so output
 * is identical to the generators' previous inline loops.
 */
export function applySketch(
  result: FlowLinesResult,
  style: SketchStyle,
  intensity: number,
  opts: { lineCap?: number } = {}
): FlowLinesResult {
  if (intensity <= 0.01) return result;
  const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(style, intensity);
  if (opts.lineCap !== undefined && result.lines.length * passes >= opts.lineCap) {
    return result;
  }
  const { lines, width, height, seed = 0 } = result;
  const acc: FlowLine[] = [];
  for (let p = 0; p < passes; p++) {
    const pseed = seed + p * 9301 + 7;
    const styled = applyHandDrawnStyle(
      { lines, width, height, seed: pseed },
      { amplitude, wavelength, jitter, seed: pseed }
    ).lines;
    for (const l of styled) acc.push(l);
  }
  return { ...result, lines: acc };
}
