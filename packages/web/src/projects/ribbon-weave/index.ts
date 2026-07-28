import type { PureModule } from '../../modules/types';
import { RibbonWeaveControls } from './Controls';
import { renderRibbonWeave } from './render';
import { defaultRibbonWeaveState, type RibbonWeaveState } from './types';

/** Interlaced ribbons, tangle → Celtic knot lattice — a pure module over the
 *  core `generateRibbonWeave`. */
export const ribbonWeaveModule: PureModule<RibbonWeaveState> = {
  kind: 'pure',
  id: 'ribbon-weave',
  label: 'Ribbon Weave',
  category: 'textures',
  description: 'Celtic knotwork / woven lattices',
  defaultState: () => ({ ...defaultRibbonWeaveState }),
  Controls: RibbonWeaveControls,
  render: renderRibbonWeave,
};
