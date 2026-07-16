import type { PureModule } from '../../modules/types';
import { MachineCodexControls } from './Controls';
import { renderMachineCodex } from './render';
import { defaultMachineCodexState, type MachineCodexState } from './types';

/** Impossible machine codex — da Vinci contraption plates over the core
 *  `generateMachineCodex`. */
export const machineCodexModule: PureModule<MachineCodexState> = {
  kind: 'pure',
  id: 'machine-codex',
  label: 'Machine Codex',
  defaultState: () => ({ ...defaultMachineCodexState }),
  Controls: MachineCodexControls,
  render: renderMachineCodex,
};
