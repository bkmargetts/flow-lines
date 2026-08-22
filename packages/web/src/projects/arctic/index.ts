import type { PureModule } from '../../modules/types';
import { ArcticControls } from './Controls';
import { renderArctic } from './render';
import { defaultArcticState, type ArcticState } from './types';

export const arcticModule: PureModule<ArcticState> = {
  kind: 'pure',
  id: 'arctic',
  label: 'Arctic',
  category: 'simulations',
  description: 'Random domino tilings — the arctic circle in ink',
  defaultState: () => ({ ...defaultArcticState }),
  Controls: ArcticControls,
  render: renderArctic,
};
