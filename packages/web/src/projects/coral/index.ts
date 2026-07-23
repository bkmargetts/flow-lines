import type { PureModule } from '../../modules/types';
import { CoralControls } from './Controls';
import { renderCoral } from './render';
import { defaultCoralState, type CoralState } from './types';

export const coralModule: PureModule<CoralState> = {
  kind: 'pure',
  id: 'coral',
  label: 'Coral',
  defaultState: () => ({ ...defaultCoralState }),
  Controls: CoralControls,
  render: renderCoral,
};
