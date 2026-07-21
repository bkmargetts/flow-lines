import type { PureModule } from '../../modules/types';
import { MarblingControls } from './Controls';
import { renderMarbling } from './render';
import { defaultMarblingState, type MarblingState } from './types';

/** Mathematical paper marbling (suminagashi / ebru) — a pure module over
 *  the core `generateMarbling`. */
export const marblingModule: PureModule<MarblingState> = {
  kind: 'pure',
  id: 'marbling',
  label: 'Marbling',
  defaultState: () => ({ ...defaultMarblingState }),
  Controls: MarblingControls,
  render: renderMarbling,
};
