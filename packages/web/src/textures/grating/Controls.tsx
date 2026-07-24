import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { GratingFields } from './GratingFields';
import { randomGratingGenome, type GratingParams } from './shared';

/** Grating controls for the grating module's panel — the full generative set,
 * including drawing the band centreline on the canvas (the layer-stack canvas
 * wires the selected layer's `drawMode`/`maskPath` to the paint interaction). */
export function GratingTextureControls({ state, update }: ControlsProps<GratingParams>) {
  const surprise = () => update({ ...randomGratingGenome(Math.random), seed: randomSeed() });

  const bandControls = (
    <div className="control-group">
      <div className="paint-controls">
        <button
          type="button"
          className={state.drawMode ? 'primary active' : 'primary'}
          onClick={() => update({ drawMode: !state.drawMode })}
        >
          {state.drawMode ? 'Stop drawing' : 'Draw line'}
        </button>
        {state.maskPath.length > 0 && (
          <button type="button" className="secondary" onClick={() => update({ maskPath: [] })}>
            Clear ({state.maskPath.length})
          </button>
        )}
      </div>
      <p className="paint-hint">
        {state.drawMode
          ? 'Drag across the canvas to lay down the band centreline.'
          : 'Tap “Draw line”, then drag on the canvas. The pattern fills a band either side of it.'}
      </p>
    </div>
  );

  return (
    <>
      <RandomiseButton onClick={surprise} hint="One roll for a fresh grating — inks and masks stay your choice." />
      <GratingFields
        params={state}
        update={update}
        maskModes={['none', 'strips', 'band', 'rect', 'ellipse', 'blob']}
        bandControls={bandControls}
      />
    </>
  );
}
