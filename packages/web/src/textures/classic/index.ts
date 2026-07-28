import type { PureModule } from '../../modules/types';
import { ClassicControls } from './Controls';
import { renderClassicTexture } from './render';
import { defaultClassicParams, type ClassicParams } from './types';

/** The original single-pen texture styles (hatch / grid / stipple / contours /
 * shapes), preserved as one module. */
export const classicTexture: PureModule<ClassicParams> = {
  kind: 'pure',
  id: 'classic',
  label: 'Pattern (hatch, grid, dots…)',
  category: 'textures',
  description: 'Background hatch / grid / dot textures',
  defaultState: () => ({ ...defaultClassicParams }),
  Controls: ClassicControls,
  render: renderClassicTexture,
  // The texture skips strokes inside the avoid set rather than overdrawing it,
  // so the compositor must not also trim its output.
  consumesAvoid: true,
};
