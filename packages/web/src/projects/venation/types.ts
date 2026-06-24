import type { VenationRegion } from '@flow-lines/core';

/**
 * Leaf-venation settings. The page frame (paper, orientation, resolution,
 * margin) lives in the shared FrameContext, not here. Spatial knobs are in
 * millimetres and converted to page-px in `render.ts`.
 */
export interface VenationState {
  seed: number;
  region: VenationRegion;
  attractorCount: number;
  rootCount: number;

  /** Segment grown per iteration, mm. */
  growthStepMm: number;
  /** Attractor influence range, mm. */
  attractionDistMm: number;
  /** Attractor kill radius, mm. */
  killDistMm: number;
  /** Drop veins shorter than this, mm. */
  minBranchLengthMm: number;
  maxIterations: number;

  /** Pull growth toward a noise field (0 = pure space colonization). */
  directionBias: number;
  biasNoiseScale: number;

  /** Pen layers (band-NN) vein depth maps onto — 1 is a single pen. */
  layerCount: number;
  palette: string;
  customRamp: string[];
  /** Plot the trunk-most veins with the bold pen. */
  boldTrunk: boolean;
  optimize: boolean;

  /** Ink used when `layerCount === 1` (single pen). */
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight). */
  penWidthMm: number;
}

export const defaultVenationState: VenationState = {
  seed: Math.floor(Math.random() * 1000000),
  region: 'leaf',
  attractorCount: 800,
  rootCount: 1,
  growthStepMm: 1.2,
  attractionDistMm: 12,
  killDistMm: 3,
  minBranchLengthMm: 1,
  maxIterations: 1500,
  directionBias: 0,
  biasNoiseScale: 0.004,
  layerCount: 1,
  palette: 'forest',
  customRamp: ['#1b4332', '#40916c', '#b7e4c7'],
  boldTrunk: true,
  optimize: true,
  strokeColor: '#1b4332',
  penWidthMm: 0.3,
};
