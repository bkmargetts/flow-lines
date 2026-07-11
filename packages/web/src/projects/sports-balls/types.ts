import type { BallType } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/** Preset fill shapes — compiled to a core `SportsBallsRegion` in render.ts. */
export type RegionShape = 'full' | 'ellipse' | 'ring' | 'diamond' | 'star' | 'heart' | 'blob';

/**
 * UI state for the Sports Balls generator (mm / 0..1 / deg units). `render.ts`
 * converts it to the core's `SportsBallsOptions` in px. A pile of footballs,
 * tennis balls, ping pong balls… drawn as projected spheres with their seam
 * curves, each at its own orientation.
 */
export interface SportsBallsState {
  seed: number;

  // Scene / placement
  count: number;
  clustering: number; // 0..1
  spacingMm: number; // soft min gap between centres; below ball size = pile

  // Fill shape (placement region; 'full' = the whole drawable box)
  regionShape: RegionShape;
  regionSize: number; // 0.15..1, fraction of the drawable box
  regionX: number; // 0..1 centre
  regionY: number; // 0..1 centre
  regionInner: number; // ring hole / star inner fraction, 0.1..0.9
  regionSoftEdge: boolean; // centres-only containment: balls poke past the outline

  // Balls
  ballSizeMm: number; // mean diameter
  sizeVariance: number; // 0..1
  trueSizes: number; // 0..1 blend toward real-world relative diameters
  depthGrade: number; // 0..0.5 nearer (lower) balls larger
  mix: Record<BallType, boolean>;
  spin: number; // 0..1 random 3D orientation

  // Render
  shading: number; // 0..1 shadow-side hatch
  castShadows: number; // 0..1 contact-shadow crescents at overlaps
  lightAngleDeg: number; // page-space light direction
  occlude: boolean;
  penWidthMm: number;
  wobbleMm: number;

  // Ink
  strokeColor: string;
}

export const defaultSportsBallsState: SportsBallsState = {
  seed: randomSeed(),

  count: 60,
  clustering: 0.35,
  spacingMm: 10,

  regionShape: 'full',
  regionSize: 0.8,
  regionX: 0.5,
  regionY: 0.5,
  regionInner: 0.5,
  regionSoftEdge: false,

  ballSizeMm: 18,
  sizeVariance: 0.25,
  trueSizes: 0.5,
  depthGrade: 0.15,
  mix: {
    soccer: true,
    basketball: true,
    volleyball: true,
    baseball: true,
    tennis: true,
    pingpong: true,
  },
  spin: 1,

  shading: 0,
  castShadows: 0.5,
  lightAngleDeg: 315,
  occlude: true,
  penWidthMm: 0.4,
  wobbleMm: 0.25,

  strokeColor: '#1f1f1c',
};
