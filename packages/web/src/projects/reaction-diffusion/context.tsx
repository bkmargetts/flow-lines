import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  generateReactionDiffusion,
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type ReactionDiffusionOptions,
  type FlowLinesResult,
  type SVGOptions,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { finishPlot } from '../../lib/finish';
import { downloadSvgText, triggerDownload } from '../../lib/download';
import { zipStore } from '../../lib/zip';
import { defaultRDState, type RDState } from './types';

interface RDValue {
  state: RDState;
  updateState: (updates: Partial<RDState>) => void;
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

const RDContext = createContext<RDValue | null>(null);

export function RDProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { frame } = useFrame();
  const [state, setState] = useState<RDState>(defaultRDState);

  const updateState = useCallback((updates: Partial<RDState>) => {
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

    const options: ReactionDiffusionOptions = {
      width: page.widthPx,
      height: page.heightPx,
      // The shared paper-border margin, in pixels at the page's density
      margin: frame.marginMm * page.pxPerMm,
      seed: state.seed,
      // Simulation params are grid-space — never multiplied by pxPerMm.
      gridCols: state.gridCols,
      preset: state.preset,
      feed: state.feed,
      kill: state.kill,
      steps: state.steps,
      du: state.du,
      dv: state.dv,
      seedSpots: state.seedSpots,
      seedLayout: state.seedLayout,
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

    const result = generateReactionDiffusion(options);

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
    downloadSvgText(generated.exportSvg, `reaction-diffusion-${state.seed}.svg`);
  }, [generated.exportSvg, state.seed]);

  const downloadLayers = useCallback(() => {
    if (!generated.result) return;
    const layers = toSVGLayers(generated.result, generated.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({ name: `reaction-diffusion-${state.seed}-${layer}.svg`, text: svg }))
    );
    triggerDownload(zip, `reaction-diffusion-${state.seed}-layers.zip`);
  }, [generated.result, generated.svgOptions, state.seed]);

  const value: RDValue = {
    state,
    updateState,
    randomizeSeed,
    downloadSVG,
    downloadLayers,
    generated,
  };

  return <RDContext.Provider value={value}>{children}</RDContext.Provider>;
}

export function useRD(): RDValue {
  const ctx = useContext(RDContext);
  if (!ctx) throw new Error('useRD must be used within an RDProvider');
  return ctx;
}
