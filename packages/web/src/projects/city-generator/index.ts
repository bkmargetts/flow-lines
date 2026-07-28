import type { PureModule } from '../../modules/types';
import { CityGeneratorControls } from './Controls';
import { renderCity } from './render';
import { defaultCityState, type CityState } from './types';

/** Abstract cities of buildings, flowing → rigid — a pure module over the
 *  core `generateCity`. */
export const cityGeneratorModule: PureModule<CityState> = {
  kind: 'pure',
  id: 'city-generator',
  label: 'City Generator',
  category: 'scenes',
  description: 'Isometric cities with an order/chaos slider',
  defaultState: () => ({ ...defaultCityState }),
  Controls: CityGeneratorControls,
  render: renderCity,
};
