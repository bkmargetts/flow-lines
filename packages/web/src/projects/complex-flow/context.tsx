import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  generateComplexFlow,
  applyHandDrawnStyle,
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type ComplexFlowOptions,
  type FlowLinesResult,
  type SVGOptions,
  type Point,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { buildPaletteLayerColors } from '../../lib/palette';
import { finishPlot } from '../../lib/finish';
import { downloadSvgText, triggerDownload } from '../../lib/download';
import { zipStore } from '../../lib/zip';
import { defaultComplexFlowState, type ComplexFlowState } from './types';

interface ComplexFlowValue {
  state: ComplexFlowState;
  updateState: (updates: Partial<ComplexFlowState>) => void;
  randomizeSeed: () => void;
  togglePlaceMode: () => void;
  addSingularity: (point: Point) => void;
  clearSingularities: () => void;
  downloadSVG: () => void;
  downloadLayers: () => void;
  generated: { svg: string; result: FlowLinesResult | null; svgOptions: SVGOptions; width: number; height: number };
}

const ComplexFlowContext = createContext<ComplexFlowValue | null>(null);

export function ComplexFlowProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { frame } = useFrame();
  const [state, setState] = useState<ComplexFlowState>(defaultComplexFlowState);

  const updateState = useCallback((updates: Partial<ComplexFlowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const togglePlaceMode = useCallback(() => {
    setState((prev) => ({ ...prev, placeMode: !prev.placeMode }));
  }, []);

  const addSingularity = useCallback((point: Point) => {
    setState((prev) =>
      prev.placeBrush === 'zero'
        ? { ...prev, manualZeros: [...prev.manualZeros, point] }
        : { ...prev, manualPoles: [...prev.manualPoles, point] }
    );
  }, []);

  const clearSingularities = useCallback(() => {
    updateState({ manualZeros: [], manualPoles: [] });
  }, [updateState]);

  const generated = useMemo(() => {
    // The piece plots to a physical sheet: paper + orientation set the pixel
    // dimensions and the SVG is tagged in mm for the plotter.
    const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution);
    const svgOptions: SVGOptions = {
      // Fallback ink for any band the palette doesn't cover (it always does).
      // The background colour is the shared page paper tone, shown behind the
      // (paper-free, plottable) SVG in the preview — same as every project.
      strokeColor: '#111111',
      strokeWidth: state.penWidthMm * page.pxPerMm,
      layerColors: buildPaletteLayerColors(state.palette, state.layerCount, state.customRamp),
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

    const options: ComplexFlowOptions = {
      width: page.widthPx,
      height: page.heightPx,
      seed: state.seed,
      zeroCount: state.zeroCount,
      poleCount: state.poleCount,
      zeroLayout: state.zeroLayout,
      poleLayout: state.poleLayout,
      singularitySpread: state.singularitySpread,
      planeScale: state.planeScale,
      fieldRotation: (state.fieldRotationDeg * Math.PI) / 180,
      manualZerosPx: state.manualZeros,
      manualPolesPx: state.manualPoles,
      seedLayout: state.seedLayout,
      seedCount: state.seedCount,
      stepsPerDir: state.stepsPerDir,
      stepLength: state.stepLength,
      stepJitter: state.stepJitter,
      wobble: state.wobble,
      speedClampMax: state.speedClampMax,
      minLineLength: state.minLineLength,
      // The shared paper-border margin, in pixels at the page's density
      margin: frame.marginMm * page.pxPerMm,
      layerCount: state.layerCount,
      layerBy: state.layerBy,
    };

    let result = generateComplexFlow(options);
    if (state.handDrawn) {
      result = applyHandDrawnStyle(result, { seed: state.seed, amplitude: 0.8 });
    }

    // Shared finishing: density protection, universal border, background
    // texture, and the clean/preview SVGs.
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
    downloadSvgText(generated.exportSvg, `complex-flow-${state.seed}.svg`);
  }, [generated.exportSvg, state.seed]);

  const downloadLayers = useCallback(() => {
    if (!generated.result) return;
    const layers = toSVGLayers(generated.result, generated.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({ name: `complex-flow-${state.seed}-${layer}.svg`, text: svg }))
    );
    triggerDownload(zip, `complex-flow-${state.seed}-layers.zip`);
  }, [generated.result, generated.svgOptions, state.seed]);

  const value: ComplexFlowValue = {
    state,
    updateState,
    randomizeSeed,
    togglePlaceMode,
    addSingularity,
    clearSingularities,
    downloadSVG,
    downloadLayers,
    generated,
  };

  return <ComplexFlowContext.Provider value={value}>{children}</ComplexFlowContext.Provider>;
}

export function useComplexFlow(): ComplexFlowValue {
  const ctx = useContext(ComplexFlowContext);
  if (!ctx) throw new Error('useComplexFlow must be used within a ComplexFlowProvider');
  return ctx;
}
