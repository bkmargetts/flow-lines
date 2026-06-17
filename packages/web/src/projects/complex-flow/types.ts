import { type Point, type SingularityLayout, type SeedLayout, type LayerBy } from '@flow-lines/core';

/**
 * Complex Flow settings (Savva-style poles & zeros). The page frame (paper,
 * orientation, resolution, margin) lives in the shared FrameContext, not here.
 */
export interface ComplexFlowState {
  seed: number;

  // Field f(z) = Π(z - zero) / Π(z - pole)
  zeroCount: number;
  poleCount: number;
  zeroLayout: SingularityLayout;
  poleLayout: SingularityLayout;
  singularitySpread: number;
  planeScale: number;
  fieldRotationDeg: number;

  // Tap-to-place singularities (pixel coords on the page)
  placeMode: boolean;
  placeBrush: 'zero' | 'pole';
  manualZeros: Point[];
  manualPoles: Point[];
  showSingularities: boolean;

  // Streamlines
  seedLayout: SeedLayout;
  seedCount: number;
  stepsPerDir: number;
  stepLength: number;
  stepJitter: number;
  wobble: number;
  speedClampMax: number;
  minLineLength: number;

  // Colour / layers
  layerCount: number;
  layerBy: LayerBy;
  palette: string;

  // Style
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  handDrawn: boolean;
}

export const defaultComplexFlowState: ComplexFlowState = {
  seed: Math.floor(Math.random() * 1000000),

  zeroCount: 3,
  poleCount: 2,
  zeroLayout: 'ring',
  poleLayout: 'ring',
  singularitySpread: 0.7,
  planeScale: 1,
  fieldRotationDeg: 0,

  placeMode: false,
  placeBrush: 'zero',
  manualZeros: [],
  manualPoles: [],
  showSingularities: true,

  seedLayout: 'multiRing',
  seedCount: 1200,
  stepsPerDir: 180,
  stepLength: 2,
  stepJitter: 0.5,
  wobble: 0,
  speedClampMax: 1000,
  minLineLength: 12,

  layerCount: 5,
  layerBy: 'seedBand',
  palette: 'mono',

  penWidthMm: 0.25,
  handDrawn: false,
};
