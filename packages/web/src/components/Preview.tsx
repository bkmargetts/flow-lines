import { useRef, useCallback, useState, useEffect } from 'react';
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
  focusMarker?: FocusMarker | null;
  onSetFocus?: (point: Point) => void;
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
  focusMarker = null,
  onSetFocus,
}: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);

  // Calculate max dimensions to fit in viewport while maintaining aspect ratio
  const maxWidth = Math.min(width, 800);
  const maxHeight = Math.min(height, 800);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;

      // Check bounds
      if (x < 0 || x > width || y < 0 || y > height) {
        return null;
      }

      return { x, y };
    },
    [scale, width, height]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (focusSelectMode && onSetFocus) {
        e.preventDefault();
        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) {
          onSetFocus(point);
        }
        return;
      }

      if (!paintMode) return;

      e.preventDefault();
      setIsPainting(true);

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) {
        onPaint(point);
      }
    },
    [paintMode, focusSelectMode, getCanvasPoint, onPaint, onSetFocus]
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

  const focusOverlay = focusMarker ? (
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
      <circle
        cx={focusMarker.x}
        cy={focusMarker.y}
        r={focusMarker.radius}
        fill="none"
        stroke="rgba(233, 69, 96, 0.5)"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      <circle cx={focusMarker.x} cy={focusMarker.y} r={4} fill="rgba(233, 69, 96, 0.8)" />
    </svg>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={`canvas-wrapper ${paintMode ? 'paint-mode' : ''}`}
      style={{
        width: displayWidth,
        height: displayHeight,
        position: 'relative',
        cursor: paintMode || focusSelectMode ? 'crosshair' : 'default',
        touchAction: paintMode || focusSelectMode ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div dangerouslySetInnerHTML={{ __html: svgContent }} />
      {paintDotsOverlay}
      {focusOverlay}
    </div>
  );
}
