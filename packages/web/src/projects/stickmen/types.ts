import type { FacingMode } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for the Stick Men generator (mm / 0..1 / int units). `render.ts`
 * converts it to the core's `StickmenOptions` in px. A crowd of thin stick
 * figures on an isometric ground plane, with smoothly-curved (rounded) limbs.
 */
export interface StickmenState {
  seed: number;
  zoom: number;

  // Scene / placement
  count: number;
  spread: number; // world-region multiplier
  clustering: number; // 0..1
  minSeparationMm: number;
  facing: FacingMode;
  facingAngleDeg: number; // procession / toward direction
  facingJitterDeg: number;

  // Figure
  figureHeightMm: number; // mean standing height
  scaleVariance: number; // 0..1
  limbCurve: number; // 0 = angular, 1 = very rounded
  penWidthMm: number;

  // Pose
  poseEnergy: number; // 0..1

  // Render
  occlude: boolean;
  groundContact: boolean;
  wobbleMm: number;

  // Ink
  strokeColor: string;
}

export const defaultStickmenState: StickmenState = {
  seed: randomSeed(),
  zoom: 1,

  count: 60,
  spread: 1,
  clustering: 0.35,
  minSeparationMm: 7,
  facing: 'random',
  facingAngleDeg: 45,
  facingJitterDeg: 30,

  figureHeightMm: 14,
  scaleVariance: 0.25,
  limbCurve: 0.7,
  penWidthMm: 0.4,

  poseEnergy: 0.6,

  occlude: true,
  groundContact: false,
  wobbleMm: 0.25,

  strokeColor: '#1f1f1c',
};
