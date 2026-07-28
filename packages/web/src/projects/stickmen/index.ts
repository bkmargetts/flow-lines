import type { PureModule } from '../../modules/types';
import { StickmenControls } from './Controls';
import { renderStickmen } from './render';
import { defaultStickmenState, type StickmenState } from './types';

export const stickmenModule: PureModule<StickmenState> = {
  kind: 'pure',
  id: 'stickmen',
  label: 'Stick Men',
  category: 'scenes',
  description: 'Isometric stick figures with a pose library',
  defaultState: () => ({ ...defaultStickmenState }),
  Controls: StickmenControls,
  render: renderStickmen,
};
