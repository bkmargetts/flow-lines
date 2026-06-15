import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  BASE_PX_PER_MM,
  type Orientation,
  type PaperFit,
  type TextureStyle,
  type TextureShapeOptions,
} from '@flow-lines/core';

/**
 * The page frame is shared by every project tab: the canvas is always a
 * physical sheet (paper size + orientation + render density), with a clear
 * paper border and a fit rule for art that doesn't match the sheet's aspect.
 * Lifting it out of any one project means switching projects never loses the
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

  // ---- Optional plottable background texture (its own 'texture' pen layer) ----
  /** Off → no texture lines, output unchanged */
  textureEnabled: boolean;
  textureStyle: TextureStyle;
  /** Line spacing / mark pitch in mm */
  textureSpacingMm: number;
  textureAngleDeg: number;
  /** Mark size multiplier (dots/shapes) / noise scale (contours) */
  textureScale: number;
  textureJitter: number;
  textureDensity: number;
  /** Second perpendicular set of lines (hatch) */
  textureCrossHatch: boolean;
  /** Ink for the texture layer */
  textureColor: string;
  textureSeed: number;
  /** Clean-paper sliver reserved around the drawing, in mm (0 = off) */
  textureHaloMm: number;
  textureShapes: TextureShapeOptions;
}

export const defaultFrame: FrameSettings = {
  paper: 'a4',
  orientation: 'portrait',
  resolution: BASE_PX_PER_MM,
  marginMm: 10,
  fit: 'fit',
  paperTone: '#faf9f6',
  textureEnabled: false,
  textureStyle: 'hatch',
  textureSpacingMm: 4,
  textureAngleDeg: 45,
  textureScale: 1,
  textureJitter: 0.2,
  textureDensity: 0.5,
  textureCrossHatch: false,
  textureColor: '#c9c2b4',
  textureSeed: 1,
  textureHaloMm: 1.5,
  textureShapes: { kinds: ['square', 'circle', 'line'], sizeMm: 4, overlap: 0 },
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
  return <FrameContext.Provider value={{ frame, updateFrame }}>{children}</FrameContext.Provider>;
}

export function useFrame(): FrameContextValue {
  const ctx = useContext(FrameContext);
  if (!ctx) throw new Error('useFrame must be used within a FrameProvider');
  return ctx;
}
