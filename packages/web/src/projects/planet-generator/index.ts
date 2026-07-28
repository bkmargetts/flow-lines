import type { PureModule } from '../../modules/types';
import { PlanetGeneratorControls } from './Controls';
import { renderPlanet } from './render';
import { defaultPlanetState, type PlanetState } from './types';

export const planetGeneratorModule: PureModule<PlanetState> = {
  kind: 'pure',
  id: 'planet-generator',
  label: 'Planet Generator',
  category: 'scenes',
  description: 'Shaded procedural planets, rings, comets',
  defaultState: () => ({ ...defaultPlanetState }),
  Controls: PlanetGeneratorControls,
  render: renderPlanet,
};
