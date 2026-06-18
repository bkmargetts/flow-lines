import { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import type { Point } from '@flow-lines/core';
import { useFrame } from '../FrameContext';
import { textureParamsFor } from '../textures/registry';

interface FocusMarker {
  x: number;
  y: number;
  radius: number;
}

interface PreviewProps {
  svgContent: string;
  width: number;
  height: number;
  paintMode: boolean;
  paintedPoints: Point[];
  showDots: boolean;
  onPaint: (point: Point) => void;
  focusSelectMode?: boolean;
  focusMarkers?: FocusMarker[];
  onSetFocus?: (point: Point) => void;
  /** Paper colour shown behind the (transparent) drawing — preview only. */
  background?: string;
}

export function Preview({
  svgContent,
  width,
  height,
  paintMode: paintModeProp,
  paintedPoints: paintedPointsProp,
  showDots: showDotsProp,
  onPaint: onPaintProp,
  focusSelectMode = false,
  focusMarkers = [],
  onSetFocus,
  background,
}: PreviewProps) {
  // When the shared background texture is in "draw mask" mode, the canvas of
  // whatever project is active collects the texture's mask path — so a texture
  // (e.g. the grating) can be clipped to a hand-drawn band like the standalone
  // project. This takes over painting from the active project while it's on.
  const { frame, updateTextureParams } = useFrame();
  const textureDrawing =
    frame.textureEnabled && frame.textureModuleId === 'grating' && frame.textureMaskDrawing;
  const textureMaskPath = textureDrawing
    ? ((textureParamsFor('grating', frame.textureParams).maskPath as Point[]) ?? [])
    : [];
  const paintMode = textureDrawing ? true : paintModeProp;
  const paintedPoints = textureDrawing ? textureMaskPath : paintedPointsProp;
  const showDots = textureDrawing ? true : showDotsProp;
  const onPaint = textureDrawing
    ? (p: Point) =>
        updateTextureParams('grating', (cur) => ({
          maskPath: [...((cur.maskPath as Point[]) ?? []), p],
        }))
    : onPaintProp;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);

  // Live size of the scroll stage, so the sheet fits the space actually
  // available rather than a hardcoded box. Null until the first measure.
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);
  // Zoom relative to the fit scale: 1 = "fits the stage". Pan is native scroll.
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setStageSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A fresh drawing (new dimensions) resets the zoom back to fit.
  useEffect(() => {
    setZoom(1);
  }, [width, height]);

  // Display the drawing as a rasterized <img> instead of inline SVG DOM:
  // a dense render is thousands of <path> nodes, and mobile WebKit kills
  // pages that scroll/layout such DOMs. An image is one composited
  // texture; the SVG string itself is only used for download.
  const svgUrl = useMemo(() => {
    if (!svgContent) return null;
    return URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml' }));
  }, [svgContent]);

  useEffect(() => {
    return () => {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
    };
  }, [svgUrl]);

  // Fit the sheet to the measured stage (its content box already excludes the
  // padding). Fall back to the previous fixed box before the first measure so
  // the initial paint never flashes at zero size.
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 8;
  const availW = stageSize ? Math.max(1, stageSize.w) : 800;
  const availH = stageSize ? Math.max(1, stageSize.h) : 800;
  const fitScale = Math.min(availW / width, availH / height);
  const effScale = fitScale * zoom;
  const displayWidth = width * effScale;
  const displayHeight = height * effScale;

  const clampZoom = useCallback(
    (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)),
    []
  );
  const resetFit = useCallback(() => setZoom(1), []);

  // Keep the point under the pinch midpoint / cursor fixed while zooming (zoom
  // to focal point, not to the top-left corner). Capture the drawing-space
  // point under the focal client position; after the size updates, correct the
  // stage scroll so that same point lands back under the focal point.
  const anchorRef = useRef<{ cx: number; cy: number; fx: number; fy: number } | null>(null);
  const captureAnchor = useCallback(
    (fx: number, fy: number) => {
      const w = wrapperRef.current;
      if (!w) return;
      const r = w.getBoundingClientRect();
      anchorRef.current = {
        cx: ((fx - r.left) / r.width) * width,
        cy: ((fy - r.top) / r.height) * height,
        fx,
        fy,
      };
    },
    [width, height]
  );

  useLayoutEffect(() => {
    const a = anchorRef.current;
    const stage = stageRef.current;
    const w = wrapperRef.current;
    if (!a || !stage || !w) return;
    anchorRef.current = null;
    const r = w.getBoundingClientRect();
    const curX = r.left + (a.cx / width) * r.width;
    const curY = r.top + (a.cy / height) * r.height;
    stage.scrollLeft += curX - a.fx;
    stage.scrollTop += curY - a.fy;
  }, [zoom, width, height]);

  // ctrl/cmd-wheel zoom — desktop trackpad pinch arrives as a ctrl+wheel event.
  // React's onWheel is passive and can't preventDefault, so bind natively. Plain
  // wheel is left alone → the stage pans (scrolls) natively.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      captureAnchor(e.clientX, e.clientY);
      setZoom((z) => clampZoom(z * Math.exp(-e.deltaY * 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampZoom, captureAnchor]);

  // Touch pinch-zoom + drag-pan, handled directly so the art pane zooms and
  // pans independently of the page. Track every active pointer on the stage:
  // two pointers = pinch (zoom by the change in finger distance); one pointer =
  // drag-pan (scroll the stage) when not painting. A second finger always ends
  // any in-progress paint stroke. `movedRef` lets a pan suppress the focus tap.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);
  const movedRef = useRef(false);

  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pts = pointersRef.current;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) movedRef.current = false;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        // Lock the drawing-space point under the initial midpoint; the whole
        // pinch anchors to it (re-deriving it each step would bake in drift
        // accumulated while the sheet still fits and can't scroll).
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        let cx = 0;
        let cy = 0;
        const w = wrapperRef.current;
        if (w) {
          const r = w.getBoundingClientRect();
          cx = ((mx - r.left) / r.width) * width;
          cy = ((my - r.top) / r.height) * height;
        }
        pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom, cx, cy };
        panRef.current = null;
        setIsPainting(false);
      } else if (pts.size === 1 && !paintMode) {
        const stage = stageRef.current;
        if (stage) {
          panRef.current = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
        }
      }
    },
    [zoom, paintMode, width, height]
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onMove = (e: PointerEvent) => {
      const pts = pointersRef.current;
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pts.size >= 2 && pinchRef.current) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        // Keep the locked focal point under the current finger midpoint.
        anchorRef.current = {
          cx: pinchRef.current.cx,
          cy: pinchRef.current.cy,
          fx: (a.x + b.x) / 2,
          fy: (a.y + b.y) / 2,
        };
        setZoom(clampZoom(pinchRef.current.zoom * (d / pinchRef.current.dist)));
        movedRef.current = true;
        e.preventDefault();
      } else if (panRef.current) {
        const dx = e.clientX - panRef.current.x;
        const dy = e.clientY - panRef.current.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
        stage.scrollLeft = panRef.current.sl - dx;
        stage.scrollTop = panRef.current.st - dy;
        e.preventDefault();
      }
    };
    const onUp = (e: PointerEvent) => {
      const pts = pointersRef.current;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchRef.current = null;
      if (pts.size === 0) panRef.current = null;
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clampZoom, captureAnchor]);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      // Measure the wrapper itself: its rect is already post-zoom and
      // post-scroll, so taps map to canvas pixels at any zoom or pan offset.
      if (!wrapperRef.current) return null;

      const rect = wrapperRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / effScale;
      const y = (clientY - rect.top) / effScale;

      // Check bounds
      if (x < 0 || x > width || y < 0 || y > height) {
        return null;
      }

      return { x, y };
    },
    [effScale, width, height]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!paintMode) return;

      e.preventDefault();
      setIsPainting(true);

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) {
        onPaint(point);
      }
    },
    [paintMode, getCanvasPoint, onPaint]
  );

  // Focus uses click, not pointerdown, so only deliberate taps place focus
  // points. A pan gesture sets movedRef, which we honour here so dragging the
  // sheet around never drops a focus point.
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!focusSelectMode || !onSetFocus || movedRef.current) return;

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) {
        onSetFocus(point);
      }
    },
    [focusSelectMode, getCanvasPoint, onSetFocus]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!paintMode || !isPainting) return;

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) {
        onPaint(point);
      }
    },
    [paintMode, isPainting, getCanvasPoint, onPaint]
  );

  const handlePointerUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  // Clean up painting state when pointer leaves or mode changes
  useEffect(() => {
    const handleGlobalPointerUp = () => setIsPainting(false);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  // Generate paint dots overlay - controlled by showDots toggle
  const paintDotsOverlay = showDots && paintedPoints.length > 0 ? (
    <svg
      className="paint-overlay"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: displayWidth,
        height: displayHeight,
        pointerEvents: 'none',
      }}
    >
      {paintedPoints.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={2}
          fill="rgba(233, 69, 96, 0.4)"
          stroke="rgba(233, 69, 96, 0.8)"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  ) : null;

  const focusOverlay = focusMarkers.length > 0 ? (
    <svg
      className="focus-overlay"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: displayWidth,
        height: displayHeight,
        pointerEvents: 'none',
      }}
    >
      {focusMarkers.map((marker, i) => (
        <g key={i}>
          <circle
            cx={marker.x}
            cy={marker.y}
            r={marker.radius}
            fill="none"
            stroke="rgba(233, 69, 96, 0.5)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <circle cx={marker.x} cy={marker.y} r={4} fill="rgba(233, 69, 96, 0.8)" />
        </g>
      ))}
    </svg>
  ) : null;

  // Cursor hint: crosshair while painting/picking focus, otherwise a grab hand
  // for drag-pan.
  const cursor = paintMode || focusSelectMode ? 'crosshair' : 'grab';

  return (
    <div className="preview-root">
      <div
        ref={stageRef}
        className="canvas-stage"
        onPointerDown={handleStagePointerDown}
        onDoubleClick={resetFit}
      >
        <div
          ref={wrapperRef}
          className={`canvas-wrapper ${paintMode ? 'paint-mode' : ''}`}
          style={{
            width: displayWidth,
            height: displayHeight,
            position: 'relative',
            cursor,
            // Gestures are handled in JS (pinch-zoom + drag-pan), so the
            // browser must not claim touches for native scroll/zoom.
            touchAction: 'none',
            ...(background ? { background } : null),
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={handleClick}
        >
          {svgUrl && (
            <img
              src={svgUrl}
              width={displayWidth}
              height={displayHeight}
              alt="Generated drawing"
              draggable={false}
            />
          )}
          {paintDotsOverlay}
          {focusOverlay}
        </div>
      </div>
    </div>
  );
}
