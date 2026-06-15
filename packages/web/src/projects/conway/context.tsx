import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  generateConwayExposure,
  toSVG,
  pageMetrics,
  getPaperSize,
  type ConwayExposureOptions,
  type SVGOptions,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { defaultConwayState, type ConwayState } from './types';

interface ConwayValue {
  state: ConwayState;
  updateState: (updates: Partial<ConwayState>) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
  generated: { svg: string; width: number; height: number };
}

const ConwayContext = createContext<ConwayValue | null>(null);

export function ConwayProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { frame } = useFrame();
  const [state, setState] = useState<ConwayState>(defaultConwayState);

  const updateState = useCallback((updates: Partial<ConwayState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const generated = useMemo(() => {
    // The piece plots to a physical sheet: paper + orientation set the pixel
    // dimensions and the SVG is tagged in mm for the plotter.
    const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution);
    if (!active) return { svg: '', width: page.widthPx, height: page.heightPx };

    const options: ConwayExposureOptions = {
      width: page.widthPx,
      height: page.heightPx,
      // The shared paper-border margin, in pixels at the page's density
      margin: frame.marginMm * page.pxPerMm,
      seed: state.seed,
      cellSize: state.cellSize * page.pxPerMm,
      generations: state.generations,
      decay: state.decay,
      gamma: state.gamma,
      faintThreshold: state.faintThreshold,
      mediumThreshold: state.mediumThreshold,
      solidThreshold: state.solidThreshold,
      residueMaxCells: state.residueMaxCells,
      wobble: state.wobble,
    };

    const svgOptions: SVGOptions = {
      strokeColor: state.strokeColor,
      strokeWidth: state.penWidthMm * page.pxPerMm,
      physicalWidth: `${page.widthMm}mm`,
      physicalHeight: `${page.heightMm}mm`,
    };

    const result = generateConwayExposure(options);
    return { svg: toSVG(result, svgOptions), width: page.widthPx, height: page.heightPx };
  }, [active, state, frame.paper, frame.orientation, frame.resolution, frame.marginMm]);

  const downloadSVG = useCallback(() => {
    if (!generated.svg) return;
    const blob = new Blob([generated.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conway-exposure-${state.seed}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generated.svg, state.seed]);

  const value: ConwayValue = {
    state,
    updateState,
    randomizeSeed,
    downloadSVG,
    generated,
  };

  return <ConwayContext.Provider value={value}>{children}</ConwayContext.Provider>;
}

export function useConway(): ConwayValue {
  const ctx = useContext(ConwayContext);
  if (!ctx) throw new Error('useConway must be used within a ConwayProvider');
  return ctx;
}
