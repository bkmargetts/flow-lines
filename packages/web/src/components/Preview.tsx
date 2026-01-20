import { useRef, useCallback, useState, useEffect } from 'react';
import type { Point, Attractor, DensityPoint } from '@flow-lines/technique-flow-lines';

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
  densityMode: boolean;
  densityPoints: DensityPoint[];
  showDensityPoints: boolean;
  onAddDensityPoint: (x: number, y: number) => void;
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
  densityMode,
  densityPoints,
  showDensityPoints,
  onAddDensityPoint,
}: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const gestureRef = useRef({
    initialDistance: 0,
    initialZoom: 1,
    lastCenter: { x: 0, y: 0 },
    isPinching: false,
  });

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

  // Calculate scale to fit - minimal padding for maximum canvas
  const padding = 4;
  const availableWidth = containerSize.width - padding * 2;
  const availableHeight = containerSize.height - padding * 2;
  const baseScale = Math.min(availableWidth / width, availableHeight / height, 1);
  const displayWidth = width * baseScale;
  const displayHeight = height * baseScale;

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const effectiveScale = baseScale * zoom;

      // Account for pan offset
      const x = (clientX - rect.left - pan.x) / effectiveScale;
      const y = (clientY - rect.top - pan.y) / effectiveScale;

      if (x < 0 || x > width || y < 0 || y > height) return null;
      return { x, y };
    },
    [baseScale, zoom, pan, width, height]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore if pinching
      if (gestureRef.current.isPinching) return;

      if (attractorMode) {
        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) onAddAttractor(point.x, point.y);
        return;
      }

      if (densityMode) {
        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) onAddDensityPoint(point.x, point.y);
        return;
      }

      if (paintMode) {
        setIsPainting(true);
        const point = getCanvasPoint(e.clientX, e.clientY);
        if (point) onPaint(point);
      }
    },
    [paintMode, attractorMode, densityMode, getCanvasPoint, onPaint, onAddAttractor, onAddDensityPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!paintMode || !isPainting) return;
      if (gestureRef.current.isPinching) return;

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) onPaint(point);
    },
    [paintMode, isPainting, getCanvasPoint, onPaint]
  );

  const handlePointerUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  // Touch gesture handlers for pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      gestureRef.current = {
        initialDistance: distance,
        initialZoom: zoom,
        lastCenter: { x: centerX, y: centerY },
        isPinching: true,
      };
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && gestureRef.current.isPinching) {
      e.preventDefault();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      // Calculate new zoom
      const scaleFactor = distance / gestureRef.current.initialDistance;
      const newZoom = Math.min(Math.max(gestureRef.current.initialZoom * scaleFactor, 0.5), 5);

      // Calculate pan delta
      const deltaX = centerX - gestureRef.current.lastCenter.x;
      const deltaY = centerY - gestureRef.current.lastCenter.y;

      setZoom(newZoom);
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      gestureRef.current.lastCenter = { x: centerX, y: centerY };
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    gestureRef.current.isPinching = false;
  }, []);

  // Double tap to reset zoom
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = () => setIsPainting(false);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const isInteractive = paintMode || attractorMode || densityMode;

  return (
    <div className="preview">
      <div
        ref={containerRef}
        className={`canvas ${isInteractive ? 'interactive' : ''} ${paintMode ? 'paint' : ''} ${attractorMode ? 'attractor' : ''} ${densityMode ? 'density' : ''}`}
        style={{
          width: displayWidth,
          height: displayHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
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

        {/* Density points overlay */}
        {showDensityPoints && densityPoints.length > 0 && (
          <svg className="overlay" viewBox={`0 0 ${width} ${height}`}>
            {densityPoints.map((dp, i) => (
              <g key={i}>
                {/* Outer radius circle */}
                <circle
                  cx={dp.x}
                  cy={dp.y}
                  r={dp.radius}
                  fill="rgba(147, 112, 219, 0.15)"
                  stroke="rgba(147, 112, 219, 0.4)"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
                {/* Inner strength indicator */}
                <circle
                  cx={dp.x}
                  cy={dp.y}
                  r={dp.radius * dp.strength * 0.3}
                  fill="rgba(147, 112, 219, 0.4)"
                />
              </g>
            ))}
          </svg>
        )}
      </div>

      {zoom !== 1 && (
        <div className="zoom-badge">{Math.round(zoom * 100)}%</div>
      )}
    </div>
  );
}
