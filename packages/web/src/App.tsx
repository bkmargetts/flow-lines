import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  generateFlowLines,
  grayscaleFromRGBA,
  toSVG,
  type FlowLinesOptions,
  type GrayscaleImage,
  type PortraitOptions,
  type SVGOptions,
  type Point,
} from '@flow-lines/core';
import { Controls } from './components/Controls';
import { ImageControls, PRESETS } from './components/ImageControls';
import { Preview } from './components/Preview';
import { getRenderClient, type RenderedSVG } from './render-client';

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
  contourHalo: number;
  wobble: number;
  strokeColor: string;
  strokeWidth: number;
  detailEmphasis: number;
  focusRadiusPct: number;
  focusStrength: number;
  maskStrength: number;
  toneGamma: number;
  valueBands: number;
  hatchPatchiness: number;
  workingSize: number;
  skinLightening: number;
  featureLines: boolean;
  textureStrokes: number;
  textureStyle: 'ticks' | 'stipple' | 'scribble';
  skyStipple: boolean;
  calmWater: boolean;
  richBlacks: boolean;
  counterchange: number;
  crossContour: boolean;
  facetHatch: boolean;
  maxStrokeLength: number;
  fieldSmoothing: number;
  formStrength: number;
  depthIsolation: number;
  autoStyle: boolean;
}

/** Tight-memory devices get smaller renders */
const IS_MOBILE =
  typeof navigator !== 'undefined' && /iP(hone|ad|od)|Android/.test(navigator.userAgent);

/** Crash breadcrumb: set while a depth result is being applied; if it is
 * still there on startup, the page died mid-apply — drop to low memory */
const APPLY_FLAG = 'fl-applying-depth';
const LOW_MEM_FLAG = 'fl-low-memory';

function detectLowMemory(): boolean {
  if (typeof localStorage === 'undefined') return false;
  if (localStorage.getItem(APPLY_FLAG)) {
    localStorage.removeItem(APPLY_FLAG);
    localStorage.setItem(LOW_MEM_FLAG, '1');
  }
  return localStorage.getItem(LOW_MEM_FLAG) === '1';
}

export type SegmentStatus = 'idle' | 'loading' | 'error';
export type PortraitStatus = 'idle' | 'loading' | 'error' | 'none';
export type DepthStatus = 'idle' | 'loading' | 'error';

export interface PortraitState {
  faceCount: number;
  portrait: Pick<PortraitOptions, 'faceOvals' | 'featureRegions' | 'featureStrokes'>;
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
  contourHalo: 2.2,
  wobble: 0.8,
  strokeColor: '#000000',
  strokeWidth: 1,
  detailEmphasis: 0.3,
  focusRadiusPct: 25,
  focusStrength: 0.85,
  maskStrength: 1,
  toneGamma: 1.3,
  valueBands: 4,
  hatchPatchiness: 0.35,
  workingSize: 600,
  skinLightening: 0.55,
  featureLines: true,
  textureStrokes: 0.6,
  textureStyle: 'ticks',
  skyStipple: false,
  calmWater: false,
  richBlacks: true,
  counterchange: 0.5,
  crossContour: false,
  facetHatch: false,
  maxStrokeLength: 0,
  fieldSmoothing: 4,
  formStrength: 0.8,
  depthIsolation: 0.5,
  autoStyle: true,
};

/**
 * Decode an image file via an offscreen canvas. Returns grayscale pixel
 * data for rendering plus the RGBA canvas for ML segmentation.
 */
