import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ComponentType,
} from 'react';
import { FrameProvider } from './FrameContext';
import { LayerStoreProvider, useLayerStore } from './LayerStore';
import { FrameControls } from './components/FrameControls';
import { LayerStackPanel } from './components/LayerStackPanel';
import { PlotActions } from './components/PlotActions';
import { PlotCanvas } from './components/PlotCanvas';
import { getModule } from './modules/registry';
import type { ControlsProps } from './modules/types';

// How much of the bottom sheet peeks above the fold when collapsed (the grab
// handle bar), in px.
const SHEET_PEEK = 60;

/** The selected layer's module Controls, bound to that layer's state. */
function SelectedLayerControls() {
  const { layers, selectedId, updateState } = useLayerStore();
  const layer = layers.find((l) => l.instanceId === selectedId) ?? layers[layers.length - 1];
  if (!layer) return null; // empty stack — nothing selected
  const mod = getModule(layer.moduleId);
  const Controls = mod.Controls as ComponentType<ControlsProps<unknown>>;
  return (
    <Controls
      key={layer.instanceId}
      state={layer.state}
      update={(u) => updateState(layer.instanceId, u)}
      instanceId={layer.instanceId}
      selected
    />
  );
}

function Shell() {
  // Desktop: the controls collapse to full-screen the art pane.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mobile: the controls are a bottom sheet that peeks above the art and drags
  // up to expand. Collapsed by default so the art is full-height on load.
  const [isMobile, setIsMobile] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startY: number; base: number } | null>(null);

  // Track the phone breakpoint (matches the CSS media query) so the sheet
  // gestures only run on mobile.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const collapsedOffset = useCallback(() => {
    const h = sheetRef.current?.offsetHeight ?? Math.round(window.innerHeight * 0.85);
    return Math.max(0, h - SHEET_PEEK);
  }, []);

  const onHandleDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const base = sheetExpanded ? 0 : collapsedOffset();
      dragRef.current = { startY: e.clientY, base };
      setDragOffset(base);
    },
    [isMobile, sheetExpanded, collapsedOffset]
  );

  const onHandleMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const co = collapsedOffset();
      const next = dragRef.current.base + (e.clientY - dragRef.current.startY);
      setDragOffset(Math.min(co, Math.max(0, next)));
    },
    [collapsedOffset]
  );

  const onHandleUp = useCallback(() => {
    if (!dragRef.current) return;
    const { base } = dragRef.current;
    const off = dragOffset ?? base;
    if (Math.abs(off - base) < 6) {
      setSheetExpanded((v) => !v);
    } else {
      setSheetExpanded(off < collapsedOffset() / 2);
    }
    dragRef.current = null;
    setDragOffset(null);
  }, [dragOffset, collapsedOffset]);

  const dragging = dragOffset != null;
  const sheetTransform = isMobile && dragging ? `translateY(${dragOffset}px)` : undefined;

  return (
    <div className={`app ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside
        ref={sheetRef}
        className={`sidebar ${isMobile ? 'sheet' : ''} ${dragging ? 'dragging' : ''} ${
          sheetExpanded ? 'sheet-expanded' : ''
        }`}
        style={sheetTransform ? { transform: sheetTransform } : undefined}
      >
        <div
          className="sheet-handle"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span className="sheet-grip" aria-hidden="true" />
          <span className="sheet-label">{sheetExpanded ? 'Tap to close' : 'Controls'}</span>
        </div>

        <div className="sidebar-header">
          <div>
            <h1>Flow Lines</h1>
            <p className="subtitle">Generative Art for Pen Plotters</p>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label="Hide controls"
            title="Hide controls"
            onClick={() => setSidebarOpen(false)}
          >
            ⟨
          </button>
        </div>

        <LayerStackPanel />
        <FrameControls />
        <SelectedLayerControls />
        <PlotActions />

        {/* Sticky fade hinting the controls scroll. */}
        <div className="scroll-fade" aria-hidden="true" />
      </aside>

      <main className="canvas-container">
        {!sidebarOpen && (
          <button
            type="button"
            className="controls-reveal"
            aria-label="Show controls"
            title="Show controls"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
        )}
        <PlotCanvas />
      </main>
    </div>
  );
}

export function App() {
  return (
    <FrameProvider>
      <LayerStoreProvider>
        <Shell />
      </LayerStoreProvider>
    </FrameProvider>
  );
}
