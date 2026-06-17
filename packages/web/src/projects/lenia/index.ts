import type { ProjectModule } from '../types';
import { LeniaProvider } from './context';
import { LeniaControls } from './Controls';
import { LeniaCanvas } from './Canvas';

export const leniaProject: ProjectModule = {
  id: 'lenia',
  label: 'Lenia',
  Provider: LeniaProvider,
  features: [{ id: 'life', label: 'Lifeforms', Controls: LeniaControls, Canvas: LeniaCanvas }],
};
