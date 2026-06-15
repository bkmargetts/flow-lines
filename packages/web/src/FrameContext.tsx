import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { BASE_PX_PER_MM, type Orientation, type PaperFit } from '@flow-lines/core';

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
}

export const defaultFrame: FrameSettings = {
  paper: 'a4',
  orientation: 'portrait',
  resolution: BASE_PX_PER_MM,
  marginMm: 10,
  fit: 'fit',
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
