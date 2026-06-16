import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  grayscaleFromRGBA,
  pageMetrics,
  contentRect,
  getPaperSize,
  type GrayscaleImage,
  type LabelImage,
  type Point,
} from '@flow-lines/core';
import { getRenderClient, type RenderedSVG } from '../../render-client';
import { useFrame } from '../../FrameContext';
import { usePostProcess } from '../../PostProcessContext';
import { useOutput } from '../../OutputContext';
import { textureOptionsFor } from '../../lib/texture';
import {
  defaultInkSettings,
  PRESETS,
  type InkSettings,
  type SegmentStatus,
  type PortraitStatus,
  type DepthStatus,
  type LabelStatus,
  type PortraitState,
} from './types';

/** Tight-memory devices get smaller renders */
const IS_MOBILE =
  typeof navigator !== 'undefined' && /iP(hone|ad|od)|Android/.test(navigator.userAgent);

/** Crash breadcrumbs: set while a depth result is being applied or scene
 * labeling is running; if one is still there on startup, the page died
 * mid-job — drop to low memory */
const APPLY_FLAG = 'fl-applying-depth';
const LABELING_FLAG = 'fl-labeling';
const LOW_MEM_FLAG = 'fl-low-memory';

function detectLowMemory(): boolean {
  if (typeof localStorage === 'undefined') return false;
  if (localStorage.getItem(APPLY_FLAG) || localStorage.getItem(LABELING_FLAG)) {
    localStorage.removeItem(APPLY_FLAG);
    localStorage.removeItem(LABELING_FLAG);
    localStorage.setItem(LOW_MEM_FLAG, '1');
  }
  return localStorage.getItem(LOW_MEM_FLAG) === '1';
}

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

type InkLayout = {
  page: ReturnType<typeof pageMetrics>;
  rect: ReturnType<typeof contentRect>;
  contentW: number;
  contentH: number;
};

interface ImageInkValue {
  settings: InkSettings;
  updateSettings: (updates: Partial<InkSettings>) => void;
  imageName: string | null;
  preset: string;
  applyPreset: (name: string) => void;
  onImageFile: (file: File) => void;
  randomizeSeed: () => void;
  sourceImage: GrayscaleImage | null;
  isRendering: boolean;
  inkLayout: InkLayout | null;
  generated: { svg: string; width: number; height: number };
  focusPoints: Point[];
  setFocus: (normalized: Point) => void;
  clearFocus: () => void;
  subjectMask: GrayscaleImage | null;
  segmentStatus: SegmentStatus;
  isolateSubject: () => void;
  clearSubjectMask: () => void;
  portraitState: PortraitState | null;
  portraitStatus: PortraitStatus;
  detectFaces: () => void;
  clearPortrait: () => void;
  depthMap: GrayscaleImage | null;
  depthStatus: DepthStatus;
  depthError: string | null;
  estimateDepthMap: () => void;
  clearDepth: () => void;
  labelMap: LabelImage | null;
  labelStatus: LabelStatus;
  labelError: string | null;
  estimateSceneLabels: () => void;
  clearLabels: () => void;
  lowMemory: boolean;
  disableLowMemory: () => void;
}

const ImageInkContext = createContext<ImageInkValue | null>(null);

