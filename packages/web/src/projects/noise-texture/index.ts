import type { ProjectModule } from '../types';
import { NoiseTextureProvider } from './context';
import { NoiseTextureControls } from './Controls';
import { NoiseTextureCanvas } from './Canvas';

export const noiseTextureProject: ProjectModule = {
  id: 'noise-texture',
  label: 'Noise Texture',
  Provider: NoiseTextureProvider,
  features: [
    {
      id: 'swatches',
      label: 'Swatches',
      Controls: NoiseTextureControls,
      Canvas: NoiseTextureCanvas,
    },
  ],
};
