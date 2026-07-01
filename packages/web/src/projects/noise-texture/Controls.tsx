import { InfoTip } from '../../components/InfoTip';
import { EditableValue } from '../../components/EditableValue';
import { SketchControls } from '../../components/SketchControls';
import { GratingFields } from '../../textures/grating/GratingFields';
import type { ControlsProps } from '../../modules/types';
import type { NoiseTextureState } from './types';

/** Sidebar controls for the Noise Texture module — the shared grating fields
 * (with the drawn-line band mask wired to the canvas) plus pen width. */
export function NoiseTextureControls({ state, update }: ControlsProps<NoiseTextureState>) {
  const updateState = update;
  const clearMaskPath = () => update({ maskPath: [] });
  const toggleDrawMode = () => update({ drawMode: !state.drawMode });

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
      <GratingFields params={state} update={updateState} bandControls={bandControls} />

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pen width
            <InfoTip text="Plotted line weight in millimetres. Thin pens keep the interleaved grating crisp." />
          </span>
          <EditableValue
            value={state.penWidthMm}
            min={0.05}
            max={0.8}
            step={0.05}
            onChange={(v) => updateState({ penWidthMm: v })}
          >
            {state.penWidthMm.toFixed(2)}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.05"
          max="0.8"
          step="0.05"
          value={state.penWidthMm}
          onChange={(e) => updateState({ penWidthMm: parseFloat(e.target.value) })}
        />
      </div>

      <SketchControls sketch={state.sketch} sketchStyle={state.sketchStyle} onChange={update} />
    </div>
  );
}
