import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  generateFlowLines,
  generateFlowLinesEven,
  pageMetrics,
  getPaperSize,
  type FlowLinesOptions,
  type FlowLinesResult,
  type SVGOptions,
  type Point,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { usePostProcess } from '../../PostProcessContext';
import { useOutput } from '../../OutputContext';
import { finishPlot } from '../../lib/finish';
import { defaultFlowState, type FlowState } from './types';

interface FlowFieldValue {
  state: FlowState;
  updateState: (updates: Partial<FlowState>) => void;
  randomizeSeed: () => void;
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
  const { post } = usePostProcess();
  const { register } = useOutput();
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
        densityStats: { enabled: false, removedCount: 0, removedTravelMm: 0 },
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
    const finished = finishPlot(frame, page, result, svgOptions, post.density);

    return {
      svg: finished.previewSvg,
      exportSvg: finished.exportSvg,
      result: finished.result,
      svgOptions: finished.svgOptions,
      hasLayers: finished.hasLayers,
      densityStats: finished.densityStats,
      width: page.widthPx,
      height: page.heightPx,
    };
  }, [
    active,
    state,
    post.density,
    frame.paper,
    frame.orientation,
    frame.resolution,
    frame.marginMm,
    frame.borderEnabled,
    frame.borderInsetMm,
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

  // Publish the current plot to the shared Output / Post-processing section.
  useEffect(() => {
    if (!active) return;
    register({
      exportSvg: generated.exportSvg,
      result: generated.result,
      svgOptions: generated.svgOptions,
      baseName: 'flow-lines',
      seed: state.seed,
      hasLayers: generated.hasLayers,
      densityStats: generated.densityStats,
    });
  }, [active, generated, state.seed, register]);

  const value: FlowFieldValue = {
    state,
    updateState,
    randomizeSeed,
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
