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
  toSVG,
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type FlowLinesOptions,
  type FlowLinesResult,
  type SVGOptions,
  type Point,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { buildTexture } from '../../lib/texture';
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
    if (!active) return { svg: '', result: null as FlowLinesResult | null, svgOptions: emptyOptions, width: page.widthPx, height: page.heightPx };

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

    // Optional shared background texture, held a halo off the flow lines and
    // laid behind them on its own pen layer.
    const tex = buildTexture(frame, page, result.lines);
    if (tex) {
      result.lines = [...tex.lines, ...result.lines];
      svgOptions.layerColors = { texture: tex.color };
    }

    return {
      svg: toSVG(result, svgOptions),
      result,
      svgOptions,
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
    if (!generated.svg) return;
    const blob = new Blob([generated.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-lines-${state.seed}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generated.svg, state.seed]);

  const downloadLayers = useCallback(() => {
    if (!generated.result) return;
    const layers = toSVGLayers(generated.result, generated.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({ name: `flow-lines-${state.seed}-${layer}.svg`, text: svg }))
    );
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-lines-${state.seed}-layers.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generated.result, generated.svgOptions, state.seed]);

  const value: FlowFieldValue = {
    state,
    updateState,
    randomizeSeed,
    downloadSVG,
    downloadLayers,
    hasLayers: !!generated.svgOptions.layerColors,
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
