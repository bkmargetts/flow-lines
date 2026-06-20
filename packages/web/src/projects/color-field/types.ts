/**
 * Colour Field settings — dense directional lines banded into a soft gradient
 * (a Rothko-style colour field) plus optional geometric accents cutting through
 * it. Distances are in mm (mapped to px in `render.ts`); palette/seed/pen-width
 * follow the same conventions as the other generative modules.
 */

export type AccentType = 'bar' | 'gap';
export type AccentOrientation = 'vertical' | 'horizontal';

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
  /** Number of colour bands = pen layers, sampled from the palette. */
  colorCount: number;
  palette: string;
  customRamp: string[];
  bandWaveAmpMm: number;
  bandWaveLengthMm: number;
  featherMm: number;
  featherNoiseScale: number;
  densityGradient: number;
  densityNoiseAmt: number;
  densityNoiseScale: number;
  jitterMm: number;
  wobbleAmpMm: number;
  wobbleWavelengthMm: number;
  minSegmentLengthMm: number;
  penWidthMm: number;
  seed: number;
  accents: AccentUIState[];
}

export const defaultColorFieldState: ColorFieldState = {
  angleDeg: 0,
  lineLengthPct: 1,
  spacingMm: 1.2,
  colorCount: 4,
  palette: 'ice',
  customRamp: ['#caf0f8', '#48cae4', '#0077b6', '#023e8a'],
  bandWaveAmpMm: 8,
  bandWaveLengthMm: 60,
  featherMm: 14,
  featherNoiseScale: 0.02,
  densityGradient: 1.4,
  densityNoiseAmt: 0.15,
  densityNoiseScale: 0.01,
  jitterMm: 0.1,
  wobbleAmpMm: 0.4,
  wobbleWavelengthMm: 40,
  minSegmentLengthMm: 1.5,
  penWidthMm: 0.3,
  seed: Math.floor(Math.random() * 1000000),
  accents: [],
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
