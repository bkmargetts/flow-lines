import type { PureModule } from '../../modules/types';
import { RDControls } from './Controls';
import { renderReactionDiffusion } from './render';
import { defaultRDState, type RDState } from './types';

export const reactionDiffusionModule: PureModule<RDState> = {
  kind: 'pure',
  id: 'reaction-diffusion',
  label: 'Reaction–Diffusion',
  category: 'simulations',
  description: 'Gray–Scott patterns as strokes',
  defaultState: () => ({ ...defaultRDState }),
  Controls: RDControls,
  render: renderReactionDiffusion,
};