export function ImageInkProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { frame } = useFrame();
  const { post } = usePostProcess();
  const { register } = useOutput();
  const [settings, setSettings] = useState<InkSettings>(defaultInkSettings);
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
  const [labelMap, setLabelMap] = useState<LabelImage | null>(null);
  const [labelStatus, setLabelStatus] = useState<LabelStatus>('idle');
  const [labelError, setLabelError] = useState<string | null>(null);
  const [preset, setPreset] = useState('classic');
  const [lowMemory, setLowMemory] = useState(detectLowMemory);
  const [inkRender, setInkRender] = useState<RenderedSVG | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tokens discard results of superseded async AI runs
  const segmentTokenRef = useRef(0);
  const portraitTokenRef = useRef(0);
  const depthTokenRef = useRef(0);
  const labelTokenRef = useRef(0);
  // Auto-ML staggering: set on upload, consumed once the first render
  // has been seen to start and finish
  const autoMlPendingRef = useRef(false);
  const renderSeenRef = useRef(false);

  const updateSettings = useCallback((updates: Partial<InkSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const randomizeSeed = useCallback(() => {
    const seed = Math.floor(Math.random() * 1000000);
    // Surprise me: a new seed barely changes the look, so the dice also
    // rolls the artistic levers within tasteful ranges
    const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

    updateSettings({
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
  }, [updateSettings]);

  const detectFaces = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    const token = ++portraitTokenRef.current;
    setPortraitStatus('loading');
    import('../../face-landmarks')
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

  // Resolves when the depth worker has finished and been torn down (even
  // on failure), so other model runs can be sequenced behind it — phones
  // can't afford two resident models at once
  const estimateDepthMap = useCallback((): Promise<void> => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return Promise.resolve();

    const token = ++depthTokenRef.current;
    setDepthStatus('loading');
    setDepthError(null);
    return import('../../depth-client')
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

  // Resolves when the labels worker has finished and been torn down (even
  // on failure), so the heavier depth job can be sequenced behind it
  const estimateSceneLabels = useCallback((): Promise<void> => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return Promise.resolve();

    const token = ++labelTokenRef.current;
    setLabelStatus('loading');
    setLabelError(null);
    // Breadcrumb: if the page dies during inference, the next visit
    // detects it, enters low-memory mode, and stops auto-running labels
    localStorage.setItem(LABELING_FLAG, '1');
    return import('../../labels-client')
      .then(({ estimateLabelsInWorker }) => estimateLabelsInWorker(canvas))
      .then((labels) => {
        localStorage.removeItem(LABELING_FLAG);
        if (token !== labelTokenRef.current) return;
        setLabelMap(labels);
        setLabelStatus('idle');
      })
      .catch((err) => {
        localStorage.removeItem(LABELING_FLAG);
        if (token !== labelTokenRef.current) return;
        setLabelMap(null);
        setLabelStatus('error');
        setLabelError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const clearLabels = useCallback(() => {
    labelTokenRef.current++;
    setLabelMap(null);
    setLabelStatus('idle');
    setLabelError(null);
  }, []);

  const runIsolation = useCallback((points: Point[]) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || points.length === 0) return;

    const token = ++segmentTokenRef.current;
    setSegmentStatus('loading');
    import('../../segmentation')
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

  const onImageFile = useCallback(
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
          setLabelMap(null);
          setLabelStatus('idle');
          setLabelError(null);
          // Effortless portraits: look for faces as soon as a photo lands
          detectFaces();
          // Heavier ML (scene labels, then depth) is deferred until the
          // first render completes — see the auto-ML effect below
          autoMlPendingRef.current = true;
          renderSeenRef.current = false;
        })
        .catch(() => {
          setImageName(null);
          setSourceImage(null);
          sourceCanvasRef.current = null;
        });
    },
    [detectFaces]
  );

  const setFocus = useCallback(
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
      updateSettings(def.settings);
    },
    [updateSettings]
  );

  const clearSubjectMask = useCallback(() => setSubjectMask(null), []);

  const clearPortrait = useCallback(() => {
    portraitTokenRef.current++;
    setPortraitState(null);
    setPortraitStatus('idle');
  }, []);

  const disableLowMemory = useCallback(() => {
    localStorage.removeItem(LOW_MEM_FLAG);
    setLowMemory(false);
  }, []);

  // The chosen sheet resolved to a concrete pixel page plus the rectangle the
  // photo occupies on it (letterbox 'fit' or centred 'fill'). Shared by the
  // render effect and the focus overlay so taps land on the photo, not the
  // paper border. The long-edge cap is the phone/low-memory budget.
  const inkLayout = useMemo<InkLayout | null>(() => {
    if (!sourceImage) return null;
    const capPx = lowMemory ? 420 : IS_MOBILE ? 520 : undefined;
    const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution, capPx);
    const marginPx = frame.marginMm * page.pxPerMm;
    const imgAspect = sourceImage.width / sourceImage.height;
    const rect = contentRect(page.widthPx, page.heightPx, marginPx, imgAspect, frame.fit);
    return {
      page,
      rect,
      contentW: Math.max(1, Math.round(rect.width)),
      contentH: Math.max(1, Math.round(rect.height)),
    };
  }, [
    sourceImage,
    frame.paper,
    frame.orientation,
    frame.fit,
    frame.marginMm,
    frame.resolution,
    lowMemory,
  ]);

  // Pen-ink rendering runs in a Web Worker so sliders and AI updates
  // never freeze the UI; the previous frame stays visible while the next
  // one computes (latest-wins queue drops intermediate slider positions)
  useEffect(() => {
    if (!active || !sourceImage || !inkLayout) return;

    const { page, rect, contentW, contentH } = inkLayout;
    // Detail raster still gets the phone/low-memory cap on its own axis
    const wsCap = lowMemory ? 420 : IS_MOBILE ? 520 : Infinity;

    setIsRendering(true);
    getRenderClient()
      .render(
        sourceImage,
        {
          width: contentW,
          height: contentH,
          // The page border is the margin; the photo fills its content rect
          margin: 0,
          scale: page.scale,
          page: {
            width: page.widthPx,
            height: page.heightPx,
            offsetX: rect.x,
            offsetY: rect.y,
          },
          seed: settings.seed,
          minSpacing: settings.minSpacing,
          maxSpacing: settings.maxSpacing,
          whiteCutoff: settings.whiteCutoff,
          hatchAngle: settings.hatchAngle,
          followTone: settings.followTone,
          drawOutlines: settings.drawOutlines,
          contourHalo: settings.contourHalo,
          wobble: settings.wobble,
          textureStrokes: settings.textureStrokes,
          textureStyle: settings.textureStyle,
          // 'auto' leaves the option unset so the scene labels decide
          skyStipple: settings.skyStipple === 'auto' ? undefined : settings.skyStipple,
          calmWater: settings.calmWater === 'auto' ? undefined : settings.calmWater,
          crossContour: settings.crossContour,
          facetHatch: settings.facetHatch,
          maxStrokeLength: settings.maxStrokeLength,
          fieldSmoothing: settings.fieldSmoothing,
          depthMap: depthMap ?? undefined,
          labelMap: labelMap ?? undefined,
          formStrength: settings.formStrength,
          depthIsolation: settings.depthIsolation,
          autoStyle: settings.autoStyle,
          detailEmphasis: settings.detailEmphasis,
          toneGamma: settings.toneGamma,
          valueBands: settings.valueBands,
          massing: settings.massing,
          hatchPatchiness: settings.hatchPatchiness,
          workingSize: Math.min(settings.workingSize, wsCap),
          layers: lowMemory ? Math.min(2, settings.layers) : settings.layers,
          richBlacks: lowMemory ? false : settings.richBlacks,
          counterchange: settings.counterchange,
          // Focus points are normalised to the photo, so they live in the
          // content rect's coordinate space (the renderer frames it onto the page)
          focus: focusPoints.map((point) => ({
            x: point.x * contentW,
            y: point.y * contentH,
            radius: (settings.focusRadiusPct / 100) * Math.min(contentW, contentH),
            strength: settings.focusStrength,
          })),
          subjectMask: subjectMask ?? undefined,
          maskStrength: settings.maskStrength,
          portrait: portraitState
            ? {
                ...portraitState.portrait,
                featureStrokes: settings.featureLines
                  ? portraitState.portrait.featureStrokes
                  : undefined,
                skinLightening: settings.skinLightening,
              }
            : undefined,
        },
        {
          strokeColor: settings.strokeColor,
          // Pen width is physical: convert mm to px at the page's density so
          // the plotted line is the real weight, and tag the SVG in mm
          strokeWidth: settings.penWidthMm * page.pxPerMm,
          physicalWidth: `${page.widthMm}mm`,
          physicalHeight: `${page.heightMm}mm`,
        },
        // Optional shared background texture; the worker holds it a halo off
        // the rendered ink and lays it behind on its own pen layer.
        (() => {
          const texOpts = textureOptionsFor(frame, page);
          return texOpts ? { options: texOpts, color: frame.textureColor } : undefined;
        })(),
        // Universal finishing: page border + density protection (off unless the
        // shared post-processing section turns them on).
        {
          border: frame.borderEnabled
            ? {
                marginPx: frame.marginMm * page.pxPerMm,
                insetPx: frame.borderInsetMm * page.pxPerMm,
              }
            : undefined,
          density: post.density.enabled ? { maxPasses: post.density.maxPasses } : undefined,
          pxPerMm: page.pxPerMm,
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
  }, [
    active, sourceImage, inkLayout, settings, focusPoints, subjectMask, portraitState,
    depthMap, labelMap, lowMemory,
    post.density,
    frame.borderEnabled, frame.borderInsetMm,
    frame.textureEnabled, frame.textureStyle, frame.textureSpacingMm, frame.textureAngleDeg,
    frame.textureScale, frame.textureJitter, frame.textureDensity, frame.textureCrossHatch,
    frame.textureColor, frame.textureSeed, frame.textureHaloMm, frame.textureShapes,
  ]);

  // Auto ML (scene labels ~5MB, then depth ~25MB where the device
  // reports WebGPU) waits for the first render to finish, then runs the
  // models strictly one after another. Instantiating the ONNX runtime
  // costs a ~250MB+ transient regardless of model size (measured:
  // session creation dominates, inference is the smaller term), so it
  // must never share its peak with the pen-ink render or another model
  // worker — on phones the sum is a tab kill where each alone fits
  useEffect(() => {
    if (!active) return;
    if (isRendering) {
      renderSeenRef.current = true;
      return;
    }
    if (!autoMlPendingRef.current || !renderSeenRef.current) return;
    autoMlPendingRef.current = false;
    const labelsDone = lowMemory ? Promise.resolve() : estimateSceneLabels();
    labelsDone.then(() => {
      if ('gpu' in navigator) estimateDepthMap();
    });
  }, [active, isRendering, lowMemory, estimateSceneLabels, estimateDepthMap]);

  const generated = useMemo(() => {
    if (!sourceImage || !inkRender) {
      const dims = inkLayout?.page ?? { widthPx: 0, heightPx: 0 };
      return { svg: '', width: dims.widthPx, height: dims.heightPx };
    }
    // The plot window shows the preview SVG (ghosts any density-removed strokes).
    return { svg: inkRender.previewSvg, width: inkRender.width, height: inkRender.height };
  }, [sourceImage, inkRender, inkLayout]);

  // Publish the current plot to the shared Output / Post-processing section.
  // Image → Ink renders a single unified drawing, so it offers no per-layer
  // export (result stays in the worker); the clean export SVG drives download.
  useEffect(() => {
    if (!active) return;
    if (!sourceImage || !inkRender) {
      register(null);
      return;
    }
    register({
      exportSvg: inkRender.svg,
      result: null,
      svgOptions: {},
      baseName: 'pen-ink',
      seed: settings.seed,
      hasLayers: false,
      densityStats: inkRender.densityStats,
    });
  }, [active, sourceImage, inkRender, settings.seed, register]);

  const value: ImageInkValue = {
    settings,
    updateSettings,
    imageName,
    preset,
    applyPreset,
    onImageFile,
    randomizeSeed,
    sourceImage,
    isRendering,
    inkLayout,
    generated,
    focusPoints,
    setFocus,
    clearFocus,
    subjectMask,
    segmentStatus,
    isolateSubject,
    clearSubjectMask,
    portraitState,
    portraitStatus,
    detectFaces,
    clearPortrait,
    depthMap,
    depthStatus,
    depthError,
    estimateDepthMap,
    clearDepth,
    labelMap,
    labelStatus,
    labelError,
    estimateSceneLabels,
    clearLabels,
    lowMemory,
    disableLowMemory,
  };

  return <ImageInkContext.Provider value={value}>{children}</ImageInkContext.Provider>;
}

export function useImageInk(): ImageInkValue {
  const ctx = useContext(ImageInkContext);
  if (!ctx) throw new Error('useImageInk must be used within an ImageInkProvider');
  return ctx;
}
