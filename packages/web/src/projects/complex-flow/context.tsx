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
  toSVG,
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
import { buildTexture } from '../../lib/texture';
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

const DARK_GROUND = '#0d0d12';

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
    const isDark = state.background === 'dark';
    const svgOptions: SVGOptions = {
      // Fallback ink for any band the palette doesn't cover.
      strokeColor: isDark ? '#ffffff' : '#111111',
      strokeWidth: state.penWidthMm * page.pxPerMm,
      // A dark ground is a deliberate part of the artwork, so bake it in. 'Paper'
      // mode leaves the SVG transparent (plottable) and shows the shared page
      // paper tone behind it in the preview, like the other projects.
      ...(isDark ? { includeBackground: true, backgroundColor: DARK_GROUND } : {}),
      layerColors: buildPaletteLayerColors(state.palette, state.layerCount),
      physicalWidth: `${page.widthMm}mm`,
      physicalHeight: `${page.heightMm}mm`,
    };
    if (!active) {
      return { svg: '', result: null as FlowLinesResult | null, svgOptions, width: page.widthPx, height: page.heightPx };
    }

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

    // Optional shared background texture, held a halo off the streamlines and
    // laid behind them on its own pen layer.
    const tex = buildTexture(frame, page, result.lines);
    if (tex) {
      result.lines = [...tex.lines, ...result.lines];
      svgOptions.layerColors = { ...(svgOptions.layerColors ?? {}), texture: tex.color };
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
      `complex-flow-${state.seed}.svg`
    );
  }, [generated.svg, state.seed]);

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
