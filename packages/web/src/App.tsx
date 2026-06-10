import { useState, useCallback, useMemo } from 'react';
import {
  generateFlowLines,
  grayscaleFromRGBA,
  imageToPenInk,
  toSVG,
  type FlowLinesOptions,
  type GrayscaleImage,
  type SVGOptions,
  type Point,
} from '@flow-lines/core';
import { Controls } from './components/Controls';
import { ImageControls } from './components/ImageControls';
import { Preview } from './components/Preview';

export type Mode = 'flow' | 'image';

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
}

export interface InkSettings {
  width: number;
  margin: number;
  seed: number;
  layers: number;
  minSpacing: number;
  maxSpacing: number;
  whiteCutoff: number;
  hatchAngle: number;
  followTone: boolean;
  drawOutlines: boolean;
  wobble: number;
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
  paintMode: false,
  paintedPoints: [],
  showDots: true,
};

const defaultInkSettings: InkSettings = {
  width: 600,
  margin: 20,
  seed: Math.floor(Math.random() * 1000000),
  layers: 3,
  minSpacing: 2.5,
  maxSpacing: 14,
  whiteCutoff: 0.08,
  hatchAngle: -45,
  followTone: true,
  drawOutlines: true,
  wobble: 0.8,
  strokeColor: '#000000',
  strokeWidth: 1,
};

/** Decode an image file into grayscale pixel data via an offscreen canvas */
function loadImageFile(file: File): Promise<GrayscaleImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const maxDim = 1024;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      resolve(grayscaleFromRGBA(imageData.data, width, height));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };

    img.src = url;
  });
}

export function App() {
  const [mode, setMode] = useState<Mode>('flow');
  const [state, setState] = useState<AppState>(defaultState);
  const [inkSettings, setInkSettings] = useState<InkSettings>(defaultInkSettings);
  const [sourceImage, setSourceImage] = useState<GrayscaleImage | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateInkSettings = useCallback((updates: Partial<InkSettings>) => {
    setInkSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    const seed = Math.floor(Math.random() * 1000000);
    if (mode === 'image') {
      updateInkSettings({ seed });
    } else {
      updateState({ seed });
    }
  }, [mode, updateState, updateInkSettings]);

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

  const handleImageFile = useCallback((file: File) => {
    loadImageFile(file)
      .then((image) => {
        setSourceImage(image);
        setImageName(file.name);
      })
      .catch(() => {
        setImageName(null);
        setSourceImage(null);
      });
  }, []);

  const generated = useMemo(() => {
    if (mode === 'image') {
      if (!sourceImage) {
        return { svg: '', width: inkSettings.width, height: inkSettings.width };
      }

      const result = imageToPenInk(sourceImage, {
        width: inkSettings.width,
        margin: inkSettings.margin,
        seed: inkSettings.seed,
        layers: inkSettings.layers,
        minSpacing: inkSettings.minSpacing,
        maxSpacing: inkSettings.maxSpacing,
        whiteCutoff: inkSettings.whiteCutoff,
        hatchAngle: inkSettings.hatchAngle,
        followTone: inkSettings.followTone,
        drawOutlines: inkSettings.drawOutlines,
        wobble: inkSettings.wobble,
      });

      const svg = toSVG(result, {
        strokeColor: inkSettings.strokeColor,
        strokeWidth: inkSettings.strokeWidth,
      });

      return { svg, width: result.width, height: result.height };
    }

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
    return { svg: toSVG(result, svgOptions), width: state.width, height: state.height };
  }, [mode, state, inkSettings, sourceImage]);

  const downloadSVG = useCallback(() => {
    if (!generated.svg) return;

    const blob = new Blob([generated.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      mode === 'image' ? `pen-ink-${inkSettings.seed}.svg` : `flow-lines-${state.seed}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generated.svg, mode, state.seed, inkSettings.seed]);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Flow Lines</h1>
        <p className="subtitle">Generative Art for Pen Plotters</p>

        <div className="mode-tabs">
          <button
            type="button"
            className={mode === 'flow' ? 'active' : ''}
            onClick={() => setMode('flow')}
          >
            Flow Field
          </button>
          <button
            type="button"
            className={mode === 'image' ? 'active' : ''}
            onClick={() => setMode('image')}
          >
            Image → Ink
          </button>
        </div>

        {mode === 'image' ? (
          <ImageControls
            settings={inkSettings}
            imageName={imageName}
            updateSettings={updateInkSettings}
            onImageFile={handleImageFile}
            randomizeSeed={randomizeSeed}
            downloadSVG={downloadSVG}
          />
        ) : (
          <Controls
            state={state}
            updateState={updateState}
            randomizeSeed={randomizeSeed}
            downloadSVG={downloadSVG}
            togglePaintMode={togglePaintMode}
            clearPaintedPoints={clearPaintedPoints}
          />
        )}
      </aside>

      <main className="canvas-container">
        {mode === 'image' && !sourceImage ? (
          <div className="empty-state">
            <p>Upload an image to render it as pen-and-ink strokes.</p>
          </div>
        ) : (
          <Preview
            svgContent={generated.svg}
            width={generated.width}
            height={generated.height}
            paintMode={mode === 'flow' && state.paintMode}
            paintedPoints={mode === 'flow' ? state.paintedPoints : []}
            showDots={state.showDots}
            onPaint={addPaintedPoint}
          />
        )}
      </main>
    </div>
  );
}
