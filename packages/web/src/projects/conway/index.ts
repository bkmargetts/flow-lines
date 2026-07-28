import type { PureModule } from '../../modules/types';
import { ConwayControls } from './Controls';
import { renderConway } from './render';
import { defaultConwayState, type ConwayState } from './types';

export const conwayModule: PureModule<ConwayState> = {
  kind: 'pure',
  id: 'conway',
  label: 'Conway Long Exposure',
  category: 'simulations',
  description: 'Game of Life history as comet trails',
  defaultState: () => ({ ...defaultConwayState }),
  Controls: ConwayControls,
  render: renderConway,
};
