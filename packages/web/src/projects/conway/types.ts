/**
 * Conway long-exposure settings. The page frame (paper, orientation,
 * resolution, margin) lives in the shared FrameContext, not here.
 */
export interface ConwayState {
  seed: number;
  /** How many R-pentominoes to detonate at the start */
  seedCount: number;
  /** Cell size in millimetres — sets the simulation's grid resolution */
  cellSize: number;
  /** Generations to simulate from the R-pentomino */
  generations: number;
  /** Per-generation exposure decay (0-1); higher = longer comet trails */
  decay: number;
  /** Perceptual lift on faint trails (<1 brightens the ghosts) */
  gamma: number;
  faintThreshold: number;
  mediumThreshold: number;
  solidThreshold: number;
  /** Final clusters this size or smaller draw as crisp outlines, not solid */
  residueMaxCells: number;
  /** Hand-drawn wobble amplitude in px */
  wobble: number;
  /** History render style */
  style: 'marks' | 'contour' | 'streaks';
  /** Reserved-paper sliver around the present, in mm */
  haloMm: number;
  /** Nested iso levels for the contour style */
  contourLevels: number;
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;

  // ---- Art style ----
  /** Master switch for the hand-drawn art treatment */
  artStyle: boolean;
  /** Draw the present-core as one hatched mass instead of grid boxes */
  massCore: boolean;
  /** Base interior hatch angle for the core mass, degrees */
  hatchAngle: number;
  /** Fraction of the core mass that gets the cross-hatch layer, 0..1 */
  crossHatchAmount: number;
  /** Low-frequency jitter on hatch spacing/phase, 0..1 */
  hatchJitter: number;
  /** Committed value bands for the trails; 0 = continuous */
  valueBands: number;
  /** Bias a single detonation toward a rule-of-thirds point, 0..1 */
  offCenter: number;
  /** Hold faint marks off the frame corners, 0..1 */
  vignette: number;
  /** Draw a plate-border line just inside the margin */
  plateBorder: boolean;
  /** Gap between the drawing and the plate border, in grid cells */
  borderGap: number;

  // ---- Presentation / inks ----
  /** Render preview & export in per-layer inks (present/ghost/trail) */
  multiInk: boolean;
  /** Ink for the crisp present (and plate border) */
  presentColor: string;
  /** Ink for the mid-tone ghosts */
  ghostColor: string;
  /** Ink for the faint trails */
  trailColor: string;
}

export const defaultConwayState: ConwayState = {
  seed: Math.floor(Math.random() * 1000000),
  seedCount: 1,
  cellSize: 1.8,
  generations: 400,
  decay: 0.92,
  gamma: 0.45,
  faintThreshold: 0.1,
  mediumThreshold: 0.32,
  solidThreshold: 0.62,
  residueMaxCells: 6,
  wobble: 0.8,
  style: 'marks',
  haloMm: 1.2,
  contourLevels: 5,
  strokeColor: '#000000',
  penWidthMm: 0.3,

  artStyle: true,
  massCore: true,
  hatchAngle: -32,
  crossHatchAmount: 0.5,
  hatchJitter: 0.5,
  valueBands: 4,
  offCenter: 0.6,
  vignette: 0.4,
  plateBorder: true,
  borderGap: 2,

  multiInk: true,
  presentColor: '#1a1a1a',
  ghostColor: '#5b6e7a',
  trailColor: '#b06a3c',
};
