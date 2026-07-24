import type { HeartStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/** Preset fill shapes — compiled to a core `HeartsRegion` in render.ts. */
export type RegionShape = 'full' | 'ellipse' | 'ring' | 'diamond' | 'star' | 'heart' | 'blob';

/**
 * UI state for the Hearts generator (mm / 0..1 / deg units). `render.ts`
 * converts it to the core's `HeartsOptions` in px. A page full of love
 * hearts — outlined, solid, hatched, broken — with cupid's arrows, bold
 * emphasis and shadow-side shading.
 */
export interface HeartsState {
  seed: number;

  // Scene / placement
  count: number;
  clustering: number; // 0..1
  spacingMm: number; // soft min gap between centres; below heart size = pile

  // Fill shape (placement region; 'full' = the whole drawable box)
  regionShape: RegionShape;
  regionSize: number; // 0.15..1, fraction of the drawable box
  regionX: number; // 0..1 centre
  regionY: number; // 0..1 centre
  regionInner: number; // ring hole / star inner fraction, 0.1..0.9
  regionSoftEdge: boolean; // centres-only containment: hearts poke past the outline

  // Hearts
  heartSizeMm: number; // mean width
  sizeVariance: number; // 0..1
  depthGrade: number; // 0..0.5 nearer (lower) hearts larger
  plumpness: number; // 0..1 — 0 tall and pointy, 1 wide and chubby
  plumpVariance: number; // 0..1 per-heart jitter
  tilt: number; // 0..1 rotation jitter
  mix: Record<HeartStyle, boolean>;

  // Fill / decor
  fillDensity: number; // 0..1 solid/hatch line spacing (1 = tight)
  hatchAngleDeg: number; // base hatch direction
  hatchJitter: number; // 0..1 per-heart hatch angle jitter
  arrows: number; // 0..1 fraction pierced by a cupid's arrow
  boldOutline: number; // 0..1 fraction with multi-pass bold outlines

  // Render
  shading: number; // 0..1 shadow-side band hatch
  lightAngleDeg: number; // page-space light direction
  occlude: boolean;
  penWidthMm: number;
  wobbleMm: number;

  // Ink
  strokeColor: string;
}

export const defaultHeartsState: HeartsState = {
  seed: randomSeed(),

  count: 70,
  clustering: 0.35,
  spacingMm: 8,

  regionShape: 'full',
  regionSize: 0.8,
  regionX: 0.5,
  regionY: 0.5,
  regionInner: 0.5,
  regionSoftEdge: false,

  heartSizeMm: 15,
  sizeVariance: 0.3,
  depthGrade: 0.15,
  plumpness: 0.5,
  plumpVariance: 0.25,
  tilt: 0.35,
  mix: {
    outline: true,
    solid: true,
    hatched: true,
    broken: false,
  },

  fillDensity: 0.5,
  hatchAngleDeg: -35,
  hatchJitter: 0.3,
  arrows: 0.1,
  boldOutline: 0.3,

  shading: 0,
  lightAngleDeg: 315,
  occlude: true,
  penWidthMm: 0.4,
  wobbleMm: 0.25,

  strokeColor: '#1f1f1c',
};
