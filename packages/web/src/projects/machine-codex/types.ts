import type { SketchStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for the Machine Codex (mm / 0..1 units). `render.ts` converts it
 * to the core's `MachineCodexOptions` in px. The control that defines the
 * module is `complexity` — one lone wheel at 0, a full contraption at 1;
 * `style` picks between the aged codex page and the ruled patent plate.
 */
export interface MachineCodexState {
  preset: string;
  seed: number;

  complexity: number; // 0..1 — THE slider
  style: 'codex' | 'patent';

  // Machine
  gearSizeMm: number; // mean big-wheel radius
  mechanisms: number; // 0..1 belt / linkage / weight extras
  hiddenLines: boolean;
  cutaway: boolean;

  // Plate
  annotations: number; // 0..1 dims + leaders + centerlines
  marginalia: number; // 0..1 script coverage
  detailInsets: number; // 0..2 zoomed detail figures
  title: string; // blank = invented per seed

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

export const defaultMachineCodexState: MachineCodexState = {
  preset: 'codex',
  seed: randomSeed(),

  complexity: 0.65,
  style: 'codex',

  gearSizeMm: 28,
  mechanisms: 0.7,
  hiddenLines: true,
  cutaway: true,

  annotations: 0.6,
  marginalia: 0.6,
  detailInsets: 1,
  title: '',

  hatchMm: 1.0,
  shading: 0.6,

  penWidthMm: 0.4,
  wobbleMm: 0.3,
  sketch: 0.25,
  sketchStyle: 'loose',
  strokeColor: '#2a2a26',
};
