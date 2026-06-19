import type { PureModule } from '../../modules/types';
import { NoiseTextureControls } from './Controls';
import { renderNoiseTexture } from './render';
import { defaultNoiseTextureState, type NoiseTextureState } from './types';

export const noiseTextureModule: PureModule<NoiseTextureState> = {
  kind: 'pure',
  id: 'noise-texture',
  label: 'Noise Texture',
  defaultState: () => ({ ...defaultNoiseTextureState }),
  Controls: NoiseTextureControls,
  render: renderNoiseTexture,
};
