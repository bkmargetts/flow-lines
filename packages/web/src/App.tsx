import { useState, useCallback, useMemo } from 'react';
import { generateFlowLines, toSVG, type FlowLinesOptions, type SVGOptions, type Point } from '@flow-lines/core';
import { Controls } from './components/Controls';
import { Preview } from './components/Preview';

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
};

export function App() {
  const [state, setState] = useState<AppState>(defaultState);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const togglePaintMode = useCallback(() => {
    updateState({ paintMode: !state.paintMode });
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

  const svgContent = useMemo(() => {
    const usePaintedPoints = state.paintMode && state.paintedPoints.length > 0;

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

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Flow Lines</h1>
        <p className="subtitle">Generative Art for Pen Plotters</p>

        <Controls
          state={state}
          updateState={updateState}
          randomizeSeed={randomizeSeed}
          downloadSVG={downloadSVG}
          togglePaintMode={togglePaintMode}
          clearPaintedPoints={clearPaintedPoints}
        />
      </aside>

      <main className="canvas-container">
        <Preview
          svgContent={svgContent}
          width={state.width}
          height={state.height}
          paintMode={state.paintMode}
          paintedPoints={state.paintedPoints}
          onPaint={addPaintedPoint}
        />
      </main>
    </div>
  );
}
