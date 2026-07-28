import type { PureModule } from '../../modules/types';
import { SportsBallsControls } from './Controls';
import { renderSportsBalls } from './render';
import { defaultSportsBallsState, type SportsBallsState } from './types';

export const sportsBallsModule: PureModule<SportsBallsState> = {
  kind: 'pure',
  id: 'sports-balls',
  label: 'Sports Balls',
  category: 'scenes',
  description: 'Shaded polyhedral ball studies',
  defaultState: () => ({
    ...defaultSportsBallsState,
    mix: { ...defaultSportsBallsState.mix },
  }),
  Controls: SportsBallsControls,
  render: renderSportsBalls,
};
