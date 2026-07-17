import type { PureModule } from '../../modules/types';
import { FractureControls } from './Controls';
import { renderFracture } from './render';
import { defaultFractureState, type FractureState } from './types';

export const fractureModule: PureModule<FractureState> = {
  kind: 'pure',
  id: 'fracture',
  label: 'Fracture',
  defaultState: () => ({ ...defaultFractureState }),
  Controls: FractureControls,
  render: renderFracture,
};
