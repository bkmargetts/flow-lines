import { useState, useCallback, useMemo } from 'react';
import { generateFlowLines, toSVG, type FlowLinesOptions, type SVGOptions, type Point, type Attractor } from '@flow-lines/core';
import { Preview } from './components/Preview';
import { Toolbar } from './components/Toolbar';
import { Sheet } from './components/Sheet';
import { Controls } from './components/Controls';
import { PaintControls } from './components/PaintControls';

export type BrushType = 'attractor' | 'repeller';

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
}

// Calculate initial canvas size based on viewport
function getInitialCanvasSize(): { width: number; height: number } {
  const padding = 120; // Space for toolbar and margins
  const maxWidth = Math.min(window.innerWidth - 32, 1200);
  const maxHeight = Math.min(window.innerHeight - padding, 1200);

  // Round to nearest 50 for cleaner values
  const width = Math.round(maxWidth / 50) * 50;
  const height = Math.round(maxHeight / 50) * 50;

  return { width: Math.max(width, 300), height: Math.max(height, 300) };
}

const initialSize = getInitialCanvasSize();

const defaultState: AppState = {
  width: initialSize.width,
  height: initialSize.height,
  lineCount: 100,
  seed: Math.floor(Math.random() * 1000000),
  stepLength: 2,
  maxSteps: 500,
  margin: 20,
  minLineLength: 10,
  noiseScale: 0.005,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  strokeColor: '#000000',
  strokeWidth: 1,
  paintMode: false,
  paintedPoints: [],
  showDots: true,
  attractorMode: false,
  attractors: [],
  attractorBrushType: 'attractor',
  attractorRadius: 50,
  attractorStrength: 1.0,
  showAttractors: true,
};

export function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [sheetOpen, setSheetOpen] = useState(false);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const togglePaintMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      paintMode: !prev.paintMode,
      attractorMode: false,
    }));
  }, []);

  const toggleAttractorMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      attractorMode: !prev.attractorMode,
      paintMode: false,
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

  const isInteractive = state.paintMode || state.attractorMode;

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
      />

      {/* Paint/Attractor controls bar - shows when in interactive mode */}
      {isInteractive && (
        <PaintControls
          state={state}
          updateState={updateState}
          onClearPoints={clearPaintedPoints}
          onClearAttractors={clearAttractors}
        />
      )}

      {/* Bottom toolbar */}
      <Toolbar
        onRandomize={randomizeSeed}
        onDownload={downloadSVG}
        onTogglePaint={togglePaintMode}
        onToggleAttractor={toggleAttractorMode}
        onOpenSettings={() => setSheetOpen(true)}
        paintMode={state.paintMode}
        attractorMode={state.attractorMode}
      />

      {/* Settings sheet */}
      <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Controls state={state} updateState={updateState} />
      </Sheet>
    </div>
  );
}
