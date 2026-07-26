import type { ImpactGridState } from './types';

export type ImpactGridLook = 'breakpoint' | 'rough' | 'rip';

/** Named looks spanning the module's range: the ordered crush-in-place
 *  default, the hand-ruled organic grid, and the explosive displacement
 *  field. Each is a state patch — seed, pen/ink, and the drawn path are
 *  never touched. */
export const IMPACT_GRID_LOOKS: Record<
  ImpactGridLook,
  { label: string; state: Partial<ImpactGridState> }
> = {
  breakpoint: {
    label: 'Breakpoint',
    state: {
      sizeVariation: 0.1,
      positionJitter: 0.06,
      rotationJitter: 0.05,
      gap: 0.12,
      impactStrength: 0,
      shatter: 0.85,
      scatter: 0.1,
      debris: 0.15,
      crush: 0.8,
      sweep: 0.15,
      fill: 0.6,
      fillStyle: 'concentric',
      wobbleMm: 0.15,
    },
  },
  rough: {
    label: 'Rough grid',
    state: {
      sizeVariation: 0.35,
      positionJitter: 0.25,
      rotationJitter: 0.3,
      gap: 0.15,
      impactStrength: 0.15,
      shatter: 0.7,
      scatter: 0.2,
      debris: 0.2,
      crush: 0.5,
      sweep: 0.2,
      fill: 0,
      fillStyle: 'none',
      wobbleMm: 0.25,
    },
  },
  rip: {
    label: 'Rip',
    state: {
      sizeVariation: 0.35,
      positionJitter: 0.25,
      rotationJitter: 0.3,
      gap: 0.15,
      impactStrength: 0.7,
      shatter: 0.6,
      scatter: 0.7,
      debris: 0.4,
      crush: 0.4,
      sweep: 0,
      fill: 0.2,
      fillStyle: 'hatch',
      wobbleMm: 0.25,
    },
  },
};
