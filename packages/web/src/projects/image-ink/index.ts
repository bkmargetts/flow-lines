import type { LiveModule } from '../../modules/types';
import { ImageInkControls } from './Controls';
import { useImageInkInstance } from './live';
import { defaultInkSettings, type ImageInkLayerState } from './types';

export const imageInkModule: LiveModule<ImageInkLayerState> = {
  kind: 'live',
  id: 'image-ink',
  label: 'Image → Ink',
  defaultState: () => ({ settings: { ...defaultInkSettings }, preset: 'classic' }),
  Controls: ImageInkControls,
  useInstance: useImageInkInstance,
};
