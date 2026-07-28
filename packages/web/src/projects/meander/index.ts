import type { PureModule } from '../../modules/types';
import { MeanderControls } from './Controls';
import { renderMeander } from './render';
import { defaultMeanderState, type MeanderState } from './types';

export const meanderModule: PureModule<MeanderState> = {
  kind: 'pure',
  id: 'meander',
  label: 'Meander',
  category: 'flow',
  description: 'Fisk-style river-migration cartography',
  defaultState: () => ({ ...defaultMeanderState }),
  Controls: MeanderControls,
  render: renderMeander,
};
