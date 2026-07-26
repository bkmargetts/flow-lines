import type { Point } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for Impact Grid (mm / 0..1 units). `render.ts` converts it to the
 * core's `ImpactGridOptions` in px. `drawMode` + `maskPath` follow the
 * canvas DrawableState contract — the drawn path (page px) is the trajectory
 * the mosaic is struck along.
 */
export interface ImpactGridState {
  /** Last-picked look preset — a label for the picker; the knobs below are
   *  the actual state. */
  look: 'breakpoint' | 'mosaic' | 'disc' | 'rough' | 'rip';
  seed: number;
  region: 'slab' | 'band' | 'disc' | 'full'; // the shaped pane the mosaic occupies
  layout: 'grid' | 'frame' | 'bars';
  frameDepth: number; // cells deep for the frame band

  // Mosaic
  cellSizeMm: number; // mean cell pitch
  sizeVariation: number; // 0..1 per-cell size jitter
  positionJitter: number; // 0..1 centre jitter
  rotationJitter: number; // 0..1 rotation jitter
  gap: number; // 0..0.6 gap fraction of pitch

  // Impact
  paneStress: number; // 0..1 pane-wide crack/damage reach from the strike
  energy: number; // 0..1 impact violence, scales the gesture's speed
  impactRadiusMm: number; // channel falloff radius
  impactStrength: number; // 0..1 radial push (0 = mosaic stands still)
  shatter: number; // 0..1 shatter zone width
  scatter: number; // 0..1 sideways cascade spread
  debris: number; // 0..1 pulverised-core dropout
  crush: number; // 0..1 shard fineness near the line
  sweep: number; // 0..1 drift along the stroke / channel clearing

  // Marks
  fill: number; // 0..1 fraction of cells filled (region-committed)
  fillStyle: 'texture' | 'hatch' | 'concentric' | 'none';
  inkSplit: number; // 0..1 fraction of cells in the accent ink
  inkPath: boolean; // draw the trajectory + terminal dot

  // Pen / finishing
  wobbleMm: number;
  penWidthMm: number;

  // Inks
  strokeColor: string;
  accentColor: string;
  pathColor: string; // the trajectory's own fine pen

  // Canvas drawing (DrawableState duck-type — drag-to-draw for free)
  drawMode: boolean;
  maskPath: Point[]; // trajectory, page px
}

// Breakpoint-look defaults: a dense, near-ordered, fully textured mosaic;
// the drawn line sweeps its channel clean, crisp pen, two inks.
export const defaultImpactGridState: ImpactGridState = {
  look: 'breakpoint',
  seed: randomSeed(),
  region: 'slab',
  layout: 'grid',
  frameDepth: 3,

  cellSizeMm: 7,
  sizeVariation: 0.15,
  positionJitter: 0.03,
  rotationJitter: 0.02,
  gap: 0.06,

  paneStress: 0.7,
  energy: 0.7,
  impactRadiusMm: 50,
  impactStrength: 0,
  shatter: 0.85,
  scatter: 0.35,
  debris: 0.25,
  crush: 0.7,
  sweep: 0.7,

  fill: 1,
  fillStyle: 'texture',
  inkSplit: 0.35,
  inkPath: true,

  wobbleMm: 0,
  penWidthMm: 0.35,

  strokeColor: '#26282e',
  accentColor: '#1766d1',
  pathColor: '#a3b34a',

  drawMode: false,
  maskPath: [],
};

/**
 * "Surprise me" genome: a fresh mosaic and impact response within the
 * sliders' ranges. Never touches the seed, pens/inks, or the user's drawn
 * trajectory.
 */
export function randomImpactGridGenome(rng: () => number): Partial<ImpactGridState> {
  const fillStyles: ImpactGridState['fillStyle'][] = ['texture', 'texture', 'hatch', 'concentric', 'none'];
  const layouts: ImpactGridState['layout'][] = ['grid', 'grid', 'bars', 'frame'];
  const regions: ImpactGridState['region'][] = ['slab', 'slab', 'band', 'disc', 'full'];
  return {
    region: regions[Math.floor(rng() * regions.length)],
    layout: layouts[Math.floor(rng() * layouts.length)],
    frameDepth: 1 + Math.floor(rng() * 5),
    cellSizeMm: Number((4 + rng() * 12).toFixed(1)),
    sizeVariation: Number((rng() * 0.7).toFixed(2)),
    positionJitter: Number((rng() * 0.6).toFixed(2)),
    rotationJitter: Number((rng() * 0.7).toFixed(2)),
    gap: Number((rng() * 0.4).toFixed(2)),
    impactRadiusMm: Math.round(20 + rng() * 100),
    paneStress: Number((0.3 + rng() * 0.7).toFixed(2)),
    energy: Number((0.3 + rng() * 0.7).toFixed(2)),
    impactStrength: Number((rng() * rng()).toFixed(2)),
    shatter: Number((0.4 + rng() * 0.6).toFixed(2)),
    scatter: Number((rng() * 0.7).toFixed(2)),
    debris: Number((rng() * 0.6).toFixed(2)),
    crush: Number((0.2 + rng() * 0.8).toFixed(2)),
    sweep: Number((rng()).toFixed(2)),
    fill: Number((0.3 + rng() * 0.7).toFixed(2)),
    fillStyle: fillStyles[Math.floor(rng() * fillStyles.length)],
    inkSplit: Number((rng() * 0.6).toFixed(2)),
    inkPath: rng() < 0.7,
  };
}
