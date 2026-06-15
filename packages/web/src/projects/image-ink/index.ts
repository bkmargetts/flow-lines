import type { ProjectModule } from '../types';
import { ImageInkProvider } from './context';
import { ImageInkControls } from './Controls';
import { ImageInkCanvas } from './Canvas';

export const imageInkProject: ProjectModule = {
  id: 'image-ink',
  label: 'Image → Ink',
  Provider: ImageInkProvider,
  features: [
    { id: 'photo', label: 'Photo', Controls: ImageInkControls, Canvas: ImageInkCanvas },
  ],
};
