import type { SketchStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for the Machine (mm / 0..1 units). `render.ts` converts it to the
 * core's `MachineOptions` in px. Two controls define the module:
 * `complexity` (one small mechanism → the page packed to the margins) and
 * `connectivity` (one interconnected mega-machine → a wall of overlapping
 * independent mechanisms at different depths).
 */
export interface MachineState {
  preset: string;
  seed: number;

  complexity: number; // 0..1
  connectivity: number; // 0..1

  // Machine
  gearSizeMm: number; // base big-wheel radius
  scaleVariety: number; // 0..1 per-cluster tooth-size spread
  mechanisms: number; // 0..1 belt / linkage / weight extras
  frameDensity: number; // 0..1 scaffold density
  cutaways: number; // 0..3 section wedges
  hiddenLines: boolean;

  // Tone
  hatchMm: number; // hatch spacing
  shading: number; // 0..1

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;
  sketch: number; // 0..1
  sketchStyle: SketchStyle;
  strokeColor: string;
}

export const defaultMachineState: MachineState = {
  preset: 'mega',
  seed: randomSeed(),

  complexity: 0.85,
  connectivity: 0.9,

  gearSizeMm: 26,
  scaleVariety: 0.6,
  mechanisms: 0.7,
  frameDensity: 0.7,
  cutaways: 2,
  hiddenLines: true,

  hatchMm: 1.0,
  shading: 0.6,

  penWidthMm: 0.4,
  wobbleMm: 0.3,
  sketch: 0.25,
  sketchStyle: 'loose',
  strokeColor: '#2a2a26',
};
