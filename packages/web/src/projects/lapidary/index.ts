import type { PureModule } from '../../modules/types';
import { LapidaryControls } from './Controls';
import { renderLapidary } from './render';
import { defaultLapidaryState, type LapidaryState } from './types';

/** Layered pattern artworks — textured regions split by clean paper seams,
 *  a pure module over the core `generateLapidary`. */
export const lapidaryModule: PureModule<LapidaryState> = {
  kind: 'pure',
  id: 'lapidary',
  label: 'Lapidary',
  category: 'textures',
  description: 'Agate bands, breccia fragments or strata — textured regions split by paper seams',
  defaultState: () => ({ ...defaultLapidaryState }),
  Controls: LapidaryControls,
  render: renderLapidary,
};
