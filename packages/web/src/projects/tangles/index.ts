import type { PureModule } from '../../modules/types';
import { TanglesControls } from './Controls';
import { renderTangles } from './render';
import { defaultTanglesState, type TanglesState } from './types';

export const tanglesModule: PureModule<TanglesState> = {
  kind: 'pure',
  id: 'tangles',
  label: 'Tangles',
  category: 'scenes',
  description: 'Corrugated ducts or shoelaces worming over and under',
  defaultState: () => ({ ...defaultTanglesState }),
  Controls: TanglesControls,
  render: renderTangles,
};
