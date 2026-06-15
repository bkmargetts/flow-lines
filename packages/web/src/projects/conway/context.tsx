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
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type ConwayExposureOptions,
  type FlowLinesResult,
  type SVGOptions,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { zipStore } from '../../lib/zip';
import { defaultConwayState, type ConwayState } from './types';

interface ConwayValue {
  state: ConwayState;
  updateState: (updates: Partial<ConwayState>) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
  downloadLayers: () => void;
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
    const svgOptions: SVGOptions = {
      strokeColor: state.strokeColor,
      strokeWidth: state.penWidthMm * page.pxPerMm,
      physicalWidth: `${page.widthMm}mm`,
      physicalHeight: `${page.heightMm}mm`,
    };
    if (!active) {
      return { svg: '', result: null as FlowLinesResult | null, svgOptions, width: page.widthPx, height: page.heightPx };
    }

    const options: ConwayExposureOptions = {
      width: page.widthPx,
      height: page.heightPx,
      // The shared paper-border margin, in pixels at the page's density
      margin: frame.marginMm * page.pxPerMm,
      seed: state.seed,
      seedCount: state.seedCount,
      cellSize: state.cellSize * page.pxPerMm,
      generations: state.generations,
      decay: state.decay,
      gamma: state.gamma,
      faintThreshold: state.faintThreshold,
      mediumThreshold: state.mediumThreshold,
      solidThreshold: state.solidThreshold,
      residueMaxCells: state.residueMaxCells,
      wobble: state.wobble,
      style: state.style,
      haloRadius: state.haloMm * page.pxPerMm,
      contourLevels: state.contourLevels,
    };

    const result = generateConwayExposure(options);
    return {
      svg: toSVG(result, svgOptions),
      result,
      svgOptions,
      width: page.widthPx,
      height: page.heightPx,
    };
  }, [active, state, frame.paper, frame.orientation, frame.resolution, frame.marginMm]);

  const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSVG = useCallback(() => {
    if (!generated.svg) return;
    triggerDownload(
      new Blob([generated.svg], { type: 'image/svg+xml' }),
      `conway-exposure-${state.seed}.svg`
    );
  }, [generated.svg, state.seed]);

  const downloadLayers = useCallback(() => {
    if (!generated.result) return;
    const layers = toSVGLayers(generated.result, generated.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({ name: `conway-${state.seed}-${layer}.svg`, text: svg }))
    );
    triggerDownload(zip, `conway-exposure-${state.seed}-layers.zip`);
  }, [generated.result, generated.svgOptions, state.seed]);

  const value: ConwayValue = {
    state,
    updateState,
    randomizeSeed,
    downloadSVG,
    downloadLayers,
    generated,
  };

  return <ConwayContext.Provider value={value}>{children}</ConwayContext.Provider>;
}

export function useConway(): ConwayValue {
  const ctx = useContext(ConwayContext);
  if (!ctx) throw new Error('useConway must be used within a ConwayProvider');
  return ctx;
}
