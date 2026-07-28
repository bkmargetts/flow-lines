import type { PureModule } from '../../modules/types';
import { MachineControls } from './Controls';
import { renderMachine } from './render';
import { defaultMachineState, type MachineState } from './types';

/** Page-sized, hugely complex generative machines — a pure module over the
 *  core `generateMachine`. */
export const machineModule: PureModule<MachineState> = {
  kind: 'pure',
  id: 'machine',
  label: 'Machine',
  category: 'scenes',
  description: 'Meshing gear trains, belts, ropes, weights',
  defaultState: () => ({ ...defaultMachineState }),
  Controls: MachineControls,
  render: renderMachine,
};
