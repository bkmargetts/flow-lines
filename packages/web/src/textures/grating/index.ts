import type { PureModule } from '../../modules/types';
import { defaultGratingParams, type GratingParams } from './shared';
import { GratingTextureControls } from './Controls';
import { renderGratingTexture } from './render';

/** The interleaved multi-ink line grating (the Noise Texture project) as a
 * background texture. Emits one `texture-NN` pen layer per ink. */
export const gratingTexture: PureModule<GratingParams> = {
  kind: 'pure',
  id: 'grating',
  label: 'Grating (multi-ink)',
  defaultState: () => ({ ...defaultGratingParams, seed: 7 }),
  Controls: GratingTextureControls,
  render: renderGratingTexture,
  // The texture skips strokes inside the avoid set rather than overdrawing it,
  // so the compositor must not also trim its output.
  consumesAvoid: true,
};
