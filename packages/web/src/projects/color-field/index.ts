import type { PureModule } from '../../modules/types';
import { ColorFieldControls } from './Controls';
import { renderColorField } from './render';
import { defaultColorFieldState, type ColorFieldState } from './types';

export const colorFieldModule: PureModule<ColorFieldState> = {
  kind: 'pure',
  id: 'color-field',
  label: 'Colour Field',
  category: 'flow',
  description: 'Atmospheric multi-ink gradients',
  defaultState: () => ({ ...defaultColorFieldState }),
  Controls: ColorFieldControls,
  render: renderColorField,
};
