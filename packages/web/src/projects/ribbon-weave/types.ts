import type { RibbonEdgeMode, RibbonStyle, SketchStyle } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * UI state for the Ribbon Weave (mm / 0..1 units). `render.ts` converts it to
 * the core's `RibbonWeaveOptions` in px. The one control that defines the
 * module is `order` — the master tangle↔knot slider (0 = free-flowing
 * tangle, 1 = strict Celtic lattice); everything else is a family ceiling it
 * scales.
 */
export interface RibbonWeaveState {
  preset: string;
  seed: number;

  order: number; // 0..1 — THE slider
  style: RibbonStyle; // woven band vs flat silk ribbon

  // Structure
  cellMm: number; // lattice pitch
  bandMm: number; // ribbon width
  breaks: number; // 0..1 knot-break density (0 = pure plait)
  edge: RibbonEdgeMode; // turn at the frame vs run off-page
  meander: number; // 0..1 loose-warp ceiling

  // Marks
  rungs: number; // 0..1 cross-tick density
  rungCurve: number; // 0..1 tick bow
  shading: number; // 0..1 shadow-side hatch
  shadowHatch: number; // 0..1 contact shadow at under-crossings
  lightAngleDeg: number; // light direction, degrees
  gapMm: number; // reserved-paper clearance at crossings
  twists: number; // 0..1 band-flip probability

  // Pen / finishing
  penWidthMm: number;
  wobbleMm: number;
  sketch: number; // 0..1
  sketchStyle: SketchStyle;

  // Ink
  inkGroups: number; // 1..3 pen groups (strand % group)
  strokeColor: string;
  shadeColor: string;
  ink2Color: string;
  ink3Color: string;
}

export const defaultRibbonWeaveState: RibbonWeaveState = {
  preset: 'knot-garden',
  seed: randomSeed(),

  order: 0.78,
  style: 'band',

  cellMm: 16,
  bandMm: 4.6,
  breaks: 0.4,
  edge: 'closed',
  meander: 1,

  rungs: 0.5,
  rungCurve: 0.6,
  shading: 0.6,
  shadowHatch: 0.7,
  lightAngleDeg: -135,
  gapMm: 0.8,
  twists: 0,

  penWidthMm: 0.45,
  wobbleMm: 0.3,
  sketch: 0,
  sketchStyle: 'loose',

  inkGroups: 1,
  strokeColor: '#2a2a26',
  shadeColor: '#2a2a26',
  ink2Color: '#8a3324',
  ink3Color: '#1f3a5f',
};
