import { DASH_DEFAULTS, SCRIBBLE_DEFAULTS } from '@flow-lines/core';
import type {
  DashTextureOptions,
  ScribbleTextureOptions,
  TextureRegionOptions,
  TextureShapeOptions,
  TextureStyle,
} from '@flow-lines/core';

/** The original single-pen texture styles (hatch / grid / stipple / contours /
 * shapes / dashes / scribble), preserved as one module. */
export interface ClassicParams {
  style: TextureStyle;
  spacingMm: number;
  angleDeg: number;
  scale: number;
  jitter: number;
  density: number;
  crossHatch: boolean;
  color: string;
  seed: number;
  shapes: TextureShapeOptions;
  dashes: DashTextureOptions;
  scribble: ScribbleTextureOptions;
  region: TextureRegionOptions;
}

export const defaultClassicParams: ClassicParams = {
  style: 'hatch',
  spacingMm: 4,
  angleDeg: 45,
  scale: 1,
  jitter: 0.2,
  density: 0.5,
  crossHatch: false,
  color: '#c9c2b4',
  seed: 1,
  shapes: { kind: 'square', sizeMm: 4, overlap: 0 },
  dashes: { ...DASH_DEFAULTS },
  scribble: { ...SCRIBBLE_DEFAULTS },
  // frame 'rect' + falloff 0 is inert — default output is bit-identical to
  // the pre-region module.
  region: {
    frame: 'rect',
    coverage: 0.8,
    irregularity: 0.35,
    offsetX: 0,
    offsetY: 0,
    patches: 1,
    fade: 0.3,
    falloff: 0,
  },
};
