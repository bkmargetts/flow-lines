import type { PureModule } from '../../modules/types';
import { LandscapeGeneratorControls } from './Controls';
import { renderLandscape } from './render';
import { defaultLandscapeState, type LandscapeState } from './types';

export const landscapeGeneratorModule: PureModule<LandscapeState> = {
  kind: 'pure',
  id: 'landscape-generator',
  label: 'Landscape Generator',
  category: 'scenes',
  description: 'Procedural pen-and-ink landscapes',
  defaultState: () => ({ ...defaultLandscapeState }),
  Controls: LandscapeGeneratorControls,
  render: renderLandscape,
};
