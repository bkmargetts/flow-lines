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
  type SVGOptions,
  type Point,
} from '@flow-lines/core';
import { useFrame } from '../../FrameContext';
import { finishPlot } from '../../lib/finish';
import { downloadSvgText, triggerDownload } from '../../lib/download';
import { zipStore } from '../../lib/zip';
import { buildPaletteLayerColors } from '../../lib/palette';
import { defaultNoiseTextureState, type NoiseTextureState } from './types';

interface NoiseTextureValue {
  state: NoiseTextureState;
  updateState: (updates: Partial<NoiseTextureState>) => void;
  randomizeSeed: () => void;
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

/** Lay `count` straight swatch centrelines evenly across the usable page,
 * oriented at `angleDeg` and centred — core clips them to the margin. */
function layoutSwatches(
  widthPx: number,
  heightPx: number,
  marginPx: number,
  count: number,
  angleDeg: number,
  lengthPct: number
): Point[][] {
  const cx = widthPx / 2;
  const cy = heightPx / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const px = -Math.sin(rad);
  const py = Math.cos(rad);
  const usableW = Math.max(0, widthPx - 2 * marginPx);
  const usableH = Math.max(0, heightPx - 2 * marginPx);
  const halfLen = 0.5 * lengthPct * (Math.abs(dx) * usableW + Math.abs(dy) * usableH);
  const perpSpan = 0.9 * (Math.abs(px) * usableW + Math.abs(py) * usableH);
  const n = Math.max(1, count);
  const paths: Point[][] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const off = t * perpSpan;
    const ox = cx + px * off;
    const oy = cy + py * off;
    paths.push([
      { x: ox - dx * halfLen, y: oy - dy * halfLen },
      { x: ox + dx * halfLen, y: oy + dy * halfLen },
    ]);
  }
  return paths;
}

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
    const paths = layoutSwatches(
      page.widthPx,
      page.heightPx,
      marginPx,
      state.lineCount,
      state.angleDeg,
      state.lineLengthPct
    );

    const result = generateOverlappedLines({
      width: page.widthPx,
      height: page.heightPx,
      margin: marginPx,
      paths,
      maxThicknessPx: state.maxThicknessMm * page.pxPerMm,
      minThicknessPx: state.minThicknessMm * page.pxPerMm,
      passSpacingPx: state.passSpacingMm * page.pxPerMm,
      thicknessNoiseScale: state.thicknessNoiseScale,
      colorCount: state.colorCount,
      colorNoiseScale: state.colorNoiseScale,
      jitterPx: state.jitterMm * page.pxPerMm,
      wobbleAmpPx: state.wobbleAmpMm * page.pxPerMm,
      wobbleWavelengthPx: state.wobbleWavelengthMm * page.pxPerMm,
      seed: state.seed,
    });

    const svgOptions: SVGOptions = {
      strokeWidth: state.penWidthMm * page.pxPerMm,
      layerColors: buildPaletteLayerColors(state.palette, state.colorCount),
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
