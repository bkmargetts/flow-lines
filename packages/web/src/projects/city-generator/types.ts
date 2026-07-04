import type { CityViewpoint, CityLightSide, SketchStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for the City Generator (mm / 0..1 units). `render.ts` converts it
 * to the core's `CityOptions` in px. The one control that defines the module
 * is `order` — the master flow↔rigid slider (0 = flowing/organic/artistic,
 * 1 = rigid/robotic); everything else is a family ceiling it scales.
 */
export interface CityState {
  preset: string;
  seed: number;
  zoom: number;

  viewpoint: CityViewpoint;
  order: number; // 0..1 — THE slider

  // Layout
  blockCols: number;
  blockRows: number;
  lotSizeMm: number;
  streetMm: number;
  density: number; // 0..1 lot occupancy
  downtown: number; // 0..1 centre-height envelope

  // Buildings
  heightMm: number; // mean building height
  heightVariance: number; // 0..1
  storeyMm: number;
  tiers: number; // 0..1 setback probability
  lean: number; // 0..1 ceiling on the lean/bow family

  // Windows
  windows: number; // 0..1 density (0 = off)
  windowMm: number; // column pitch

  // Tone
  shadeStrength: number; // 0..1
  hatchSpacingMm: number;
  lightSide: CityLightSide;

  // Skyline
  skylineRows: number;

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;
  sketch: number; // 0..1
  sketchStyle: SketchStyle;

  // Ink
  contourColor: string;
  windowColor: string;
  hatchColor: string;
}

export const defaultCityState: CityState = {
  preset: 'metropolis',
  seed: randomSeed(),
  zoom: 1,

  viewpoint: 'isometric',
  order: 0.55,

  blockCols: 7,
  blockRows: 7,
  lotSizeMm: 13,
  streetMm: 5,
  density: 0.85,
  downtown: 0.55,

  heightMm: 28,
  heightVariance: 0.6,
  storeyMm: 3.2,
  tiers: 0.35,
  lean: 0.6,

  windows: 0.7,
  windowMm: 2.4,

  shadeStrength: 0.6,
  hatchSpacingMm: 1.1,
  lightSide: 'left',

  skylineRows: 3,

  penWidthMm: 0.45,
  wobbleMm: 0.3,
  sketch: 0,
  sketchStyle: 'loose',

  contourColor: '#2a2a26',
  windowColor: '#2a2a26',
  hatchColor: '#2a2a26',
};
