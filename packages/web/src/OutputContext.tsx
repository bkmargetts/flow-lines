import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { FlowLinesResult, SVGOptions } from '@flow-lines/core';

/** Impact of density protection on the current plot (for the readout). */
export interface DensityStats {
  enabled: boolean;
  /** Strokes removed because they piled onto already-saturated paper. */
  removedCount: number;
  /** Total drawn length of the removed strokes, in mm. */
  removedTravelMm: number;
}

/**
 * The active project's current plottable output, registered so the shared
 * Output / Post-processing section can drive the consolidated download buttons
 * and the density readout without each project owning its own download UI.
 */
export interface PlotOutput {
  /** Clean SVG for download. */
  exportSvg: string;
  /** Final composited result (texture + drawing + border) for per-layer export. */
  result: FlowLinesResult | null;
  svgOptions: SVGOptions;
  /** File stem, e.g. 'pen-ink' / 'flow-lines'. */
  baseName: string;
  seed: number;
  /** Whether the output has more than one pen layer worth a separate SVG. */
  hasLayers: boolean;
  densityStats: DensityStats;
}

interface OutputContextValue {
  output: PlotOutput | null;
  register: (output: PlotOutput | null) => void;
}

const OutputContext = createContext<OutputContextValue | null>(null);

export function OutputProvider({ children }: { children: ReactNode }) {
  const [output, setOutput] = useState<PlotOutput | null>(null);
  const register = useCallback((next: PlotOutput | null) => setOutput(next), []);
  return (
    <OutputContext.Provider value={{ output, register }}>{children}</OutputContext.Provider>
  );
}

export function useOutput(): OutputContextValue {
  const ctx = useContext(OutputContext);
  if (!ctx) throw new Error('useOutput must be used within an OutputProvider');
  return ctx;
}
