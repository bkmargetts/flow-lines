import type { PureModule } from '../../modules/types';
import { FlowFieldControls } from './Controls';
import { renderFlowField } from './render';
import { defaultFlowState, type FlowState } from './types';

export const flowFieldModule: PureModule<FlowState> = {
  kind: 'pure',
  id: 'flow-field',
  label: 'Flow Field',
  category: 'flow',
  description: 'Noise-driven flow lines',
  defaultState: () => ({ ...defaultFlowState }),
  Controls: FlowFieldControls,
  render: renderFlowField,
};
