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
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type ConwayExposureOptions,
  type FlowLinesResult,
  type SVGOptions,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { finishPlot } from '../../lib/finish';
import { downloadSvgText, triggerDownload } from '../../lib/download';
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
    // Multi-ink colors the preview/export per layer; otherwise a single pen.
    const layerColors = state.multiInk
      ? { present: state.presentColor, ghost: state.ghostColor, trail: state.trailColor }
      : undefined;
    const svgOptions: SVGOptions = {
      strokeColor: state.multiInk ? state.presentColor : state.strokeColor,
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
      artStyle: state.artStyle,
      massCore: state.massCore,
      hatchAngle: state.hatchAngle,
      crossHatchAmount: state.crossHatchAmount,
      hatchJitter: state.hatchJitter,
      valueBands: state.valueBands,
      offCenter: state.offCenter,
      vignette: state.vignette,
    };

    const result = generateConwayExposure(options);

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
    frame.densityEnabled,
    frame.densityMaxPasses,
    frame.densityMinOverlapMm,
    frame.textureEnabled,
    frame.textureStyle,
    frame.textureSpacingMm,
    frame.textureAngleDeg,
    frame.textureScale,
    frame.textureJitter,
    frame.textureDensity,
    frame.textureCrossHatch,
    frame.textureColor,
    frame.textureSeed,
    frame.textureHaloMm,
    frame.textureShapes,
  ]);

  const downloadSVG = useCallback(() => {
    if (!generated.exportSvg) return;
    downloadSvgText(generated.exportSvg, `conway-exposure-${state.seed}.svg`);
  }, [generated.exportSvg, state.seed]);

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
