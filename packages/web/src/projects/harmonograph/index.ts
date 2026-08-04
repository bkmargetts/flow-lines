import type { PureModule } from '../../modules/types';
import { HarmonographControls } from './Controls';
import { renderHarmonograph } from './render';
import { defaultHarmonographState, type HarmonographState } from './types';

/** Harmonograph / guilloché curve machines — a pure module over the core
 *  `generateHarmonograph`. */
export const harmonographModule: PureModule<HarmonographState> = {
  kind: 'pure',
  id: 'harmonograph',
  label: 'Harmonograph',
  category: 'flow',
  description: 'Decaying pendulum curves, spirograph wheels, engine-turned guilloché rosettes',
  defaultState: () => ({ ...defaultHarmonographState }),
  Controls: HarmonographControls,
  render: renderHarmonograph,
};
