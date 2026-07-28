import type { PureModule } from '../../modules/types';
import { GestureControls } from './Controls';
import { renderGesture } from './render';
import { defaultGestureState, type GestureState } from './types';

/** Gestural ink abstraction (Kline / Hartung / sumi) — a pure module over the
 *  core `generateGesture`. */
export const gestureModule: PureModule<GestureState> = {
  kind: 'pure',
  id: 'gesture',
  label: 'Gestural Ink',
  category: 'flow',
  description: 'Kline/Hartung/sumi gestural abstractions',
  defaultState: () => ({ ...defaultGestureState }),
  Controls: GestureControls,
  render: renderGesture,
};
