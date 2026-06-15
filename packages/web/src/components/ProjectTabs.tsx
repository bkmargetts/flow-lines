import type { ProjectModule } from '../projects/types';

interface ProjectTabsProps {
  projects: ProjectModule[];
  selectedProject: string;
  selectedFeature: string;
  onSelectProject: (id: string) => void;
  onSelectFeature: (id: string) => void;
}

/**
 * Project navigation: a compact project-switcher dropdown (scales to many
 * projects, type-ahead searchable) and — when the active project has more
 * than one feature — a strip of feature sub-tab pills beneath it.
 */
export function ProjectTabs({
  projects,
  selectedProject,
  selectedFeature,
  onSelectProject,
  onSelectFeature,
}: ProjectTabsProps) {
  const active = projects.find((p) => p.id === selectedProject);
  const features = active?.features ?? [];

  return (
    <div className="project-switcher">
      <label className="project-switcher-label" htmlFor="project-select">
        Project
      </label>
      <select
        id="project-select"
        value={selectedProject}
        onChange={(e) => onSelectProject(e.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.label}
          </option>
        ))}
      </select>

      {features.length > 1 && (
        <div className="preset-row feature-strip">
          {features.map((feature) => (
            <button
              key={feature.id}
              type="button"
              className={feature.id === selectedFeature ? 'preset active' : 'preset'}
              onClick={() => onSelectFeature(feature.id)}
            >
              {feature.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
