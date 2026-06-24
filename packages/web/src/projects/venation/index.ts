import type { PureModule } from '../../modules/types';
import { VenationControls } from './Controls';
import { renderVenation } from './render';
import { defaultVenationState, type VenationState } from './types';

export const venationModule: PureModule<VenationState> = {
  kind: 'pure',
  id: 'venation',
  label: 'Leaf Venation',
  defaultState: () => ({ ...defaultVenationState }),
  Controls: VenationControls,
  render: renderVenation,
};