function loadImageFile(
  file: File
): Promise<{ gray: GrayscaleImage; canvas: HTMLCanvasElement }> {
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
      resolve({ gray: grayscaleFromRGBA(imageData.data, width, height), canvas });
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

  // Subject isolation state. Focus points are stored normalized (0-1)
  // so they survive output width changes.
  const [focusPoints, setFocusPoints] = useState<Point[]>([]);
  const [subjectMask, setSubjectMask] = useState<GrayscaleImage | null>(null);
  const [segmentStatus, setSegmentStatus] = useState<SegmentStatus>('idle');
  const [portraitState, setPortraitState] = useState<PortraitState | null>(null);
  const [portraitStatus, setPortraitStatus] = useState<PortraitStatus>('idle');
  const [depthMap, setDepthMap] = useState<GrayscaleImage | null>(null);
  const [depthStatus, setDepthStatus] = useState<DepthStatus>('idle');
  const [depthError, setDepthError] = useState<string | null>(null);
  const [preset, setPreset] = useState('classic');
  const [lowMemory, setLowMemory] = useState(detectLowMemory);
  const [inkRender, setInkRender] = useState<RenderedSVG | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tokens discard results of superseded async AI runs
  const segmentTokenRef = useRef(0);
  const portraitTokenRef = useRef(0);
  const depthTokenRef = useRef(0);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateInkSettings = useCallback((updates: Partial<InkSettings>) => {
    setInkSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    const seed = Math.floor(Math.random() * 1000000);
    if (mode === 'image') {
      // Surprise me: a new seed barely changes the look, so the dice also
      // rolls the artistic levers within tasteful ranges
      const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
      const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

      updateInkSettings({
        seed,
        hatchAngle: Math.round(r(-90, 90) / 5) * 5,
        wobble: Math.round(r(0.3, 2.2) * 10) / 10,
        layers: pick([2, 2, 3, 3, 4]),
        minSpacing: Math.round(r(2, 3.5) * 10) / 10,
        maxSpacing: Math.round(r(10, 22)),
        toneGamma: Math.round(r(1.1, 1.9) * 20) / 20,
        textureStrokes: Math.round(r(0.2, 1) * 20) / 20,
        textureStyle: pick(['ticks', 'ticks', 'ticks', 'stipple', 'scribble']),
        crossContour: Math.random() < 0.2,
        skyStipple: Math.random() < 0.3,
        maxStrokeLength: pick([0, 0, 40, 60, 80]),
        detailEmphasis: Math.round(r(0.2, 0.5) * 20) / 20,
      });
      setPreset('');
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

  const detectFaces = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    const token = ++portraitTokenRef.current;
    setPortraitStatus('loading');
    import('./face-landmarks')
      .then(({ detectPortrait }) => detectPortrait(canvas))
      .then((detected) => {
        if (token !== portraitTokenRef.current) return;
        setPortraitState(detected);
        setPortraitStatus(detected ? 'idle' : 'none');
      })
      .catch(() => {
        if (token !== portraitTokenRef.current) return;
        setPortraitState(null);
        setPortraitStatus('error');
      });
  }, []);

  const estimateDepthMap = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    const token = ++depthTokenRef.current;
    setDepthStatus('loading');
    setDepthError(null);
    import('./depth-client')
      .then(({ estimateDepthInWorker }) => estimateDepthInWorker(canvas))
      .then((depth) => {
        if (token !== depthTokenRef.current) return;
        // Breadcrumb: if the page dies while the heavier depth render is
        // applied, the next visit detects it and enters low-memory mode
        localStorage.setItem(APPLY_FLAG, '1');
        // Let the depth worker teardown and GC settle before the render
        setTimeout(() => {
          if (token !== depthTokenRef.current) return;
          setDepthMap(depth);
          setDepthStatus('idle');
        }, 300);
      })
      .catch((err) => {
        if (token !== depthTokenRef.current) return;
        setDepthMap(null);
        setDepthStatus('error');
        setDepthError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const clearDepth = useCallback(() => {
    depthTokenRef.current++;
    setDepthMap(null);
    setDepthStatus('idle');
    setDepthError(null);
  }, []);

  const runIsolation = useCallback((points: Point[]) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || points.length === 0) return;

    const token = ++segmentTokenRef.current;
    setSegmentStatus('loading');
    import('./segmentation')
      .then(async ({ isolateSubjectAt }) => {
        // One segmentation per focus point, unioned into a single mask
        let union: GrayscaleImage | null = null;
        for (const point of points) {
          const mask = await isolateSubjectAt(canvas, point.x, point.y);
          if (!union) {
            union = mask;
          } else if (union.width === mask.width && union.height === mask.height) {
            for (let i = 0; i < union.data.length; i++) {
              union.data[i] = Math.max(union.data[i], mask.data[i]);
            }
          }
        }
        return union;
      })
      .then((mask) => {
        if (token !== segmentTokenRef.current) return;
        setSubjectMask(mask);
        setSegmentStatus('idle');
      })
      .catch(() => {
        if (token !== segmentTokenRef.current) return;
        setSubjectMask(null);
        setSegmentStatus('error');
      });
  }, []);

  const handleImageFile = useCallback(
    (file: File) => {
      loadImageFile(file)
        .then(({ gray, canvas }) => {
          setSourceImage(gray);
          setImageName(file.name);
          sourceCanvasRef.current = canvas;
          // Focus, mask and faces belong to the previous image
          setFocusPoints([]);
          setSubjectMask(null);
          setSegmentStatus('idle');
          setPortraitState(null);
          setPortraitStatus('idle');
          setDepthMap(null);
          setDepthStatus('idle');
          // Effortless portraits: look for faces as soon as a photo lands
          detectFaces();
          // 3D form needs the depth model (~25MB on first use); run it
          // automatically only where WebGPU makes it fast
          if ('gpu' in navigator) {
            estimateDepthMap();
          }
        })
        .catch(() => {
          setImageName(null);
          setSourceImage(null);
          sourceCanvasRef.current = null;
        });
    },
    [detectFaces, estimateDepthMap]
  );

  const handleSetFocus = useCallback(
    (normalized: Point) => {
      // Every tap adds a subject and re-runs isolation over all of them
      setFocusPoints((prev) => {
        const next = [...prev, normalized];
        runIsolation(next);
        return next;
      });
    },
    [runIsolation]
  );

  const clearFocus = useCallback(() => {
    segmentTokenRef.current++;
    setFocusPoints([]);
    setSubjectMask(null);
    setSegmentStatus('idle');
  }, []);

  const isolateSubject = useCallback(() => {
    runIsolation(focusPoints);
  }, [runIsolation, focusPoints]);

  const applyPreset = useCallback(
    (name: string) => {
      const def = PRESETS[name];
      if (!def) return;
      setPreset(name);
      updateInkSettings(def.settings);
    },
    [updateInkSettings]
  );

  // Pen-ink rendering runs in a Web Worker so sliders and AI updates
  // never freeze the UI; the previous frame stays visible while the next
  // one computes (latest-wins queue drops intermediate slider positions)
  useEffect(() => {
    if (mode !== 'image' || !sourceImage) return;

    // Memory budget: dense depth renders have killed pages on phones
    const cap = lowMemory ? 420 : IS_MOBILE ? 520 : Infinity;
    const jobWidth = Math.min(inkSettings.width, cap);

    const outputHeight = Math.max(
      1,
      Math.round((jobWidth * sourceImage.height) / sourceImage.width)
    );

    setIsRendering(true);
    getRenderClient()
      .render(
        sourceImage,
        {
          width: jobWidth,
          margin: inkSettings.margin,
          seed: inkSettings.seed,
          minSpacing: inkSettings.minSpacing,
          maxSpacing: inkSettings.maxSpacing,
          whiteCutoff: inkSettings.whiteCutoff,
          hatchAngle: inkSettings.hatchAngle,
          followTone: inkSettings.followTone,
          drawOutlines: inkSettings.drawOutlines,
          contourHalo: inkSettings.contourHalo,
          wobble: inkSettings.wobble,
          textureStrokes: inkSettings.textureStrokes,
          textureStyle: inkSettings.textureStyle,
          skyStipple: inkSettings.skyStipple,
          calmWater: inkSettings.calmWater,
          crossContour: inkSettings.crossContour,
          facetHatch: inkSettings.facetHatch,
          maxStrokeLength: inkSettings.maxStrokeLength,
          fieldSmoothing: inkSettings.fieldSmoothing,
          depthMap: depthMap ?? undefined,
          formStrength: inkSettings.formStrength,
          depthIsolation: inkSettings.depthIsolation,
          autoStyle: inkSettings.autoStyle,
          detailEmphasis: inkSettings.detailEmphasis,
          toneGamma: inkSettings.toneGamma,
          valueBands: inkSettings.valueBands,
          hatchPatchiness: inkSettings.hatchPatchiness,
          workingSize: Math.min(inkSettings.workingSize, cap),
          layers: lowMemory ? Math.min(2, inkSettings.layers) : inkSettings.layers,
          richBlacks: lowMemory ? false : inkSettings.richBlacks,
          counterchange: inkSettings.counterchange,
          focus: focusPoints.map((point) => ({
            x: point.x * jobWidth,
            y: point.y * outputHeight,
            radius:
              (inkSettings.focusRadiusPct / 100) * Math.min(jobWidth, outputHeight),
            strength: inkSettings.focusStrength,
          })),
          subjectMask: subjectMask ?? undefined,
          maskStrength: inkSettings.maskStrength,
          portrait: portraitState
            ? {
                ...portraitState.portrait,
                featureStrokes: inkSettings.featureLines
                  ? portraitState.portrait.featureStrokes
                  : undefined,
                skinLightening: inkSettings.skinLightening,
              }
            : undefined,
        },
        {
          strokeColor: inkSettings.strokeColor,
          strokeWidth: inkSettings.strokeWidth,
        }
      )
      .then((rendered) => {
        // Survived the apply — clear the crash breadcrumb
        localStorage.removeItem(APPLY_FLAG);
        setInkRender(rendered);
        setIsRendering(false);
      })
      .catch((err: Error) => {
        // Superseded renders are expected during rapid slider changes
        if (err.message !== 'superseded') {
          setIsRendering(false);
        }
      });
  }, [mode, sourceImage, inkSettings, focusPoints, subjectMask, portraitState, depthMap, lowMemory]);

  const generated = useMemo(() => {
    if (mode === 'image') {
      if (!sourceImage || !inkRender) {
        return { svg: '', width: inkSettings.width, height: inkSettings.width };
      }
      return inkRender;
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
  }, [mode, state, sourceImage, inkRender, inkSettings.width]);

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
            preset={preset}
            applyPreset={applyPreset}
            updateSettings={updateInkSettings}
            onImageFile={handleImageFile}
            randomizeSeed={randomizeSeed}
            downloadSVG={downloadSVG}
            focusPoints={focusPoints}
            clearFocus={clearFocus}
            subjectMask={subjectMask}
            segmentStatus={segmentStatus}
            isolateSubject={isolateSubject}
            clearSubjectMask={() => setSubjectMask(null)}
            portraitState={portraitState}
            portraitStatus={portraitStatus}
            detectFaces={detectFaces}
            depthMap={depthMap}
            depthStatus={depthStatus}
            depthError={depthError}
            lowMemory={lowMemory}
            disableLowMemory={() => {
              localStorage.removeItem(LOW_MEM_FLAG);
              setLowMemory(false);
            }}
            estimateDepthMap={estimateDepthMap}
            clearDepth={clearDepth}
            clearPortrait={() => {
              portraitTokenRef.current++;
              setPortraitState(null);
              setPortraitStatus('idle');
            }}
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
        {mode === 'image' && isRendering && <div className="rendering-badge">Rendering…</div>}
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
            focusSelectMode={mode === 'image' && !!sourceImage}
            focusMarkers={
              mode === 'image'
                ? focusPoints.map((point) => ({
                    x: point.x * generated.width,
                    y: point.y * generated.height,
                    radius:
                      (inkSettings.focusRadiusPct / 100) *
                      Math.min(generated.width, generated.height),
                  }))
                : []
            }
            onSetFocus={(point) =>
              handleSetFocus({ x: point.x / generated.width, y: point.y / generated.height })
            }
          />
        )}
      </main>
    </div>
  );
}
