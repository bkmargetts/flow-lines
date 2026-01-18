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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Measure container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current?.parentElement) {
        const rect = containerRef.current.parentElement.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate scale to fit
  const padding = 32;
  const availableWidth = containerSize.width - padding * 2;
  const availableHeight = containerSize.height - padding * 2;
  const scale = Math.min(availableWidth / width, availableHeight / height, 1);
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;

      if (x < 0 || x > width || y < 0 || y > height) return null;
      return { x, y };
    },
    [scale, width, height]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (attractorMode) {
        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) onAddAttractor(point.x, point.y);
        return;
      }

      if (paintMode) {
        setIsPainting(true);
        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) onPaint(point);
      }
    },
    [paintMode, attractorMode, getCanvasPoint, onPaint, onAddAttractor]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!paintMode || !isPainting) return;
      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) onPaint(point);
    },
    [paintMode, isPainting, getCanvasPoint, onPaint]
  );

  const handlePointerUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = () => setIsPainting(false);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const isInteractive = paintMode || attractorMode;

  return (
    <div className="preview">
      <div
        ref={containerRef}
        className={`canvas ${isInteractive ? 'interactive' : ''} ${paintMode ? 'paint' : ''} ${attractorMode ? 'attractor' : ''}`}
        style={{ width: displayWidth, height: displayHeight }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div dangerouslySetInnerHTML={{ __html: svgContent }} />

        {/* Paint dots overlay */}
        {showDots && paintedPoints.length > 0 && (
          <svg className="overlay" viewBox={`0 0 ${width} ${height}`}>
            {paintedPoints.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={2}
                fill="rgba(233, 69, 96, 0.5)"
              />
            ))}
          </svg>
        )}

        {/* Attractor zones overlay */}
        {showAttractors && attractors.length > 0 && (
          <svg className="overlay" viewBox={`0 0 ${width} ${height}`}>
            {attractors.map((a, i) => (
              <circle
                key={i}
                cx={a.x}
                cy={a.y}
                r={a.radius}
                fill={a.strength > 0 ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 107, 107, 0.2)'}
                stroke={a.strength > 0 ? 'rgba(78, 205, 196, 0.6)' : 'rgba(255, 107, 107, 0.6)'}
                strokeWidth={2}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
