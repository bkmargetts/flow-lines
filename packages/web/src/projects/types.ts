import type { ComponentType, ReactNode } from 'react';

/**
 * A feature is a second-level tab within a project: one functional view,
 * contributing a sidebar control panel and a canvas pane. Features inside a
 * project share the project's Provider state.
 */
export interface FeatureModule {
  id: string;
  label: string;
  Controls: ComponentType;
  Canvas: ComponentType;
}

/**
 * A project is a top-level tab: an independent art tool that lives as code in
 * the app (under `src/projects/<id>/`). New projects are developed on
 * `art/<project>/<feature>` branches and register here.
 */
export interface ProjectModule {
  id: string;
  label: string;
  /**
   * Optional state shared by all of a project's features. Receives `active`
   * (whether this project's tab is currently selected) so its side-effects can
   * idle while off screen. Every project's Provider stays mounted for the
   * session, so switching tabs never loses in-progress work.
   */
  Provider?: ComponentType<{ active: boolean; children: ReactNode }>;
  features: FeatureModule[];
}
