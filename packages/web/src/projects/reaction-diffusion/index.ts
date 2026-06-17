import type { ProjectModule } from '../types';
import { RDProvider } from './context';
import { RDControls } from './Controls';
import { RDCanvas } from './Canvas';

export const reactionDiffusionProject: ProjectModule = {
  id: 'reaction-diffusion',
  label: 'Reaction–Diffusion',
  Provider: RDProvider,
  features: [
    { id: 'turing', label: 'Turing Patterns', Controls: RDControls, Canvas: RDCanvas },
  ],
};
