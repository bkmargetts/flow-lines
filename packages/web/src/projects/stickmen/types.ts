import type { FacingMode, PoseMode } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/** Preset crowd shapes — compiled to a core `StickmenRegion` in render.ts. */
export type RegionShape = 'full' | 'ellipse' | 'ring' | 'diamond' | 'star' | 'heart' | 'blob';

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

  // Crowd shape (placement region; 'full' = the classic overflowing ground)
  regionShape: RegionShape;
  regionSize: number; // 0.15..1, fraction of the drawable box
  regionX: number; // 0..1 centre
  regionY: number; // 0..1 centre
  regionInner: number; // ring hole / star inner fraction, 0.1..0.9

  // Figure
  figureHeightMm: number; // mean standing height
  scaleVariance: number; // 0..1
  proportionVariance: number; // 0..1 per-figure body variation
  depthGrade: number; // 0..0.5 nearer figures larger
  limbCurve: number; // 0 = angular, 1 = very rounded
  penWidthMm: number;

  // Pose
  poseEnergy: number; // 0..1
  poseMode: PoseMode;

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

  count: 150,
  spread: 1,
  clustering: 0.35,
  minSeparationMm: 6,
  facing: 'random',
  facingAngleDeg: 45,
  facingJitterDeg: 30,

  regionShape: 'full',
  regionSize: 0.8,
  regionX: 0.5,
  regionY: 0.5,
  regionInner: 0.5,

  figureHeightMm: 24,
  scaleVariance: 0.25,
  proportionVariance: 0.5,
  depthGrade: 0.15,
  limbCurve: 0.7,
  penWidthMm: 0.4,

  poseEnergy: 0.6,
  poseMode: 'mixed',

  occlude: true,
  groundContact: false,
  wobbleMm: 0.25,

  strokeColor: '#1f1f1c',
};
