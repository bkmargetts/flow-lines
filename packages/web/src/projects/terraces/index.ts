import type { PureModule } from '../../modules/types';
import { TerracesControls } from './Controls';
import { renderTerraces } from './render';
import { defaultTerracesState, type TerracesState } from './types';

/** Faulted strata beds — lapidary's strata mode grown into its own module,
 *  a pure module over the core `generateTerraces`. */
export const terracesModule: PureModule<TerracesState> = {
  kind: 'pure',
  id: 'terraces',
  label: 'Terraces',
  category: 'textures',
  description:
    'Faulted strata terraces — beds of ruled lines and contour laminae displaced by fault scarps',
  defaultState: () => ({ ...defaultTerracesState }),
  Controls: TerracesControls,
  render: renderTerraces,
};
