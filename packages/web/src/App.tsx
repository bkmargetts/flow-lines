import { useState, useCallback, useMemo } from 'react';
import { generateFlowLines, toSVG, type FlowLinesOptions, type SVGOptions, type Point, type Attractor } from '@flow-lines/core';
import { Controls } from './components/Controls';
import { Preview } from './components/Preview';
import { ControlPanel } from './components/ControlPanel';

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
  // Attractor state
  attractorMode: boolean;
  attractors: Attractor[];
  attractorBrushType: BrushType;
  attractorRadius: number;
  attractorStrength: number;
  showAttractors: boolean;
}

const defaultState: AppState = {
  width: 600,
  height: 600,
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
  // Attractor defaults
  attractorMode: false,
  attractors: [],
  attractorBrushType: 'attractor',
  attractorRadius: 50,
  attractorStrength: 1.0,
  showAttractors: true,
};

export function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [panelOpen, setPanelOpen] = useState(false);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const togglePaintMode = useCallback(() => {
    updateState({
      paintMode: !state.paintMode,
      attractorMode: false,
    });
  }, [state.paintMode, updateState]);

  const clearPaintedPoints = useCallback(() => {
    updateState({ paintedPoints: [] });
  }, [updateState]);

  const addPaintedPoint = useCallback((point: Point) => {
    setState((prev) => ({
      ...prev,
      paintedPoints: [...prev.paintedPoints, point],
    }));
  }, []);

  const toggleAttractorMode = useCallback(() => {
    updateState({
      attractorMode: !state.attractorMode,
      paintMode: false,
    });
  }, [state.attractorMode, updateState]);

  const addAttractor = useCallback((x: number, y: number) => {
    const strength = state.attractorBrushType === 'attractor'
      ? state.attractorStrength
      : -state.attractorStrength;

    const newAttractor: Attractor = {
      x,
      y,
      radius: state.attractorRadius,
      strength,
    };

    setState((prev) => ({
      ...prev,
      attractors: [...prev.attractors, newAttractor],
    }));
  }, [state.attractorBrushType, state.attractorRadius, state.attractorStrength]);

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

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

  return (
    <div className={`app ${panelOpen ? 'panel-open' : ''}`}>
      <ControlPanel isOpen={panelOpen} onToggle={togglePanel}>
        <Controls
          state={state}
          updateState={updateState}
          randomizeSeed={randomizeSeed}
          downloadSVG={downloadSVG}
          togglePaintMode={togglePaintMode}
          clearPaintedPoints={clearPaintedPoints}
          toggleAttractorMode={toggleAttractorMode}
          clearAttractors={clearAttractors}
        />
      </ControlPanel>

      <main className="canvas-container">
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
      </main>
    </div>
  );
}
