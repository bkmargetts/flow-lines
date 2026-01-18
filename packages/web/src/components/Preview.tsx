import { useRef, useCallback, useState, useEffect } from 'react';
import type { Point, Attractor } from '@flow-lines/core';

interface PreviewProps {
  svgContent: string;
  width: number;
  height: number;
  paintMode: boolean;
  paintedPoints: Point[];
  showDots: boolean;
  onPaint: (point: Point) => void;
  attractorMode: boolean;
  attractors: Attractor[];
  showAttractors: boolean;
  onAddAttractor: (x: number, y: number) => void;
}

export function Preview({
  svgContent,
  width,
  height,
  paintMode,
  paintedPoints,
  showDots,
  onPaint,
  attractorMode,
  attractors,
  showAttractors,
  onAddAttractor,
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
      // Handle attractor mode - single click only
      if (attractorMode) {
        e.preventDefault();
        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) {
          onAddAttractor(point.x, point.y);
        }
        return;
      }

      // Handle paint mode - drag to paint
      if (paintMode) {
        e.preventDefault();
        setIsPainting(true);

        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) {
          onPaint(point);
        }
      }
    },
    [paintMode, attractorMode, getCanvasPoint, onPaint, onAddAttractor]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Only drag painting in paint mode, not attractor mode
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

  // Generate attractor zones overlay
  const attractorOverlay = showAttractors && attractors.length > 0 ? (
    <svg
      className="attractor-overlay"
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
      {attractors.map((attractor, i) => {
        const isAttractor = attractor.strength > 0;
        const color = isAttractor ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
        const strokeColor = isAttractor ? 'rgba(76, 175, 80, 0.7)' : 'rgba(244, 67, 54, 0.7)';

        return (
          <g key={i}>
            <circle
              cx={attractor.x}
              cy={attractor.y}
              r={attractor.radius}
              fill={color}
              stroke={strokeColor}
              strokeWidth={1}
            />
            <circle
              cx={attractor.x}
              cy={attractor.y}
              r={4}
              fill={strokeColor}
            />
          </g>
        );
      })}
    </svg>
  ) : null;

  const isInteractive = paintMode || attractorMode;

  return (
    <div
      ref={containerRef}
      className={`canvas-wrapper ${paintMode ? 'paint-mode' : ''} ${attractorMode ? 'attractor-mode' : ''}`}
      style={{
        width: displayWidth,
        height: displayHeight,
        position: 'relative',
        cursor: isInteractive ? 'crosshair' : 'default',
        touchAction: isInteractive ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div dangerouslySetInnerHTML={{ __html: svgContent }} />
      {paintDotsOverlay}
      {attractorOverlay}
    </div>
  );
}
