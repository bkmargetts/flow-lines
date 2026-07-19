import { InfoTip } from '../../components/InfoTip';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { Slider } from '../../components/controls/Slider';
import { GratingFields } from '../../textures/grating/GratingFields';
import { randomGratingGenome } from '../../textures/grating/shared';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { NoiseTextureState } from './types';

/** Sidebar controls for the Noise Texture module — the shared grating fields
 * (with the drawn-line band mask wired to the canvas) plus pen width. */
export function NoiseTextureControls({ state, update }: ControlsProps<NoiseTextureState>) {
  const updateState = update;
  const clearMaskPath = () => update({ maskPath: [] });
  const toggleDrawMode = () => update({ drawMode: !state.drawMode });
  const surprise = () => update({ ...randomGratingGenome(Math.random), seed: randomSeed() });

  const bandControls = (
    <div className="control-group">
      <div className="paint-controls">
        <button
          type="button"
          className={state.drawMode ? 'primary active' : 'primary'}
          onClick={toggleDrawMode}
        >
          {state.drawMode ? 'Stop drawing' : 'Draw line'}
        </button>
        {state.maskPath.length > 0 && (
          <button type="button" className="secondary" onClick={clearMaskPath}>
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
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a fresh grating — inks and masks stay your choice." />

      <GratingFields params={state} update={updateState} bandControls={bandControls} />

      <h3 className="section-title">Style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Pen width
            <InfoTip text="Plotted line weight in millimetres. Thin pens keep the interleaved grating crisp." />
          </span>
        }
        value={state.penWidthMm}
        min={0.05}
        max={0.8}
        step={0.05}
        onChange={(v) => updateState({ penWidthMm: v })}
        format={(v) => `${v.toFixed(2)}mm`}
      />
    </div>
  );
}
