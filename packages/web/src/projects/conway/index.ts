import type { ProjectModule } from '../types';
import { ConwayProvider } from './context';
import { ConwayControls } from './Controls';
import { ConwayCanvas } from './Canvas';

export const conwayProject: ProjectModule = {
  id: 'conway',
  label: 'Conway Long Exposure',
  Provider: ConwayProvider,
  features: [
    { id: 'exposure', label: 'Long Exposure', Controls: ConwayControls, Canvas: ConwayCanvas },
  ],
};
