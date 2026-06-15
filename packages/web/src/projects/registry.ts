import type { ProjectModule } from './types';
import { imageInkProject } from './image-ink';
import { flowFieldProject } from './flow-field';

/**
 * Every art project in the app, in tab order. Image → Ink and Flow Field are
 * the built-in pair; new projects are added here as their `art/<project>/…`
 * work merges.
 */
export const PROJECTS: ProjectModule[] = [imageInkProject, flowFieldProject];
