import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { randomSeed } from '../../lib/random';
import {
  grayscaleFromRGBA,
  contentRect,
  type GrayscaleImage,
  type LabelImage,
  type Point,
  type PageMetrics,
  type Rect,
  type FlowLine,
} from '@flow-lines/core';
import { getRenderClient } from '../../render-client';
import type { LayerOutput, LiveInstanceArgs } from '../../modules/types';
import {
  PRESETS,
  type InkSettings,
  type ImageInkLayerState,
  type SegmentStatus,
  type PortraitStatus,
  type DepthStatus,
  type LabelStatus,
  type PortraitState,
} from './types';
import {
  APPLY_FLAG,
  LABELING_FLAG,
  LOW_MEM_FLAG,
  detectLowMemory,
  scheduleML,
} from './ml-scheduler';
import { setInstanceApi, clearInstanceApi, type ImageInkApi } from './instance-store';
import { randomImageInkGenome } from './genome';

/** Tight-memory devices get smaller working rasters. */
const IS_MOBILE =
  typeof navigator !== 'undefined' && /iP(hone|ad|od)|Android/.test(navigator.userAgent);

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

/** Where the photo sits on the shared sheet, in page pixels. Lives here (not in
 *  layer state) and is shared with the focus overlay so taps land on the photo,
 *  not the paper border. */
export type InkLayout = {
  page: PageMetrics;
  rect: Rect;
  contentW: number;
  contentH: number;
};

/**
 * The Image → Ink live instance: owns this layer's photo + ML state and a
 * debounced worker render, and publishes its raw lines to the compositor. The
 * serialisable settings/preset come from the layer state via `args.update`;
 * everything heavy is local here. Ported from the old ImageInkProvider.
 */
