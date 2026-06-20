/**
 * Colour Field settings — a soft gradient built by *combining* inks (like the
 * grating) rather than banding them: every ink is an interleaved grating across
 * the whole field, and each ink's density drifts along a gradient coordinate so
 * overlapping colours optically mix. Distances are in mm (mapped to px in
 * `render.ts`); palette / seed / pen-width follow the other generative modules.
 */

export type AccentType = 'bar' | 'gap';
export type AccentOrientation = 'vertical' | 'horizontal';
export type GradientMode = 'linear' | 'radial';

/** One geometric accent, in UI units (mm + fractions + a bar colour). */
export interface AccentUIState {
  type: AccentType;
  orientation: AccentOrientation;
  /** Position across the page, 0..1. */
  posPct: number;
  /** Start along the accent's length axis, 0..1. */
  startPct: number;
  /** Length along the axis, 0..1. */
  lenPct: number;
  /** Thickness across the axis, mm. */
  thicknessMm: number;
  /** Soften a bar's ends to points. */
  taper: boolean;
  /** Ink for a `bar` accent (ignored for `gap`). */
  color: string;
}

export interface ColorFieldState {
  angleDeg: number;
  lineLengthPct: number;
  spacingMm: number;
  /** Number of inks = pen layers, sampled along the gradient and mixed. */
  colorCount: number;
  palette: string;
  customRamp: string[];

  gradientMode: GradientMode;
  gradientAngleDeg: number;
  focalXPct: number;
  focalYPct: number;
  gradientRadiusPct: number;
  blend: number;
  gradientNoiseAmpMm: number;
  gradientNoiseScale: number;
  ditherScale: number;

  jitterMm: number;
  wobbleAmpMm: number;
  wobbleWavelengthMm: number;
  minSegmentLengthMm: number;
  penWidthMm: number;
  seed: number;
  accents: AccentUIState[];
  /** Overprint: where inks of different colours overlap, multiply them so the
   *  overlap shows the blended colour (like two pens overprinting). */
  blendInks: boolean;
}

export const defaultColorFieldState: ColorFieldState = {
  angleDeg: 0,
  lineLengthPct: 1,
  spacingMm: 1.2,
  colorCount: 4,
  palette: 'ice',
  customRamp: ['#caf0f8', '#48cae4', '#0077b6', '#023e8a'],

  gradientMode: 'linear',
  gradientAngleDeg: 0,
  focalXPct: 0.5,
  focalYPct: 0.4,
  gradientRadiusPct: 0.7,
  blend: 1.4,
  gradientNoiseAmpMm: 6,
  gradientNoiseScale: 0.004,
  ditherScale: 0.04,

  jitterMm: 0.1,
  wobbleAmpMm: 0.4,
  wobbleWavelengthMm: 40,
  minSegmentLengthMm: 1,
  penWidthMm: 0.3,
  seed: Math.floor(Math.random() * 1000000),
  accents: [],
  blendInks: false,
};

/** A sensible fresh accent (a contrasting vertical bar, as in the references). */
export const defaultAccent: AccentUIState = {
  type: 'bar',
  orientation: 'vertical',
  posPct: 0.5,
  startPct: 0.08,
  lenPct: 0.45,
  thicknessMm: 2,
  taper: true,
  color: '#f48c06',
};
