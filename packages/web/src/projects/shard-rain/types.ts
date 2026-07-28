import type { Point } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import { INK_PALETTES } from '../impact-grid/presets';

/**
 * UI state for Shard Rain (mm / 0..1 units). `render.ts` converts it to the
 * core's `ShardRainOptions` in px. `drawMode` + `maskPath` follow the canvas
 * DrawableState contract — here the drawn points are the PINS: the invisible
 * points hanging in the air below the plate, decimated to sites.
 */
export interface ShardRainState {
  /** Last-picked look preset — a label for the picker; the knobs below are
   *  the actual state. */
  look: 'crack' | 'cascade' | 'gauntlet' | 'rubble' | 'saucer';
  seed: number;

  // The plate
  paneShape: 'slab' | 'disc';
  paneScale: number; // 0.2..0.7 of the inner page width — small on purpose
  layout: 'mosaic' | 'grid' | 'frame' | 'bars';
  frameDepth: number; // cells deep for the frame band
  cellSizeMm: number; // mean cell pitch
  sizeVariation: number; // 0..1 per-cell size jitter
  positionJitter: number; // 0..1 centre jitter
  rotationJitter: number; // 0..1 rotation jitter
  gap: number; // 0..0.6 gap fraction of pitch
  granularity: number; // 0..1 mosaic scale mixture (slabs vs patch clusters)

  // The drop
  impacts: number; // 0..12 invisible pins in the fall (0 = pristine float)
  impactRadiusMm: number; // strike radius — the bite at each contact
  radiusVariation: number; // 0..1 per-pin radius spread
  energy: number; // 0..1 violence of the landing
  moment: number; // 0..1 sim time: just-cracked → mid-fall → settled pile
  pinSpread: number; // 0..1 pin field width beyond the plate's footprint
  tilt: number; // 0..1 how far the plate tips onto its heavy side
  shatter: number; // 0..1 damage-zone width
  scatter: number; // 0..1 lateral fan of the falling shards
  debris: number; // 0..1 pulverised dropout
  crush: number; // 0..1 shard fineness at each contact
  sag: number; // 0..1 downward slip of the cracked-but-held facets

  // Marks
  fill: number; // 0..1 fraction of cells filled (region-committed)
  toneRange: number; // 0..1 tonal spread: one pitch → near-solid…near-paper tiers
  fillStyle: 'texture' | 'hatch' | 'concentric' | 'none';
  inkBalance: number; // 0..1 swath skew: 0.5 = even split across the pens
  inkMode: 'regions' | 'damage'; // swaths, or inks ordered by accumulated destruction
  markImpacts: boolean; // ink a small target at each pin
  occlude: boolean; // displaced material hides lines beneath (off = overprint)

  // Pen / finishing
  wobbleMm: number;
  penWidthMm: number;

  // Inks — one pen per entry, arbitrarily many; ink count = array length.
  palette: string; // named INK_PALETTES id, or 'custom' after hand edits
  inkColors: string[];
  pathColor: string; // the pin targets' own fine pen

  // Canvas drawing (DrawableState duck-type — drag-to-draw for free)
  drawMode: boolean;
  maskPath: Point[]; // pin field, page px — decimated to sites
}

// Cascade-look defaults: a small textured plate caught on the first pin,
// the rain frozen mid-fall, inks following the damage — calm plate in the
// first pen, the falling glass in the hot one.
export const defaultShardRainState: ShardRainState = {
  look: 'cascade',
  seed: randomSeed(),

  paneShape: 'slab',
  paneScale: 0.42,
  layout: 'mosaic',
  frameDepth: 3,
  cellSizeMm: 6,
  sizeVariation: 0.15,
  positionJitter: 0.03,
  rotationJitter: 0.02,
  gap: 0.06,
  granularity: 0.6,

  impacts: 5,
  impactRadiusMm: 35,
  radiusVariation: 0.5,
  energy: 0.6,
  moment: 0.55,
  pinSpread: 0.5,
  tilt: 0.5,
  shatter: 0.8,
  scatter: 0.35,
  debris: 0.15,
  crush: 0.6,
  sag: 0.4,

  fill: 1,
  toneRange: 0.65,
  fillStyle: 'texture',
  inkBalance: 0.5,
  inkMode: 'damage',
  markImpacts: false,
  occlude: true,

  wobbleMm: 0,
  penWidthMm: 0.35,

  palette: 'blueprint',
  inkColors: ['#26282e', '#1766d1'],
  pathColor: '#a3b34a',

  drawMode: false,
  maskPath: [],
};

/**
 * "Surprise me" genome: a fresh plate and drop within the sliders' ranges.
 * Never touches the seed, pens/inks, or the user's drawn pin field.
 */
export function randomShardRainGenome(rng: () => number): Partial<ShardRainState> {
  const fillStyles: ShardRainState['fillStyle'][] = ['texture', 'texture', 'hatch', 'concentric', 'none'];
  const layouts: ShardRainState['layout'][] = ['mosaic', 'mosaic', 'grid', 'bars', 'frame'];
  return {
    paneShape: rng() < 0.75 ? 'slab' : 'disc',
    paneScale: Number((0.28 + rng() * 0.32).toFixed(2)),
    layout: layouts[Math.floor(rng() * layouts.length)],
    frameDepth: 1 + Math.floor(rng() * 5),
    cellSizeMm: Number((3.5 + rng() * 7).toFixed(1)),
    sizeVariation: Number((rng() * 0.7).toFixed(2)),
    positionJitter: Number((rng() * 0.6).toFixed(2)),
    rotationJitter: Number((rng() * 0.7).toFixed(2)),
    gap: Number((rng() * 0.4).toFixed(2)),
    granularity: Number(rng().toFixed(2)),
    impacts: 2 + Math.floor(rng() * 9),
    impactRadiusMm: Math.round(18 + rng() * 40),
    radiusVariation: Number(rng().toFixed(2)),
    energy: Number((0.35 + rng() * 0.65).toFixed(2)),
    moment: Number((0.15 + rng() * 0.85).toFixed(2)),
    pinSpread: Number(rng().toFixed(2)),
    tilt: Number(rng().toFixed(2)),
    shatter: Number((0.4 + rng() * 0.6).toFixed(2)),
    scatter: Number((rng() * 0.7).toFixed(2)),
    debris: Number((rng() * 0.5).toFixed(2)),
    crush: Number((0.2 + rng() * 0.8).toFixed(2)),
    sag: Number((rng() * rng()).toFixed(2)),
    fill: Number((0.3 + rng() * 0.7).toFixed(2)),
    toneRange: Number(rng().toFixed(2)),
    fillStyle: fillStyles[Math.floor(rng() * fillStyles.length)],
    inkBalance: Number((0.3 + rng() * 0.4).toFixed(2)),
    inkMode: rng() < 0.6 ? 'damage' : 'regions',
    markImpacts: rng() < 0.2,
    // Palette roll (shard-rain is in PALETTE_ROLLERS): a named pen set,
    // never custom colours.
    ...(() => {
      const ids = Object.keys(INK_PALETTES);
      const id = ids[Math.floor(rng() * ids.length)];
      const pal = INK_PALETTES[id];
      return { palette: id, inkColors: [...pal.inks], pathColor: pal.path };
    })(),
  };
}
