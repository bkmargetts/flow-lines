import type { PureModule } from '../../modules/types';
import { WarpGridControls } from './Controls';
import { renderWarpGrid } from './render';
import { defaultWarpGridState, type WarpGridState } from './types';

/** Op-art gratings deformed by hidden relief — a pure module over the core
 *  `generateWarpGrid`. */
export const warpGridModule: PureModule<WarpGridState> = {
  kind: 'pure',
  id: 'warp-grid',
  label: 'Warp Grid',
  category: 'flow',
  description: 'Op-art gratings deformed by hidden relief',
  defaultState: () => ({ ...defaultWarpGridState }),
  Controls: WarpGridControls,
  render: renderWarpGrid,
};