export function useImageInkInstance(args: LiveInstanceArgs<ImageInkLayerState>): void {
  const { instanceId, env, publish } = args;
  const { frame, page, marginPx } = env;
  const settings = args.state.settings;
  const preset = args.state.preset;
  const update = args.update;

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
  const [lowMemory, setLowMemory] = useState(detectLowMemory);
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
  // Last published output, so we can re-publish it with busy=true at the
  // start of a render (the previous frame stays visible while the next computes)
  const lastOutputRef = useRef<LayerOutput | null>(null);

  const updateSettings = useCallback(
    (updates: Partial<InkSettings>) => {
      update((s) => ({ settings: { ...s.settings, ...updates } }));
    },
    [update]
  );

  const randomizeSeed = useCallback(() => {
    // Surprise me: a new seed barely changes the look, so the dice also
    // rolls the artistic levers (the genome) within tasteful ranges
    update(() => ({
      preset: '',
      settings: {
        ...args.state.settings,
        ...randomImageInkGenome(Math.random),
        seed: randomSeed(),
      },
    }));
    // `update` is a functional setter, so reading args.state.settings here is
    // fine — randomize is a one-shot user action, not a render-time read.
  }, [update, args.state.settings]);

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

  // Resolves when the depth worker has finished, so other model runs can be
  // sequenced behind it — phones can't afford two resident ONNX sessions at
  // once. Routed through the global ML scheduler so this serialises across
  // EVERY image-ink instance, not just this one.
  const estimateDepthMap = useCallback((): Promise<void> => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return Promise.resolve();

    const token = ++depthTokenRef.current;
    setDepthStatus('loading');
    setDepthError(null);
    return scheduleML(() =>
      import('../../depth-client').then(({ estimateDepthInWorker }) =>
        estimateDepthInWorker(canvas)
      )
    )
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

  // Resolves when the labels worker has finished, so the heavier depth job can
  // be sequenced behind it. Routed through the global ML scheduler.
  const estimateSceneLabels = useCallback((): Promise<void> => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return Promise.resolve();

    const token = ++labelTokenRef.current;
    setLabelStatus('loading');
    setLabelError(null);
    // Breadcrumb: if the page dies during inference, the next visit
    // detects it, enters low-memory mode, and stops auto-running labels
    localStorage.setItem(LABELING_FLAG, '1');
    return scheduleML(() =>
      import('../../labels-client').then(({ estimateLabelsInWorker }) =>
        estimateLabelsInWorker(canvas)
      )
    )
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

  // The photo's rectangle on the shared sheet (letterbox 'fit' or centred
  // 'fill'). The page raster is the compositor's uncapped page (so published
  // lines land in composite coordinates); the phone/low-memory budget now caps
  // only the internal working raster, not the output page.
  const inkLayout = useMemo<InkLayout | null>(() => {
    if (!sourceImage) return null;
    const imgAspect = sourceImage.width / sourceImage.height;
    const rect = contentRect(page.widthPx, page.heightPx, marginPx, imgAspect, frame.fit);
    return {
      page,
      rect,
      contentW: Math.max(1, Math.round(rect.width)),
      contentH: Math.max(1, Math.round(rect.height)),
    };
  }, [sourceImage, page, marginPx, frame.fit]);

  // Pen-ink rendering runs in the shared render worker so sliders and AI
  // updates never freeze the UI; the previous frame stays visible while the
  // next one computes (per-instance latest-wins drops intermediate slider
  // positions). Always renders when there's an image + layout — selection no
  // longer gates work, since every layer contributes to the composite.
  useEffect(() => {
    if (!sourceImage || !inkLayout) return;

    const { rect, contentW, contentH } = inkLayout;
    // The working/detail raster still gets the phone/low-memory cap on its own
    // axis — that's where the render's memory really lives, independent of the
    // shared output page size.
    const wsCap = lowMemory ? 420 : IS_MOBILE ? 520 : Infinity;

    setIsRendering(true);
    publish(lastOutputRef.current, true);
    getRenderClient()
      .render(instanceId, sourceImage, {
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
        lineSwell: settings.lineSwell,
        scribbleTone: settings.scribbleTone,
        strokeBudget: settings.strokeBudget,
        strokeWeight: settings.strokeWeight,
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
        solidBlacks: settings.solidBlacks,
        // The fill pitch follows the actual pen: slightly tighter than the
        // plotted width so passes overlap into true solid
        fillSpacing: settings.penWidthMm * page.pxPerMm * 0.95,
        outlinePasses: settings.outlinePasses,
        outlineThreshold: settings.outlineThreshold,
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
      })
      .then((rendered: { lines: FlowLine[] }) => {
        // Survived the apply — clear the crash breadcrumb
        localStorage.removeItem(APPLY_FLAG);
        const output: LayerOutput = {
          lines: rendered.lines,
          strokeColor: settings.strokeColor,
          // Pen width is physical: mm → px at the page's density so the
          // plotted line is the real weight.
          strokeWidthPx: settings.penWidthMm * page.pxPerMm,
        };
        lastOutputRef.current = output;
        publish(output, false);
        setIsRendering(false);
      })
      .catch((err: Error) => {
        // Superseded renders are expected during rapid slider changes
        if (err.message !== 'superseded') {
          publish(lastOutputRef.current, false);
          setIsRendering(false);
        }
      });
  }, [
    instanceId, sourceImage, inkLayout, settings, focusPoints, subjectMask, portraitState,
    depthMap, labelMap, lowMemory, page, publish,
  ]);

  // Auto ML (scene labels ~5MB, then depth ~25MB where the device reports
  // WebGPU) waits for the first render to finish, then runs the models strictly
  // one after another. Instantiating the ONNX runtime costs a ~250MB+ transient
  // regardless of model size, so it must never share its peak with the pen-ink
  // render or another model worker — the global ML scheduler enforces that this
  // never overlaps another instance's models too. Runs regardless of selection.
  useEffect(() => {
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
  }, [isRendering, lowMemory, estimateSceneLabels, estimateDepthMap]);

  // Publish the live API so this instance's Controls (elsewhere in the tree)
  // see live updates; tear it down on unmount.
  const api: ImageInkApi = {
    imageName,
    onImageFile,
    randomizeSeed,
    sourceImage,
    isRendering,
    inkLayout,
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

  useEffect(() => {
    setInstanceApi(instanceId, api);
    // api is rebuilt every render; setInstanceApi emits so subscribers refresh.
  });

  useEffect(() => {
    return () => clearInstanceApi(instanceId);
  }, [instanceId]);

  // Keep `preset` referenced so the lint rule for unused vars stays quiet and
  // the value is documented as deliberately read from layer state (Controls own
  // the preset UI; the hook doesn't act on it directly).
  void preset;
}
