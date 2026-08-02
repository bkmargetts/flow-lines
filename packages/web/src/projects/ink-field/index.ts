import type { PureModule } from '../../modules/types';
import { InkFieldControls } from './Controls';
import { renderInkField } from './render';
import { defaultInkFieldState, type InkFieldState } from './types';

export const inkFieldModule: PureModule<InkFieldState> = {
  kind: 'pure',
  id: 'ink-field',
  label: 'Ink Field',
  category: 'flow',
  description: 'Braided ribbons and colour-plane fields for crossing inks',
  defaultState: () => ({ ...defaultInkFieldState }),
  Controls: InkFieldControls,
  render: renderInkField,
};
