import type { PureModule } from '../../modules/types';
import { CoralControls } from './Controls';
import { renderCoral } from './render';
import { defaultCoralState, type CoralState } from './types';

export const coralModule: PureModule<CoralState> = {
  kind: 'pure',
  id: 'coral',
  label: 'Coral',
  category: 'simulations',
  description: 'Differential-growth organisms',
  defaultState: () => ({ ...defaultCoralState }),
  Controls: CoralControls,
  render: renderCoral,
};
