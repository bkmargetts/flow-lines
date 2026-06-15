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
};
