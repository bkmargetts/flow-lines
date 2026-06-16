import type { ProjectModule } from '../types';
import { ComplexFlowProvider } from './context';
import { ComplexFlowControls } from './Controls';
import { ComplexFlowCanvas } from './Canvas';

export const complexFlowProject: ProjectModule = {
  id: 'complex-flow',
  label: 'Complex Flow',
  Provider: ComplexFlowProvider,
  features: [
    { id: 'field', label: 'Field', Controls: ComplexFlowControls, Canvas: ComplexFlowCanvas },
  ],
};
