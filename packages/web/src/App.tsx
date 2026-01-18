import { useState, useCallback, useMemo } from 'react';
import { generateFlowLines, toSVG, type FlowLinesOptions, type SVGOptions, type Point, type Attractor, type FieldMode, type DensityPoint } from '@flow-lines/core';
import { Preview } from './components/Preview';
import { Toolbar } from './components/Toolbar';
import { Sheet } from './components/Sheet';
import { Controls } from './components/Controls';
import { PaintControls } from './components/PaintControls';

export type BrushType = 'attractor' | 'repeller';
export type DensityBrushType = 'density';

// Flow field presets for different organic styles
export const FIELD_PRESETS = {
  wispy: {
    name: 'Wispy',
    fieldMode: 'curl' as FieldMode,
    noiseScale: 0.001,
    octaves: 1,
    persistence: 0.3,
    lacunarity: 2,
    smoothing: 0.5,
    lineCount: 2000,
    maxSteps: 3000,
    stepLength: 1,
    separationDistance: 3,
    fillMode: true,
    strokeWidth: 0.3,
  },
  flowing: {
    name: 'Flowing',
    fieldMode: 'curl' as FieldMode,
    noiseScale: 0.0015,
    octaves: 2,
    persistence: 0.4,
    lacunarity: 2.5,
    smoothing: 0.6,
    lineCount: 800,
    maxSteps: 1500,
    stepLength: 1.5,
    separationDistance: 3,
    bidirectional: true,
    evenDistribution: true,
    strokeWidth: 0.5,
  },
  smooth: {
    name: 'Smooth',
    fieldMode: 'curl' as FieldMode,
    noiseScale: 0.003,
    octaves: 2,
    persistence: 0.3,
    lacunarity: 2,
    smoothing: 0.5,
  },
  turbulent: {
    name: 'Turbulent',
    fieldMode: 'turbulent' as FieldMode,
    noiseScale: 0.006,
    octaves: 5,
    persistence: 0.6,
    lacunarity: 2,
    smoothing: 0.2,
  },
  spiral: {
    name: 'Spiral',
    fieldMode: 'spiral' as FieldMode,
    noiseScale: 0.004,
    octaves: 3,
    persistence: 0.5,
    lacunarity: 2,
    smoothing: 0.4,
    spiralStrength: 0.3,
  },
  ridged: {
    name: 'Ridged',
    fieldMode: 'ridged' as FieldMode,
    noiseScale: 0.004,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2,
    smoothing: 0.3,
  },
  organic: {
    name: 'Organic',
    fieldMode: 'warped' as FieldMode,
    noiseScale: 0.004,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2,
    smoothing: 0.5,
    warpStrength: 0.6,
  },
  classic: {
    name: 'Classic',
    fieldMode: 'normal' as FieldMode,
    noiseScale: 0.005,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2,
    smoothing: 0,
  },
} as const;

export type PresetName = keyof typeof FIELD_PRESETS;

export interface AppState {
  width: number;
  height: number;
  lineCount: number;
  seed: number;
  stepLength: number;
  maxSteps: number;
  margin: number;
  minLineLength: number;
  noiseScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  strokeColor: string;
  strokeWidth: number;
  paintMode: boolean;
  paintedPoints: Point[];
  showDots: boolean;
  attractorMode: boolean;
  attractors: Attractor[];
  attractorBrushType: BrushType;
  attractorRadius: number;
  attractorStrength: number;
  showAttractors: boolean;
  // Organic pattern options
  fieldMode: FieldMode;
  smoothing: number;
  spiralStrength: number;
  warpStrength: number;
  // Advanced line options
  separationDistance: number;
  bidirectional: boolean;
  evenDistribution: boolean;
  fillMode: boolean;
  // Variable density options
  variableDensity: boolean;
  densityVariation: number;
  minSeparation: number;
  // Density point painting
  densityPoints: DensityPoint[];
  densityMode: boolean;
  densityRadius: number;
  densityStrength: number;
  showDensityPoints: boolean;
  // Organic aesthetics (for pen plotter)
  organicWobble: number;
  velocityFadeout: boolean;
  edgeAttraction: number;
}

