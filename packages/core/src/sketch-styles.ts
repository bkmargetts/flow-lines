/**
 * Shared "sketch" character for hand-drawn overdraw. A sketch redraws every line
 * a few times with low-frequency wobble; the style sets the character (how many
 * passes, the wobble wavelength / amplitude / per-stroke jitter) and `intensity`
 * (0..1) scales it. Used by the Vine and Planet generators so they share one
 * vocabulary of hand-drawn looks.
 */
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
