import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  generateFlowLines,
  generateFlowLinesEven,
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type FlowLinesOptions,
  type FlowLinesResult,
  type SVGOptions,
  type Point,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { finishPlot } from '../../lib/finish';
import { downloadSvgText, triggerDownload } from '../../lib/download';
import { zipStore } from '../../lib/zip';
import { defaultFlowState, type FlowState } from './types';

interface FlowFieldValue {
  state: FlowState;
  updateState: (updates: Partial<FlowState>) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
  downloadLayers: () => void;
  hasLayers: boolean;
  togglePaintMode: () => void;
  clearPaintedPoints: () => void;
  addPaintedPoint: (point: Point) => void;
  generated: { svg: string; result: FlowLinesResult | null; svgOptions: SVGOptions; width: number; height: number };
}

const FlowFieldContext = createContext<FlowFieldValue | null>(null);

export function FlowFieldProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { frame } = useFrame();
  const [state, setState] = useState<FlowState>(defaultFlowState);

  const updateState = useCallback((updates: Partial<FlowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const togglePaintMode = useCallback(() => {
    setState((prev) => ({ ...prev, paintMode: !prev.paintMode }));
  }, []);

  const clearPaintedPoints = useCallback(() => {
    updateState({ paintedPoints: [] });
  }, [updateState]);

  const addPaintedPoint = useCallback((point: Point) => {
    setState((prev) => ({ ...prev, paintedPoints: [...prev.paintedPoints, point] }));
  }, []);

  const generated = useMemo(() => {
    // The flow canvas is a physical sheet too: paper + orientation set the
    // pixel dimensions and the SVG is tagged in mm for the plotter
    const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution);
    const emptyOptions: SVGOptions = {};
    if (!active) {
      return {
        svg: '',
        exportSvg: '',
        result: null as FlowLinesResult | null,
        svgOptions: emptyOptions,
        hasLayers: false,
        width: page.widthPx,
        height: page.heightPx,
      };
    }

    const usePaintedPoints = state.paintMode && state.paintedPoints.length > 0;
    // Painted seeds are explicit intent, so they win over dense-fill.
    const useDenseFill = state.denseFill && !usePaintedPoints;
    const flowOptions: FlowLinesOptions = {
      width: page.widthPx,
      height: page.heightPx,
      lineCount: usePaintedPoints ? state.paintedPoints.length : state.lineCount,
      seed: state.seed,
      stepLength: state.stepLength,
      maxSteps: state.maxSteps,
      // The shared paper-border margin, in pixels at the page's density
      margin: frame.marginMm * page.pxPerMm,
      minLineLength: state.minLineLength,
      noiseScale: state.noiseScale,
      octaves: state.octaves,
      persistence: state.persistence,
      lacunarity: state.lacunarity,
      ...(usePaintedPoints && { startPoints: state.paintedPoints }),
    };

    const svgOptions: SVGOptions = {
      strokeColor: state.strokeColor,
      strokeWidth: state.penWidthMm * page.pxPerMm,
      physicalWidth: `${page.widthMm}mm`,
      physicalHeight: `${page.heightMm}mm`,
    };

    const result = useDenseFill
      ? generateFlowLinesEven({
          width: flowOptions.width,
          height: flowOptions.height,
          separation: Math.max(1, state.lineSpacingMm * page.pxPerMm),
          seed: flowOptions.seed,
          stepLength: flowOptions.stepLength,
          maxSteps: flowOptions.maxSteps,
          margin: flowOptions.margin,
          minLineLength: flowOptions.minLineLength,
          noiseScale: flowOptions.noiseScale,
          octaves: flowOptions.octaves,
          persistence: flowOptions.persistence,
          lacunarity: flowOptions.lacunarity,
        })
      : generateFlowLines(flowOptions);

    // Shared finishing: density protection, universal border, background
    // texture, and the clean/preview SVGs.
    const finished = finishPlot(frame, page, result, svgOptions);

    return {
      svg: finished.previewSvg,
      exportSvg: finished.exportSvg,
      result: finished.result,
      svgOptions: finished.svgOptions,
      hasLayers: finished.hasLayers,
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
    downloadSvgText(generated.exportSvg, `flow-lines-${state.seed}.svg`);
  }, [generated.exportSvg, state.seed]);

  const downloadLayers = useCallback(() => {
    if (!generated.result) return;
    const layers = toSVGLayers(generated.result, generated.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({ name: `flow-lines-${state.seed}-${layer}.svg`, text: svg }))
    );
    triggerDownload(zip, `flow-lines-${state.seed}-layers.zip`);
  }, [generated.result, generated.svgOptions, state.seed]);

  const value: FlowFieldValue = {
    state,
    updateState,
    randomizeSeed,
    downloadSVG,
    downloadLayers,
    hasLayers: generated.hasLayers,
    togglePaintMode,
    clearPaintedPoints,
    addPaintedPoint,
    generated,
  };

  return <FlowFieldContext.Provider value={value}>{children}</FlowFieldContext.Provider>;
}

export function useFlowField(): FlowFieldValue {
  const ctx = useContext(FlowFieldContext);
  if (!ctx) throw new Error('useFlowField must be used within a FlowFieldProvider');
  return ctx;
}
