import { randomSeed } from '../../lib/random';

/**
 * UI state for the Vent Hoses generator (mm / 0..1 / deg units). `render.ts`
 * converts it to the core's `VentHosesOptions` in px. Corrugated flexible
 * ducts of mixed diameters worming across the page, weaving over and under
 * with reserved-paper crossings.
 */
export interface VentHosesState {
  seed: number;

  // Scene
  count: number;
  radiusMinMm: number;
  radiusMaxMm: number;
  wander: number; // 0..1 curvature energy
  cuffChance: number; // 0..1 on-page open ends
  clearanceMm: number; // extra paper between parallel hoses

  // Marks
  ringDensity: number; // 0..1 corrugation pitch
  ringCurve: number; // 0..1 ring ellipse bulge
  shading: number; // 0..1 shadow-side hatch
  lightAngleDeg: number;
  shadowHatch: number; // 0..1 contact shadows at crossings
  weaveBias: number; // 0..1 "fat duct lies on top" fraction
  gapMm: number; // reserved paper at crossings

  // Pen / ink
  penWidthMm: number;
  wobbleMm: number;
  strokeColor: string;
}

export const defaultVentHosesState: VentHosesState = {
  seed: randomSeed(),

  count: 7,
  radiusMinMm: 3,
  radiusMaxMm: 8,
  wander: 0.55,
  cuffChance: 0.25,
  clearanceMm: 1.5,

  ringDensity: 0.6,
  ringCurve: 0.6,
  shading: 0.45,
  lightAngleDeg: 315,
  shadowHatch: 0.6,
  weaveBias: 0.35,
  gapMm: 0.8,

  penWidthMm: 0.4,
  wobbleMm: 0.25,
  strokeColor: '#1f1f1c',
};
