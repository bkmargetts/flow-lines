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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });

  // Gesture state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const gestureRef = useRef({
    initialDistance: 0,
    initialScale: 1,
    initialX: 0,
    initialY: 0,
    lastX: 0,
    lastY: 0,
    isPinching: false,
    isPanning: false,
  });

  // Calculate display size to fit viewport
  useEffect(() => {
    const updateSize = () => {
      if (wrapperRef.current) {
        const parent = wrapperRef.current.parentElement;
        if (parent) {
          const padding = 48; // Account for padding
          setViewportSize({
            width: parent.clientWidth - padding,
            height: parent.clientHeight - padding,
          });
        }
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate scale to fit viewport while maintaining aspect ratio
  const baseScale = Math.min(
    viewportSize.width / width,
    viewportSize.height / height,
    1 // Don't scale up beyond 1:1
  );

  const displayWidth = width * baseScale;
  const displayHeight = height * baseScale;

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const effectiveScale = baseScale * transform.scale;

      // Account for transform offset
      const x = (clientX - rect.left - transform.x) / effectiveScale;
      const y = (clientY - rect.top - transform.y) / effectiveScale;

      // Check bounds
      if (x < 0 || x > width || y < 0 || y > height) {
        return null;
      }

      return { x, y };
    },
    [baseScale, transform, width, height]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore multi-touch for drawing
      if (e.pointerType === 'touch' && gestureRef.current.isPinching) return;

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
      if (gestureRef.current.isPinching) return;

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

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch/pan gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      gestureRef.current = {
        ...gestureRef.current,
        initialDistance: distance,
        initialScale: transform.scale,
        initialX: transform.x,
        initialY: transform.y,
        lastX: centerX,
        lastY: centerY,
        isPinching: true,
        isPanning: false,
      };
    }
  }, [transform]);

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

      // Calculate new scale
      const scaleFactor = distance / gestureRef.current.initialDistance;
      const newScale = Math.min(Math.max(gestureRef.current.initialScale * scaleFactor, 0.5), 4);

      // Calculate pan
      const deltaX = centerX - gestureRef.current.lastX;
      const deltaY = centerY - gestureRef.current.lastY;

      setTransform((prev) => ({
        scale: newScale,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      gestureRef.current.lastX = centerX;
      gestureRef.current.lastY = centerY;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    gestureRef.current.isPinching = false;
  }, []);

  // Wheel zoom for desktop
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      setTransform((prev) => ({
        ...prev,
        scale: Math.min(Math.max(prev.scale + delta, 0.5), 4),
      }));
    }
  }, []);

  // Double tap/click to reset
  const handleDoubleClick = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  // Clean up painting state when pointer leaves or mode changes
  useEffect(() => {
    const handleGlobalPointerUp = () => setIsPainting(false);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  // Generate paint dots overlay
  const paintDotsOverlay = showDots && paintedPoints.length > 0 ? (
    <svg
      className="paint-overlay"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
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
        width: '100%',
        height: '100%',
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
      ref={wrapperRef}
      className="preview-wrapper"
      onWheel={handleWheel}
    >
      <div
        ref={containerRef}
        className={`canvas-wrapper ${paintMode ? 'paint-mode' : ''} ${attractorMode ? 'attractor-mode' : ''}`}
        style={{
          width: displayWidth,
          height: displayHeight,
          position: 'relative',
          cursor: isInteractive ? 'crosshair' : 'default',
          touchAction: isInteractive ? 'none' : 'manipulation',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center center',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{ width: '100%', height: '100%' }}
        />
        {paintDotsOverlay}
        {attractorOverlay}
      </div>

      {transform.scale !== 1 && (
        <div className="zoom-indicator">
          {Math.round(transform.scale * 100)}%
        </div>
      )}
    </div>
  );
}
