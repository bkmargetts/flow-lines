import { useState, useCallback, type ReactNode } from 'react';
import { FrameProvider } from './FrameContext';
import { FrameControls } from './components/FrameControls';
import { ProjectTabs } from './components/ProjectTabs';
import { PROJECTS } from './projects/registry';
import type { ProjectModule } from './projects/types';

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

export function App() {
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0].id);
  const [selectedFeature, setSelectedFeature] = useState(PROJECTS[0].features[0].id);

  const activeProject =
    PROJECTS.find((p) => p.id === selectedProject) ?? PROJECTS[0];
  const activeFeature =
    activeProject.features.find((f) => f.id === selectedFeature) ?? activeProject.features[0];

  const onSelectProject = useCallback((id: string) => {
    setSelectedProject(id);
    const project = PROJECTS.find((p) => p.id === id);
    if (project) setSelectedFeature(project.features[0].id);
  }, []);

  const ActiveControls = activeFeature.Controls;
  const ActiveCanvas = activeFeature.Canvas;

  const shell = (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Flow Lines</h1>
          <p className="subtitle">Generative Art for Pen Plotters</p>
        </div>

        <ProjectTabs
          projects={PROJECTS}
          selectedProject={selectedProject}
          selectedFeature={activeFeature.id}
          onSelectProject={onSelectProject}
          onSelectFeature={setSelectedFeature}
        />

        <FrameControls />

        <ActiveControls />

        {/* Sticky fade hinting the controls scroll (notably the collapsed
            top pane on mobile). */}
        <div className="scroll-fade" aria-hidden="true" />
      </aside>

      <main className="canvas-container">
        <ActiveCanvas />
      </main>
    </div>
  );

  return <FrameProvider>{composeProviders(PROJECTS, selectedProject, shell)}</FrameProvider>;
}
