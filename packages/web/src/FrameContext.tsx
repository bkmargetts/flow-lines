import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { BASE_PX_PER_MM, type Orientation, type PaperFit, type SketchStyle } from '@flow-lines/core';

/**
 * The page frame is shared by every layer in the stack: the canvas is always a
 * physical sheet (paper size + orientation + render density), with a clear
 * paper border and a fit rule for art that doesn't match the sheet's aspect.
 * Lifting it out of any one module means switching layers never loses the
 * sheet you set up, and every tool plots to the same page.
 */
export interface FrameSettings {
  /** Paper size id (a4, a3, letter…) */
  paper: string;
  orientation: Orientation;
  /** Render density in pixels per millimetre */
  resolution: number;
  /** Clear paper border in millimetres */
  marginMm: number;
  /** How art of a different aspect sits on the sheet */
  fit: PaperFit;
  /** Paper colour shown behind the drawing in the preview (not plotted) */
  paperTone: string;

  // ---- Optional plottable page border (its own 'border' pen layer) ----
  /** Draw a ruled rectangle framing the page (pure overlay, never reshapes art) */
  borderEnabled: boolean;
  /** Extra inset of the rule from the margin, in mm (0 = sits at the margin) */
  borderInsetMm: number;
  /** Corner radius of the border rule, in mm (0 = sharp corners) */
  borderCornerRadiusMm: number;

  // ---- Pen-plotting density protection (applies to every tool) ----
  /** Off → output untouched. On → drop strokes off over-inked paper. */
  densityEnabled: boolean;
  /** Max overlapping pen passes a patch may take before further strokes drop. */
  densityMaxPasses: number;
  /**
   * Minimum length (mm) a sustained overlap run must reach before it's trimmed.
   * Lines that merely cross share a point or two (below this — kept whole);
   * lines that coalesce and run together for longer get the shared run cut.
   * Smaller = trims even short converging runs near singularities; larger =
   * only long parallel duplication.
   */
  densityMinOverlapMm: number;

  // ---- Global hand-sketch finish (applies to every layer, once, at composite) ----
  /** Off → output untouched. On → the whole sheet is redrawn with a sketch hand. */
  sketchEnabled: boolean;
  /** Character of the hand: loose | fine | gestural | scratchy. */
  sketchStyle: SketchStyle;
  /** Overall strength 0..1 — drives wobble, jitter and the overdraw pass count. */
  sketchIntensity: number;
  /** How far open line ends overshoot their stopping point, 0..1. */
  sketchOvershoot: number;
  /** Pen-lift break frequency 0..1 — how often long strokes lift and resume. */
  sketchBreaks: number;
  /** Seed for the sketch pass, independent of every layer's own seed. */
  sketchSeed: number;

  // ---- Split across multiple sheets (export/preview only — never re-renders art) ----
  /** Off → one sheet, exactly as before. On → export slices the plot across tiles. */
  tileEnabled: boolean;
  /** Paper spec for each tile sheet ('a4' or 'custom:WxH'). */
  tileSheet: string;
  tileOrientation: Orientation;
  /**
   * true → each tile keeps `marginMm` of clear paper inside its own sheet
   * (trimmed when assembling; safe for plotters that can't reach the paper
   * edge). false → raw edge-to-edge slices, margin only around the whole.
   */
  tilePerSheetMargin: boolean;
  /** Glue-flap overlap in mm — adjacent sheets repeat this much artwork. */
  tileOverlapMm: number;
  /** Trim ticks at the sheet edges on their own 'tile-marks' pen layer. */
  tileMarks: boolean;
  /** Gap between each trim tick and the margin line it marks, in mm. */
  tileMarkOffsetMm: number;
  /**
   * How split sheets will be assembled: 'trim' = cut margins at the marks
   * and butt sheets (seamless); 'stitch' = tape whole sheets edge-to-edge —
   * the picture lines up because strips under the margins are dropped.
   */
  tileAssembly: 'trim' | 'stitch';

  // ---- Corner registration crosses (their own 'register' pen layer) ----
  /** Small + in each corner of the sheet (each sheet, when splitting). */
  crossesEnabled: boolean;
  /** Distance from the paper edge to each cross's centre, in mm. */
  crossOffsetMm: number;
}

export const defaultFrame: FrameSettings = {
  paper: 'a4',
  orientation: 'portrait',
  resolution: BASE_PX_PER_MM,
  marginMm: 10,
  fit: 'fit',
  paperTone: '#faf9f6',
  borderEnabled: false,
  borderInsetMm: 0,
  borderCornerRadiusMm: 0,
  densityEnabled: false,
  densityMaxPasses: 1,
  densityMinOverlapMm: 2.5,
  sketchEnabled: false,
  sketchStyle: 'loose',
  sketchIntensity: 0.5,
  sketchOvershoot: 0.35,
  sketchBreaks: 0.25,
  sketchSeed: 42,
  tileEnabled: false,
  tileSheet: 'a4',
  tileOrientation: 'portrait',
  tilePerSheetMargin: true,
  tileOverlapMm: 0,
  tileMarks: false,
  tileMarkOffsetMm: 0,
  tileAssembly: 'trim',
  crossesEnabled: false,
  crossOffsetMm: 3,
};

interface FrameContextValue {
  frame: FrameSettings;
  updateFrame: (updates: Partial<FrameSettings>) => void;
}

const FrameContext = createContext<FrameContextValue | null>(null);

export function FrameProvider({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useState<FrameSettings>(defaultFrame);
  const updateFrame = useCallback((updates: Partial<FrameSettings>) => {
    setFrame((prev) => ({ ...prev, ...updates }));
  }, []);
  return (
    <FrameContext.Provider value={{ frame, updateFrame }}>
      {children}
    </FrameContext.Provider>
  );
}

export function useFrame(): FrameContextValue {
  const ctx = useContext(FrameContext);
  if (!ctx) throw new Error('useFrame must be used within a FrameProvider');
  return ctx;
}
