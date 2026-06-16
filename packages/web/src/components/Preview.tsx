import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import type { Point } from '@flow-lines/core';

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
  paintMode,
  paintedPoints,
  showDots,
  onPaint,
  focusSelectMode = false,
  focusMarkers = [],
  onSetFocus,
  background,
}: PreviewProps) {
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
  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z * 1.25)), [clampZoom]);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z / 1.25)), [clampZoom]);
  const resetFit = useCallback(() => setZoom(1), []);

  // Pinch (trackpad) and ctrl/cmd-wheel zoom. React's onWheel is passive and
  // can't preventDefault, so bind a non-passive native listener. Plain wheel is
  // left alone → the stage pans natively.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * Math.exp(-e.deltaY * 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampZoom]);

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

  // Focus uses click, not pointerdown: browsers don't fire click after a
  // scroll/pan gesture, so touch scrolling over the preview keeps working
  // and only deliberate taps place focus points
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!focusSelectMode || !onSetFocus) return;

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

  return (
    <div className="preview-root">
      <div ref={stageRef} className="canvas-stage">
        <div
          ref={wrapperRef}
          className={`canvas-wrapper ${paintMode ? 'paint-mode' : ''}`}
          style={{
            width: displayWidth,
            height: displayHeight,
            position: 'relative',
            cursor: paintMode || focusSelectMode ? 'crosshair' : 'default',
            touchAction: paintMode ? 'none' : 'auto',
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
      <div className="zoom-toolbar">
        <button type="button" aria-label="Zoom out" onClick={zoomOut}>
          −
        </button>
        <button
          type="button"
          className="zoom-readout"
          title="Reset to fit"
          onClick={resetFit}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" aria-label="Zoom in" onClick={zoomIn}>
          +
        </button>
        <button type="button" aria-label="Fit to screen" onClick={resetFit}>
          ⤢
        </button>
      </div>
    </div>
  );
}
