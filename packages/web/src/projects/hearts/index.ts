import type { PureModule } from '../../modules/types';
import { HeartsControls } from './Controls';
import { renderHearts } from './render';
import { defaultHeartsState, type HeartsState } from './types';

export const heartsModule: PureModule<HeartsState> = {
  kind: 'pure',
  id: 'hearts',
  label: 'Hearts',
  category: 'scenes',
  description: 'Love hearts in four pen-and-ink styles',
  defaultState: () => ({
    ...defaultHeartsState,
    mix: { ...defaultHeartsState.mix },
  }),
  Controls: HeartsControls,
  render: renderHearts,
};