// Calculate initial canvas size based on viewport
function getInitialCanvasSize(): { width: number; height: number } {
  const toolbarHeight = 70; // Compact toolbar + padding
  const horizontalPadding = 24;
  const maxWidth = Math.min(window.innerWidth - horizontalPadding, 1200);
  const maxHeight = Math.min(window.innerHeight - toolbarHeight, 1200);

  // Round to nearest 50 for cleaner values
  const width = Math.round(maxWidth / 50) * 50;
  const height = Math.round(maxHeight / 50) * 50;

  return { width: Math.max(width, 300), height: Math.max(height, 300) };
}

const initialSize = getInitialCanvasSize();

const defaultState: AppState = {
  width: initialSize.width,
  height: initialSize.height,
  lineCount: 800,
  seed: Math.floor(Math.random() * 1000000),
  stepLength: 2,
  maxSteps: 500,
  margin: 20,
  minLineLength: 15,
  noiseScale: 0.005,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  strokeColor: '#000000',
  strokeWidth: 0.5,
  paintMode: false,
  paintedPoints: [],
  showDots: true,
  attractorMode: false,
  attractors: [],
  attractorBrushType: 'attractor',
  attractorRadius: 50,
  attractorStrength: 1.0,
  showAttractors: true,
  // Organic pattern defaults - start with curl for smoother flow
  fieldMode: 'curl',
  smoothing: 0.3,
  spiralStrength: 0.3,
  warpStrength: 0.5,
  // Advanced line defaults - fill mode on by default for nice flowing patterns
  separationDistance: 6,
  bidirectional: false,
  evenDistribution: false,
  fillMode: true,
  // Variable density defaults
  variableDensity: true,
  densityVariation: 0.6,
  minSeparation: 1,
  // Density point painting
  densityPoints: [],
  densityMode: false,
  densityRadius: 150,
  densityStrength: 1.0,
  showDensityPoints: true,
  // Organic aesthetics - subtle defaults for natural look
  organicWobble: 0.3,
  velocityFadeout: true,
  edgeAttraction: 0.4,
};

