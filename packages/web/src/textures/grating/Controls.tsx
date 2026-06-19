import { GratingFields } from './GratingFields';
import type { GratingParams } from './shared';

/** Grating controls for the grating module's panel — the full generative set,
 * including drawing the band centreline on the canvas (the layer-stack canvas
 * wires the selected layer's `drawMode`/`maskPath` to the paint interaction). */
export function GratingTextureControls({
  params,
  update,
}: {
  params: GratingParams;
  update: (updates: Partial<GratingParams>) => void;
}) {
  const bandControls = (
    <div className="control-group">
      <div className="paint-controls">
        <button
          type="button"
          className={params.drawMode ? 'primary active' : 'primary'}
          onClick={() => update({ drawMode: !params.drawMode })}
        >
          {params.drawMode ? 'Stop drawing' : 'Draw line'}
        </button>
        {params.maskPath.length > 0 && (
          <button type="button" className="secondary" onClick={() => update({ maskPath: [] })}>
            Clear ({params.maskPath.length})
          </button>
        )}
      </div>
      <p className="paint-hint">
        {params.drawMode
          ? 'Drag across the canvas to lay down the band centreline.'
          : 'Tap “Draw line”, then drag on the canvas. The pattern fills a band either side of it.'}
      </p>
    </div>
  );

  return (
    <GratingFields
      params={params}
      update={update}
      maskModes={['none', 'strips', 'band', 'rect', 'ellipse']}
      bandControls={bandControls}
    />
  );
}
