import { GratingFields } from './GratingFields';
import type { GratingParams } from './shared';

/** Grating controls for the grating module's panel — the full generative set.
 * (Drawing the band centreline on the canvas is a per-layer interaction that is
 * not yet wired in the layer-stack canvas; the mask path can still be cleared.) */
export function GratingTextureControls({
  params,
  update,
}: {
  params: GratingParams;
  update: (updates: Partial<GratingParams>) => void;
}) {
  const bandControls =
    params.maskPath.length > 0 ? (
      <div className="control-group">
        <div className="paint-controls">
          <button type="button" className="secondary" onClick={() => update({ maskPath: [] })}>
            Clear band ({params.maskPath.length})
          </button>
        </div>
      </div>
    ) : undefined;

  return (
    <GratingFields
      params={params}
      update={update}
      maskModes={['none', 'strips', 'band', 'rect', 'ellipse']}
      bandControls={bandControls}
    />
  );
}