export function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [sheetOpen, setSheetOpen] = useState(false);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeAll = useCallback(() => {
    const random = () => Math.random();
    const modes: FieldMode[] = ['normal', 'curl', 'spiral', 'turbulent', 'ridged', 'warped'];
    const randomMode = modes[Math.floor(random() * modes.length)];
    const useFillMode = random() > 0.3; // 70% chance of fill mode

    updateState({
      seed: Math.floor(random() * 1000000),
      lineCount: useFillMode ? Math.floor(random() * 1500) + 500 : Math.floor(random() * 300) + 50,
      maxSteps: Math.floor(random() * 400) + 100,
      stepLength: 1 + random() * 3,
      noiseScale: 0.002 + random() * 0.015,
      octaves: Math.floor(random() * 6) + 1,
      persistence: 0.2 + random() * 0.6,
      lacunarity: 1.5 + random() * 2,
      fieldMode: randomMode,
      smoothing: random() * 0.8,
      spiralStrength: random() * 0.6,
      warpStrength: 0.3 + random() * 0.5,
      // Line mode settings
      fillMode: useFillMode,
      separationDistance: useFillMode ? Math.floor(random() * 12) + 3 : Math.floor(random() * 10),
      bidirectional: random() > 0.5,
      evenDistribution: random() > 0.5,
      // Density settings (only matter when fillMode is on)
      variableDensity: useFillMode && random() > 0.3, // 70% chance when fill mode
      densityVariation: 0.4 + random() * 0.6,
      minSeparation: 0.5 + random() * 2,
      // Organic aesthetics
      organicWobble: random() * 0.6,
      velocityFadeout: random() > 0.3, // 70% chance
      edgeAttraction: random() * 0.6,
    });
  }, [updateState]);

  const togglePaintMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      paintMode: !prev.paintMode,
      attractorMode: false,
      densityMode: false,
    }));
  }, []);

  const toggleAttractorMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      attractorMode: !prev.attractorMode,
      paintMode: false,
      densityMode: false,
    }));
  }, []);

  const clearPaintedPoints = useCallback(() => {
    updateState({ paintedPoints: [] });
  }, [updateState]);

  const addPaintedPoint = useCallback((point: Point) => {
    setState((prev) => ({
      ...prev,
      paintedPoints: [...prev.paintedPoints, point],
    }));
  }, []);

  const addAttractor = useCallback((x: number, y: number) => {
    setState((prev) => {
      const strength = prev.attractorBrushType === 'attractor'
        ? prev.attractorStrength
        : -prev.attractorStrength;

      return {
        ...prev,
        attractors: [...prev.attractors, { x, y, radius: prev.attractorRadius, strength }],
      };
    });
  }, []);

  const clearAttractors = useCallback(() => {
    updateState({ attractors: [] });
  }, [updateState]);

  const toggleDensityMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      densityMode: !prev.densityMode,
      paintMode: false,
      attractorMode: false,
    }));
  }, []);

  const addDensityPoint = useCallback((x: number, y: number) => {
    setState((prev) => ({
      ...prev,
      densityPoints: [...prev.densityPoints, {
        x,
        y,
        radius: prev.densityRadius,
        strength: prev.densityStrength,
      }],
    }));
  }, []);

  const clearDensityPoints = useCallback(() => {
    updateState({ densityPoints: [] });
  }, [updateState]);

  const svgContent = useMemo(() => {
    const usePaintedPoints = state.paintedPoints.length > 0;

    const flowOptions: FlowLinesOptions = {
      width: state.width,
      height: state.height,
      lineCount: usePaintedPoints ? state.paintedPoints.length : state.lineCount,
      seed: state.seed,
      stepLength: state.stepLength,
      maxSteps: state.maxSteps,
      margin: state.margin,
      minLineLength: state.minLineLength,
      noiseScale: state.noiseScale,
      octaves: state.octaves,
      persistence: state.persistence,
      lacunarity: state.lacunarity,
      fieldMode: state.fieldMode,
      smoothing: state.smoothing,
      spiralStrength: state.spiralStrength,
      warpStrength: state.warpStrength,
      separationDistance: state.separationDistance,
      bidirectional: state.bidirectional,
      evenDistribution: state.evenDistribution,
      fillMode: state.fillMode,
      densityPoints: state.densityPoints,
      densityVariation: state.variableDensity ? state.densityVariation : 0,
      minSeparation: state.minSeparation,
      organicWobble: state.organicWobble,
      velocityFadeout: state.velocityFadeout,
      edgeAttraction: state.edgeAttraction,
      ...(usePaintedPoints && { startPoints: state.paintedPoints }),
      ...(state.attractors.length > 0 && { attractors: state.attractors }),
    };

    const svgOptions: SVGOptions = {
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
    };

    const result = generateFlowLines(flowOptions);
    return toSVG(result, svgOptions);
  }, [state]);

  const downloadSVG = useCallback(() => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-lines-${state.seed}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svgContent, state.seed]);

  const isInteractive = state.paintMode || state.attractorMode || state.densityMode;

  return (
    <div className="app">
      <Preview
        svgContent={svgContent}
        width={state.width}
        height={state.height}
        paintMode={state.paintMode}
        paintedPoints={state.paintedPoints}
        showDots={state.showDots}
        onPaint={addPaintedPoint}
        attractorMode={state.attractorMode}
        attractors={state.attractors}
        showAttractors={state.showAttractors}
        onAddAttractor={addAttractor}
        densityMode={state.densityMode}
        densityPoints={state.densityPoints}
        showDensityPoints={state.showDensityPoints}
        onAddDensityPoint={addDensityPoint}
      />

      {/* Paint/Attractor/Density controls bar - shows when in interactive mode */}
      {isInteractive && (
        <PaintControls
          state={state}
          updateState={updateState}
          onClearPoints={clearPaintedPoints}
          onClearAttractors={clearAttractors}
          onClearDensityPoints={clearDensityPoints}
        />
      )}

      {/* Bottom toolbar */}
      <Toolbar
        onRandomize={randomizeAll}
        onDownload={downloadSVG}
        onTogglePaint={togglePaintMode}
        onToggleAttractor={toggleAttractorMode}
        onToggleDensity={toggleDensityMode}
        onOpenSettings={() => setSheetOpen(true)}
        paintMode={state.paintMode}
        attractorMode={state.attractorMode}
        densityMode={state.densityMode}
      />

      {/* Settings sheet */}
      <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Controls state={state} updateState={updateState} />
      </Sheet>
    </div>
  );
}
