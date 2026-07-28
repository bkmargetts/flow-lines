import type { PureModule } from '../../modules/types';
import { PhysarumControls } from './Controls';
import { renderPhysarum } from './render';
import { defaultPhysarumState, type PhysarumState } from './types';

export const physarumModule: PureModule<PhysarumState> = {
  kind: 'pure',
  id: 'physarum',
  label: 'Physarum',
  category: 'simulations',
  description: 'Slime-mould agent transport networks',
  defaultState: () => ({ ...defaultPhysarumState }),
  Controls: PhysarumControls,
  render: renderPhysarum,
};
