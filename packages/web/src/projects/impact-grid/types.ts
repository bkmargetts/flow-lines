import type { Point } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for Impact Grid (mm / 0..1 units). `render.ts` converts it to the
 * core's `ImpactGridOptions` in px. `drawMode` + `maskPath` follow the
 * canvas DrawableState contract — the drawn path (page px) is the impact
 * centreline the grid is struck along.
 */
export interface ImpactGridState {
  /** Last-picked look preset — a label for the picker; the knobs below are
   *  the actual state. */
  look: 'breakpoint' | 'rough' | 'rip';
  seed: number;
  layout: 'grid' | 'frame';
  frameDepth: number; // cells deep for the frame band

  // Grid
  cellSizeMm: number; // mean cell pitch
  sizeVariation: number; // 0..1 per-cell size jitter
  positionJitter: number; // 0..1 centre jitter
  rotationJitter: number; // 0..1 rotation jitter
  gap: number; // 0..0.6 gap fraction of pitch

  // Impact
  impactRadiusMm: number; // falloff radius
  impactStrength: number; // 0..1 push / torque / compression (0 = crush in place)
  shatter: number; // 0..1 shatter zone width
  scatter: number; // 0..1 fragment throw distance
  debris: number; // 0..1 pulverised-core dropout
  crush: number; // 0..1 rubble fineness near the line
  sweep: number; // 0..1 rubble drift along the stroke's travel

  // Marks
  fill: number; // 0..1 fill amount (region-committed)
  fillStyle: 'none' | 'hatch' | 'concentric';
  inkPath: boolean; // draw the strike line itself

  // Pen / finishing
  wobbleMm: number;
  penWidthMm: number;

  // Ink
  strokeColor: string;

  // Canvas drawing (DrawableState duck-type — drag-to-draw for free)
  drawMode: boolean;
  maskPath: Point[]; // impact centreline, page px
}

// Breakpoint-look defaults: a calm near-ordered system, one line crushing
// what it touches in place, region-committed concentric solids.
export const defaultImpactGridState: ImpactGridState = {
  look: 'breakpoint',
  seed: randomSeed(),
  layout: 'grid',
  frameDepth: 3,

  cellSizeMm: 7,
  sizeVariation: 0.1,
  positionJitter: 0.06,
  rotationJitter: 0.05,
  gap: 0.12,

  impactRadiusMm: 50,
  impactStrength: 0,
  shatter: 0.85,
  scatter: 0.1,
  debris: 0.15,
  crush: 0.8,
  sweep: 0.15,

  fill: 0.6,
  fillStyle: 'concentric',
  inkPath: false,

  wobbleMm: 0.15,
  penWidthMm: 0.35,

  strokeColor: '#1f1f1c',

  drawMode: false,
  maskPath: [],
};

/**
 * "Surprise me" genome: a fresh grid character and impact response within the
 * sliders' ranges. Never touches the seed, pen/ink, or the user's drawn
 * impact path.
 */
export function randomImpactGridGenome(rng: () => number): Partial<ImpactGridState> {
  const fillStyles: ImpactGridState['fillStyle'][] = ['none', 'hatch', 'concentric'];
  return {
    layout: rng() < 0.75 ? 'grid' : 'frame',
    frameDepth: 1 + Math.floor(rng() * 5),
    cellSizeMm: Number((4 + rng() * 12).toFixed(1)),
    sizeVariation: Number((rng() * 0.7).toFixed(2)),
    positionJitter: Number((rng() * 0.6).toFixed(2)),
    rotationJitter: Number((rng() * 0.7).toFixed(2)),
    gap: Number((rng() * 0.4).toFixed(2)),
    impactRadiusMm: Math.round(20 + rng() * 100),
    impactStrength: Number((rng() * rng()).toFixed(2)),
    shatter: Number((0.4 + rng() * 0.6).toFixed(2)),
    scatter: Number((rng() * 0.7).toFixed(2)),
    debris: Number((rng() * 0.6).toFixed(2)),
    crush: Number((0.2 + rng() * 0.8).toFixed(2)),
    sweep: Number((rng() * 0.8).toFixed(2)),
    fill: Number((rng() * 0.9).toFixed(2)),
    fillStyle: fillStyles[Math.floor(rng() * fillStyles.length)],
    inkPath: rng() < 0.25,
  };
}
