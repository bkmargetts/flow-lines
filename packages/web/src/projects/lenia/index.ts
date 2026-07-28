import type { PureModule } from '../../modules/types';
import { LeniaControls } from './Controls';
import { renderLenia } from './render';
import { defaultLeniaState, type LeniaState } from './types';

export const leniaModule: PureModule<LeniaState> = {
  kind: 'pure',
  id: 'lenia',
  label: 'Lenia',
  category: 'simulations',
  description: 'Continuous cellular automata',
  defaultState: () => ({ ...defaultLeniaState }),
  Controls: LeniaControls,
  render: renderLenia,
};
