import type { TextureShapeOptions, TextureStyle } from '@flow-lines/core';
import type { TextureModule } from '../types';
import { ClassicControls } from './Controls';

/** The original single-pen texture styles (hatch / grid / stipple / contours /
 * shapes), preserved as one module. */
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
};

export const classicTexture: TextureModule<ClassicParams> = {
  id: 'classic',
  label: 'Pattern (hatch, grid, dots…)',
  defaultParams: defaultClassicParams,
  Controls: ClassicControls,
  toTexture: (p, page, marginPx) => ({
    options: {
      width: page.widthPx,
      height: page.heightPx,
      margin: marginPx,
      pxPerMm: page.pxPerMm,
      style: p.style,
      spacingMm: p.spacingMm,
      angleDeg: p.angleDeg,
      scale: p.scale,
      jitter: p.jitter,
      density: p.density,
      crossHatch: p.crossHatch,
      seed: p.seed,
      shapes: p.shapes,
    },
    layerColors: { texture: p.color },
  }),
};
