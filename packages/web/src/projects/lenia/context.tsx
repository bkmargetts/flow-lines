import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  generateLenia,
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type LeniaOptions,
  type FlowLinesResult,
  type SVGOptions,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { finishPlot } from '../../lib/finish';
import { downloadSvgText, triggerDownload } from '../../lib/download';
import { zipStore } from '../../lib/zip';
import { defaultLeniaState, type LeniaState } from './types';

interface LeniaValue {
  state: LeniaState;
  updateState: (updates: Partial<LeniaState>) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
  downloadLayers: () => void;
  generated: {
    svg: string;
    exportSvg: string;
    result: FlowLinesResult | null;
    svgOptions: SVGOptions;
    width: number;
    height: number;
  };
}

const LeniaContext = createContext<LeniaValue | null>(null);

export function LeniaProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { frame } = useFrame();
  const [state, setState] = useState<LeniaState>(defaultLeniaState);

  const updateState = useCallback((updates: Partial<LeniaState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const generated = useMemo(() => {
    // The piece plots to a physical sheet: paper + orientation set the pixel
    // dimensions and the SVG is tagged in mm for the plotter.
    const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution);
    const layerColors = state.multiInk
      ? { core: state.coreColor, mid: state.midColor, rim: state.rimColor }
      : undefined;
    const svgOptions: SVGOptions = {
      strokeColor: state.multiInk ? state.coreColor : state.strokeColor,
      strokeWidth: state.penWidthMm * page.pxPerMm,
      layerColors,
      physicalWidth: `${page.widthMm}mm`,
      physicalHeight: `${page.heightMm}mm`,
    };
    const empty = {
      svg: '',
      exportSvg: '',
      result: null as FlowLinesResult | null,
      svgOptions,
      width: page.widthPx,
      height: page.heightPx,
    };
    if (!active) return empty;

    const options: LeniaOptions = {
      width: page.widthPx,
      height: page.heightPx,
      // The shared paper-border margin, in pixels at the page's density
      margin: frame.marginMm * page.pxPerMm,
      seed: state.seed,
      // Simulation params are grid-space — never multiplied by pxPerMm.
      gridCols: state.gridCols,
      preset: state.preset,
      kernelRadius: state.kernelRadius,
      mu: state.mu,
      sigma: state.sigma,
      timeRes: state.timeRes,
      beta: state.beta,
      seedPattern: state.seedPattern,
      seedSpots: state.seedSpots,
      steps: state.steps,
      longExposure: state.longExposure,
      decay: state.decay,
      gamma: state.gamma,
      style: state.style,
      contourLevels: state.contourLevels,
      blurSigma: state.blurSigma,
      isoLow: state.isoLow,
      isoHigh: state.isoHigh,
      fillThreshold: state.fillThreshold,
      artStyle: state.artStyle,
      hatchAngle: state.hatchAngle,
      crossHatchAmount: state.crossHatchAmount,
      hatchJitter: state.hatchJitter,
      valueBands: state.valueBands,
      vignette: state.vignette,
      wobble: state.wobble,
    };

    const result = generateLenia(options);

    // Shared finishing: density protection, universal border, background
    // texture, and the clean/preview SVGs. The SVG stays paper-free (a plotter
    // draws on real stock); the shared frame paper tone shows behind it.
    const finished = finishPlot(frame, page, result, svgOptions);

    return {
      svg: finished.previewSvg,
      exportSvg: finished.exportSvg,
      result: finished.result,
      svgOptions: finished.svgOptions,
      width: page.widthPx,
      height: page.heightPx,
    };
  }, [
    active,
    state,
    frame.paper,
    frame.orientation,
    frame.resolution,
    frame.marginMm,
    frame.borderEnabled,
    frame.borderInsetMm,
    frame.borderCornerRadiusMm,
    frame.densityEnabled,
    frame.densityMaxPasses,
    frame.densityMinOverlapMm,
    frame.textureEnabled,
    frame.textureModuleId,
    frame.textureParams,
    frame.textureHaloMm,
  ]);

  const downloadSVG = useCallback(() => {
    if (!generated.exportSvg) return;
    downloadSvgText(generated.exportSvg, `lenia-${state.seed}.svg`);
  }, [generated.exportSvg, state.seed]);

  const downloadLayers = useCallback(() => {
    if (!generated.result) return;
    const layers = toSVGLayers(generated.result, generated.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({ name: `lenia-${state.seed}-${layer}.svg`, text: svg }))
    );
    triggerDownload(zip, `lenia-${state.seed}-layers.zip`);
  }, [generated.result, generated.svgOptions, state.seed]);

  const value: LeniaValue = {
    state,
    updateState,
    randomizeSeed,
    downloadSVG,
    downloadLayers,
    generated,
  };

  return <LeniaContext.Provider value={value}>{children}</LeniaContext.Provider>;
}

export function useLenia(): LeniaValue {
  const ctx = useContext(LeniaContext);
  if (!ctx) throw new Error('useLenia must be used within a LeniaProvider');
  return ctx;
}
