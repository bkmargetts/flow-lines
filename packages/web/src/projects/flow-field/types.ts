import { type Point } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Flow-field settings. The page frame (paper, orientation, resolution,
 * margin) lives in the shared FrameContext, not here.
 */
export interface FlowState {
  lineCount: number;
  /**
   * Pack streamlines evenly to fill the page instead of scattering `lineCount`
   * random seeds. Density is set by `lineSpacingMm` rather than a count, so the
   * field can be made significantly — and uniformly — denser.
   */
  denseFill: boolean;
  /** Target gap between neighbouring lines in dense-fill mode, mm */
  lineSpacingMm: number;
  seed: number;
  stepLength: number;
  maxSteps: number;
  minLineLength: number;
  noiseScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  paintMode: boolean;
  paintedPoints: Point[];
  showDots: boolean;
}

export const defaultFlowState: FlowState = {
  lineCount: 100,
  denseFill: false,
  lineSpacingMm: 3,
  seed: randomSeed(),
  stepLength: 2,
  maxSteps: 500,
  minLineLength: 10,
  noiseScale: 0.005,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  strokeColor: '#000000',
  penWidthMm: 0.3,
  paintMode: false,
  paintedPoints: [],
  showDots: true,
};
