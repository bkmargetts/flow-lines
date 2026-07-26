import type { PureModule } from '../../modules/types';
import { ImpactGridControls } from './Controls';
import { renderImpactGrid } from './render';
import { defaultImpactGridState, type ImpactGridState } from './types';

/** A hand-ruled grid of squares struck along a drawn impact path — displaced,
 *  torqued, shattered into scattering debris. A pure module over the core
 *  `generateImpactGrid`. */
export const impactGridModule: PureModule<ImpactGridState> = {
  kind: 'pure',
  id: 'impact-grid',
  label: 'Impact Grid',
  defaultState: () => ({ ...defaultImpactGridState, maskPath: [] }),
  Controls: ImpactGridControls,
  render: renderImpactGrid,
};
