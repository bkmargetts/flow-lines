import type { PureModule } from '../../modules/types';
import { ComplexFlowControls } from './Controls';
import { renderComplexFlow } from './render';
import { defaultComplexFlowState, type ComplexFlowState } from './types';

export const complexFlowModule: PureModule<ComplexFlowState> = {
  kind: 'pure',
  id: 'complex-flow',
  label: 'Complex Flow',
  category: 'flow',
  description: 'Complex rational-function flow fields',
  defaultState: () => ({ ...defaultComplexFlowState }),
  Controls: ComplexFlowControls,
  render: renderComplexFlow,
};
