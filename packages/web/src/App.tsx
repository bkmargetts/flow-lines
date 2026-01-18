import { useState, useCallback, useMemo } from 'react';
import { generateFlowLines, toSVG, type FlowLinesOptions, type SVGOptions } from '@flow-lines/core';
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
};

export function App() {
  const [state, setState] = useState<AppState>(defaultState);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    updateState({ seed: Math.floor(Math.random() * 1000000) });
  }, [updateState]);

  const svgContent = useMemo(() => {
    const flowOptions: FlowLinesOptions = {
      width: state.width,
      height: state.height,
      lineCount: state.lineCount,
      seed: state.seed,
      stepLength: state.stepLength,
      maxSteps: state.maxSteps,
      margin: state.margin,
      minLineLength: state.minLineLength,
      noiseScale: state.noiseScale,
      octaves: state.octaves,
      persistence: state.persistence,
      lacunarity: state.lacunarity,
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
        />
      </aside>

      <main className="canvas-container">
        <Preview svgContent={svgContent} width={state.width} height={state.height} />
      </main>
    </div>
  );
}
