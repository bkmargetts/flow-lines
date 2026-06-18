import { GratingFields } from './GratingFields';
import type { GratingParams } from './shared';

/** Grating controls for the background-texture panel — the full generative set
 * with parametric masks only (the drawn-line band needs the project canvas). */
export function GratingTextureControls({
  params,
  update,
}: {
  params: GratingParams;
  update: (updates: Partial<GratingParams>) => void;
}) {
  return <GratingFields params={params} update={update} maskModes={['none', 'strips', 'rect', 'ellipse']} />;
}
