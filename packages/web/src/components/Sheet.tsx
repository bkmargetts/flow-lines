import { useRef, useCallback, useEffect, type ReactNode } from 'react';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ isOpen, onClose, children }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, currentY: 0, isDragging: false });

  const handleDragStart = useCallback((clientY: number) => {
    dragRef.current = {
      startY: clientY,
      currentY: 0,
      isDragging: true,
    };
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;

    const deltaY = clientY - dragRef.current.startY;
    // Only allow dragging down
    if (deltaY > 0) {
      dragRef.current.currentY = deltaY;
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!sheetRef.current) return;

    sheetRef.current.style.transition = '';
    sheetRef.current.style.transform = '';

    // If dragged more than 100px, close the sheet
    if (dragRef.current.currentY > 100) {
      onClose();
    }

    dragRef.current.isDragging = false;
  }, [onClose]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  }, [handleDragMove]);

  // Mouse handlers for desktop testing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleDragStart(e.clientY);
  }, [handleDragStart]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const handleMouseUp = () => handleDragEnd();

    if (dragRef.current.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleDragMove, handleDragEnd]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className="sheet"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleDragEnd}
      >
        <div
          className="sheet-handle"
          onMouseDown={handleMouseDown}
        >
          <div className="sheet-handle-bar" />
        </div>
        <div className="sheet-content">
          {children}
        </div>
      </div>
    </>
  );
}
