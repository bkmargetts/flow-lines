/**
 * Noise Texture settings = the shared grating params plus project-only extras
 * (pen width, and the drawn-line band path + draw mode that need the canvas).
 * The grating generative logic is shared with the background-texture module.
 */
import type { SketchStyle } from '@flow-lines/core';
import { defaultGratingParams, type GratingParams, type GratingMaskMode } from '../../textures/grating/shared';

export type MaskMode = GratingMaskMode;

export interface NoiseTextureState extends GratingParams {
  /** Pen width in millimetres (plotted line weight). */
  penWidthMm: number;
  /** Opt-in hand-drawn sketch overdraw intensity, 0..1 (0 = off). */
  sketch: number;
  /** Character of the sketch overdraw. */
  sketchStyle: SketchStyle;
  // `drawMode` + `maskPath` (the canvas band) are inherited from GratingParams.
}

export const defaultNoiseTextureState: NoiseTextureState = {
  ...defaultGratingParams,
  seed: Math.floor(Math.random() * 1000000),
  penWidthMm: 0.3,
  drawMode: false,
  sketch: 0,
  sketchStyle: 'loose',
};
