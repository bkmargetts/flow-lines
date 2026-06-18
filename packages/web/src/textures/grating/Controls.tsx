import { GratingFields } from './GratingFields';
import type { GratingParams } from './shared';
import { useFrame } from '../../FrameContext';

/** Grating controls for the background-texture panel — the full generative set,
 * with the drawn-line band wired to the active project's canvas via the frame. */
export function GratingTextureControls({
  params,
  update,
}: {
  params: GratingParams;
  update: (updates: Partial<GratingParams>) => void;
}) {
  const { frame, updateFrame } = useFrame();
  const drawing = frame.textureMaskDrawing;

  const bandControls = (
    <div className="control-group">
      <div className="paint-controls">
        <button
          type="button"
          className={drawing ? 'primary active' : 'primary'}
          onClick={() => updateFrame({ textureMaskDrawing: !drawing })}
        >
          {drawing ? 'Stop drawing' : 'Draw line'}
        </button>
        {params.maskPath.length > 0 && (
          <button type="button" className="secondary" onClick={() => update({ maskPath: [] })}>
            Clear ({params.maskPath.length})
          </button>
        )}
      </div>
      <p className="paint-hint">
        {drawing
          ? 'Drag across the canvas to lay down the band centreline.'
          : 'Tap “Draw line”, then drag on the canvas. The texture fills a band either side of it.'}
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
