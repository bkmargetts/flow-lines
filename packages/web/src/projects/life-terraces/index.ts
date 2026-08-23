import type { PureModule } from '../../modules/types';
import { LifeTerracesControls } from './Controls';
import { renderLifeTerraces } from './render';
import { defaultLifeTerracesState, type LifeTerracesState } from './types';

/** The Conway long exposure crossed with the terraces mark language — a pure
 *  module over the core `generateLifeTerraces`. */
export const lifeTerracesModule: PureModule<LifeTerracesState> = {
  kind: 'pure',
  id: 'life-terraces',
  label: 'Life Terraces',
  category: 'simulations',
  description:
    'Game of Life long exposure terraced into contour-walking laminae — banded levels split by paper seams',
  defaultState: () => ({ ...defaultLifeTerracesState }),
  Controls: LifeTerracesControls,
  render: renderLifeTerraces,
};
