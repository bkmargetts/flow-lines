import type { PureModule } from '../../modules/types';
import { BotanicalGeneratorControls } from './Controls';
import { renderBotanicalGenerator } from './render';
import { defaultBotanicalState, type BotanicalState } from './types';

export const botanicalGeneratorModule: PureModule<BotanicalState> = {
  kind: 'pure',
  id: 'botanical-generator',
  label: 'Botanical Generator',
  category: 'scenes',
  description: 'Grown, lit botanical illustrations',
  defaultState: () => ({ ...defaultBotanicalState, maskPath: [] }),
  Controls: BotanicalGeneratorControls,
  render: renderBotanicalGenerator,
};
