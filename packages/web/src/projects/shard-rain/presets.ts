import type { ShardRainState } from './types';

// Shard Rain shares the impact-grid pen sets — one source, no palette drift.
export { INK_PALETTES } from '../impact-grid/presets';

export type ShardRainLook = 'crack' | 'cascade' | 'gauntlet' | 'rubble' | 'saucer';

/** Named looks scrubbing the drop's story. Each is a state patch — seed,
 *  pens/inks, and the drawn pin field are never touched. */
export const SHARD_RAIN_LOOKS: Record<
  ShardRainLook,
  { label: string; state: Partial<ShardRainState> }
> = {
  crack: {
    label: 'First crack',
    state: {
      paneShape: 'slab',
      impacts: 3,
      moment: 0.12,
      pinSpread: 0.3,
      energy: 0.55,
      tilt: 0.6,
      scatter: 0.25,
      debris: 0.1,
      crush: 0.5,
      sag: 0.5,
      fill: 1,
      fillStyle: 'texture',
      inkMode: 'damage',
      markImpacts: false,
      wobbleMm: 0,
    },
  },
  cascade: {
    label: 'Cascade',
    state: {
      paneShape: 'slab',
      impacts: 5,
      moment: 0.55,
      pinSpread: 0.5,
      energy: 0.6,
      tilt: 0.5,
      scatter: 0.35,
      debris: 0.15,
      crush: 0.6,
      sag: 0.4,
      fill: 1,
      fillStyle: 'texture',
      inkMode: 'damage',
      markImpacts: false,
      wobbleMm: 0,
    },
  },
  gauntlet: {
    label: 'Gauntlet',
    state: {
      paneShape: 'slab',
      impacts: 11,
      moment: 0.6,
      pinSpread: 0.9,
      energy: 0.75,
      tilt: 0.4,
      scatter: 0.55,
      debris: 0.25,
      crush: 0.9,
      sag: 0.4,
      fill: 1,
      fillStyle: 'texture',
      inkMode: 'damage',
      markImpacts: true,
      wobbleMm: 0,
    },
  },
  rubble: {
    label: 'Rubble',
    state: {
      paneShape: 'slab',
      impacts: 6,
      moment: 1,
      pinSpread: 0.6,
      energy: 0.7,
      tilt: 0.6,
      scatter: 0.4,
      debris: 0.15,
      crush: 0.65,
      sag: 0.5,
      fill: 1,
      fillStyle: 'texture',
      inkMode: 'damage',
      markImpacts: false,
      wobbleMm: 0,
    },
  },
  saucer: {
    label: 'Saucer',
    state: {
      paneShape: 'disc',
      impacts: 7,
      moment: 0.6,
      pinSpread: 0.6,
      energy: 0.65,
      tilt: 0.3,
      scatter: 0.4,
      debris: 0.15,
      crush: 0.6,
      sag: 0.4,
      fill: 1,
      fillStyle: 'texture',
      inkMode: 'damage',
      markImpacts: false,
      wobbleMm: 0,
    },
  },
};
