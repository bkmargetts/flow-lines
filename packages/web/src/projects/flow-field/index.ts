import type { ProjectModule } from '../types';
import { FlowFieldProvider } from './context';
import { FlowFieldControls } from './Controls';
import { FlowFieldCanvas } from './Canvas';

export const flowFieldProject: ProjectModule = {
  id: 'flow-field',
  label: 'Flow Field',
  Provider: FlowFieldProvider,
  features: [
    { id: 'field', label: 'Field', Controls: FlowFieldControls, Canvas: FlowFieldCanvas },
  ],
};
