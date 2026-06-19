import type { PureModule } from '../../modules/types';
import { LeniaControls } from './Controls';
import { renderLenia } from './render';
import { defaultLeniaState, type LeniaState } from './types';

export const leniaModule: PureModule<LeniaState> = {
  kind: 'pure',
  id: 'lenia',
  label: 'Lenia',
  defaultState: () => ({ ...defaultLeniaState }),
  Controls: LeniaControls,
  render: renderLenia,
};
