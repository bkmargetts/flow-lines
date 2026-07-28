import type { PureModule } from '../../modules/types';
import { ShardRainControls } from './Controls';
import { renderShardRain } from './render';
import { defaultShardRainState, type ShardRainState } from './types';

/** A small hand-ruled plate dropped onto invisible pins: it catches on the
 *  first one, shatters at the contact, and the shards rain down — breaking
 *  again on every pin they meet — until they pile on the bottom margin. The
 *  `moment` knob freezes any point of the fall. A pure module over the core
 *  `generateShardRain`. */
export const shardRainModule: PureModule<ShardRainState> = {
  kind: 'pure',
  id: 'shard-rain',
  label: 'Shard Rain',
  category: 'simulations',
  description: 'A plate dropped onto invisible pins — shards rain down, shattering again as they fall',
  defaultState: () => ({ ...defaultShardRainState, maskPath: [] }),
  Controls: ShardRainControls,
  render: renderShardRain,
};
