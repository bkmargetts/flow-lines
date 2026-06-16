import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { FrameProvider } from './FrameContext';
import { PostProcessProvider } from './PostProcessContext';
import { OutputProvider } from './OutputContext';
import { FrameControls } from './components/FrameControls';
import { PostProcessingControls } from './components/PostProcessingControls';
import { ProjectTabs } from './components/ProjectTabs';
import { PROJECTS } from './projects/registry';
import type { ProjectModule } from './projects/types';

/** Badge marking a settings section as shared across every tool. */
function UniversalBadge() {
  return <span className="scope-badge" title="These settings apply to every tool">Applies to all tools</span>;
}

/**
 * Nest every project's Provider (in registry order, stable across renders so
 * React keeps each project's state) around the shell. Each Provider is told
 * whether its project is the active tab, so off-screen projects idle their
 * side-effects while keeping their in-progress work.
 */
function composeProviders(
  projects: ProjectModule[],
  selectedProject: string,
  children: ReactNode
): ReactNode {
  return projects.reduceRight<ReactNode>((acc, project) => {
    const Provider = project.Provider;
    if (!Provider) return acc;
    return <Provider active={project.id === selectedProject}>{acc}</Provider>;
  }, children);
}

// How much of the bottom sheet peeks above the fold when collapsed (the grab
// handle bar), in px.
const SHEET_PEEK = 60;

export function App() {
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0].id);
  const [selectedFeature, setSelectedFeature] = useState(PROJECTS[0].features[0].id);
  // Desktop: the controls collapse to full-screen the art pane.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mobile: the controls are a bottom sheet that peeks above the art and drags
  // up to expand. Collapsed by default so the art is full-height on load.
  const [isMobile, setIsMobile] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startY: number; base: number } | null>(null);

  const activeProject =
    PROJECTS.find((p) => p.id === selectedProject) ?? PROJECTS[0];
  const activeFeature =
    activeProject.features.find((f) => f.id === selectedFeature) ?? activeProject.features[0];

  const onSelectProject = useCallback((id: string) => {
    setSelectedProject(id);
    const project = PROJECTS.find((p) => p.id === id);
    if (project) setSelectedFeature(project.features[0].id);
  }, []);

  // Track the phone breakpoint (matches the CSS media query) so the sheet
  // gestures only run on mobile.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Distance the sheet is pushed down when collapsed = its height minus the
  // peeking handle. Read live so it tracks the viewport.
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
    // A tap (negligible travel) toggles; a real drag snaps to the nearer stop.
    if (Math.abs(off - base) < 6) {
      setSheetExpanded((v) => !v);
    } else {
      setSheetExpanded(off < collapsedOffset() / 2);
    }
    dragRef.current = null;
    setDragOffset(null);
  }, [dragOffset, collapsedOffset]);

  const ActiveControls = activeFeature.Controls;
  const ActiveCanvas = activeFeature.Canvas;

  const dragging = dragOffset != null;
  // Only drive the transform inline while a finger is down (1:1 tracking); the
  // snapped open/closed positions are handled in CSS (.sheet-expanded), which
  // also reserves the matching space for the art pane so the drawing is never
  // covered.
  const sheetTransform = isMobile && dragging ? `translateY(${dragOffset}px)` : undefined;

  const shell = (
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

        <ProjectTabs
          projects={PROJECTS}
          selectedProject={selectedProject}
          selectedFeature={activeFeature.id}
          onSelectProject={onSelectProject}
          onSelectFeature={setSelectedFeature}
        />

        {/* Universal: the page frame, shared by every tool. */}
        <section className="scope-group scope-universal">
          <div className="scope-head">
            <span className="scope-name">Page</span>
            <UniversalBadge />
          </div>
          <FrameControls />
        </section>

        {/* Module: just the active tool's own settings. */}
        <section className="scope-group scope-module">
          <div className="scope-head">
            <span className="scope-name">{activeProject.label}</span>
            <span className="scope-badge module" title="These settings apply only to this tool">
              This tool
            </span>
          </div>
          <ActiveControls />
        </section>

        {/* Universal: post-processing + download, shared by every tool. */}
        <section className="scope-group scope-universal">
          <div className="scope-head">
            <span className="scope-name">Output &amp; post-processing</span>
            <UniversalBadge />
          </div>
          <PostProcessingControls />
        </section>

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
        <ActiveCanvas />
      </main>
    </div>
  );

  return (
    <FrameProvider>
      <PostProcessProvider>
        <OutputProvider>{composeProviders(PROJECTS, selectedProject, shell)}</OutputProvider>
      </PostProcessProvider>
    </FrameProvider>
  );
}
