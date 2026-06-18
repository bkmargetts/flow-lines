import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  generateOverlappedLines,
  toSVGLayers,
  pageMetrics,
  getPaperSize,
  type FlowLinesResult,
  type MaskShape,
  type Point,
  type SVGOptions,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { finishPlot } from '../../lib/finish';
import { downloadSvgText, triggerDownload } from '../../lib/download';
import { zipStore } from '../../lib/zip';
import { buildPaletteLayerColors } from '../../lib/palette';
import { defaultNoiseTextureState, type NoiseTextureState } from './types';

/** Build the active mask shape (in canvas px) from the project state. */
function buildMaskShapes(
  state: NoiseTextureState,
  page: { widthPx: number; heightPx: number; pxPerMm: number },
  marginPx: number
): MaskShape[] | undefined {
  const ppm = page.pxPerMm;
  switch (state.maskMode) {
    case 'strips':
      return [
        {
          type: 'strips',
          angleDeg: state.stripAngleDeg,
          widthPx: Math.max(0.5, state.stripWidthMm * ppm),
          gapPx: Math.max(0, state.stripGapMm * ppm),
        },
      ];
    case 'band':
      if (state.maskPath.length < 1) return undefined;
      return [{ type: 'band', path: state.maskPath, halfWidthPx: state.bandWidthMm * ppm }];
    case 'rect':
    case 'ellipse': {
      const usableW = page.widthPx - 2 * marginPx;
      const usableH = page.heightPx - 2 * marginPx;
      const w = usableW * state.maskWidthPct;
      const h = usableH * state.maskHeightPct;
      const cx = page.widthPx / 2;
      const cy = page.heightPx / 2;
      return state.maskMode === 'rect'
        ? [{ type: 'rect', x: cx - w / 2, y: cy - h / 2, w, h }]
        : [{ type: 'ellipse', cx, cy, rx: w / 2, ry: h / 2 }];
    }
    default:
      return undefined;
  }
}

interface NoiseTextureValue {
  state: NoiseTextureState;
  updateState: (updates: Partial<NoiseTextureState>) => void;
  randomizeSeed: () => void;
  addMaskPoint: (point: Point) => void;
  clearMaskPath: () => void;
  toggleDrawMode: () => void;
  downloadSVG: () => void;
  downloadLayers: () => void;
  hasLayers: boolean;
  generated: {
    svg: string;
    result: FlowLinesResult | null;
    svgOptions: SVGOptions;
    width: number;
    height: number;
  };
}

const NoiseTextureContext = createContext<NoiseTextureValue | null>(null);

export function NoiseTextureProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { frame } = useFrame();
  const [state, setState] = useState<NoiseTextureState>(defaultNoiseTextureState);

  const updateState = useCallback((updates: Partial<NoiseTextureState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const addMaskPoint = useCallback((point: Point) => {
    setState((prev) => ({ ...prev, maskPath: [...prev.maskPath, point] }));
  }, []);

  const clearMaskPath = useCallback(() => {
    updateState({ maskPath: [] });
  }, [updateState]);

  const toggleDrawMode = useCallback(() => {
    setState((prev) => ({ ...prev, drawMode: !prev.drawMode }));
  }, []);

  const generated = useMemo(() => {
    // The swatch canvas is a physical sheet too: paper + orientation set the
    // pixel dimensions and the SVG is tagged in mm for the plotter.
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

    const marginPx = frame.marginMm * page.pxPerMm;
    const result = generateOverlappedLines({
      width: page.widthPx,
      height: page.heightPx,
      margin: marginPx,
      angleDeg: state.angleDeg,
      lineLengthPct: state.lineLengthPct,
      spacingPx: state.spacingMm * page.pxPerMm,
      colorCount: state.colorCount,
      phaseDriftAlongPx: state.phaseDriftAlongMm * page.pxPerMm,
      phaseDriftAcrossPx: state.phaseDriftAcrossMm * page.pxPerMm,
      phaseNoiseAmpPx: state.phaseNoiseAmpMm * page.pxPerMm,
      phaseNoiseScale: state.phaseNoiseScale,
      jitterPx: state.jitterMm * page.pxPerMm,
      wobbleAmpPx: state.wobbleAmpMm * page.pxPerMm,
      wobbleWavelengthPx: state.wobbleWavelengthMm * page.pxPerMm,
      edgeSmoothPx: state.edgeSmoothMm * page.pxPerMm,
      maskShapes: buildMaskShapes(state, page, marginPx),
      seed: state.seed,
    });

    const svgOptions: SVGOptions = {
      strokeWidth: state.penWidthMm * page.pxPerMm,
      layerColors: buildPaletteLayerColors(state.palette, state.colorCount, state.customRamp),
      physicalWidth: `${page.widthMm}mm`,
      physicalHeight: `${page.heightMm}mm`,
    };

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
    downloadSvgText(generated.exportSvg, `noise-texture-${state.seed}.svg`);
  }, [generated.exportSvg, state.seed]);

  const downloadLayers = useCallback(() => {
    if (!generated.result) return;
    const layers = toSVGLayers(generated.result, generated.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({
        name: `noise-texture-${state.seed}-${layer}.svg`,
        text: svg,
      }))
    );
    triggerDownload(zip, `noise-texture-${state.seed}-layers.zip`);
  }, [generated.result, generated.svgOptions, state.seed]);

  const value: NoiseTextureValue = {
    state,
    updateState,
    randomizeSeed,
    addMaskPoint,
    clearMaskPath,
    toggleDrawMode,
    downloadSVG,
    downloadLayers,
    hasLayers: generated.hasLayers,
    generated,
  };

  return <NoiseTextureContext.Provider value={value}>{children}</NoiseTextureContext.Provider>;
}

export function useNoiseTexture(): NoiseTextureValue {
  const ctx = useContext(NoiseTextureContext);
  if (!ctx) throw new Error('useNoiseTexture must be used within a NoiseTextureProvider');
  return ctx;
}
