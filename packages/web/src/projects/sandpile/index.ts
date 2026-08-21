import type { PureModule } from '../../modules/types';
import { SandpileControls } from './Controls';
import { renderSandpile } from './render';
import { defaultSandpileState, type SandpileState } from './types';

export const sandpileModule: PureModule<SandpileState> = {
  kind: 'pure',
  id: 'sandpile',
  label: 'Sandpile',
  category: 'simulations',
  description: 'Tropical curves solved by falling sand',
  defaultState: () => ({ ...defaultSandpileState }),
  Controls: SandpileControls,
  render: renderSandpile,
};
