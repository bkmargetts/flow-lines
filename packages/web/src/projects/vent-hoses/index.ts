import type { PureModule } from '../../modules/types';
import { VentHosesControls } from './Controls';
import { renderVentHoses } from './render';
import { defaultVentHosesState, type VentHosesState } from './types';

export const ventHosesModule: PureModule<VentHosesState> = {
  kind: 'pure',
  id: 'vent-hoses',
  label: 'Vent Hoses',
  category: 'scenes',
  description: 'Corrugated ducts worming over and under',
  defaultState: () => ({ ...defaultVentHosesState }),
  Controls: VentHosesControls,
  render: renderVentHoses,
};
