import type { PureModule } from '../../modules/types';
import { VineGeneratorControls } from './Controls';
import { renderVineGenerator } from './render';
import { defaultVineState, type VineState } from './types';

export const vineGeneratorModule: PureModule<VineState> = {
  kind: 'pure',
  id: 'vine-generator',
  label: 'Vine Generator',
  defaultState: () => ({ ...defaultVineState, maskPath: [] }),
  Controls: VineGeneratorControls,
  render: renderVineGenerator,
};
