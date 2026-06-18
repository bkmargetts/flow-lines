import { InfoTip } from '../../components/InfoTip';
import { GratingFields } from '../../textures/grating/GratingFields';
import { useNoiseTexture } from './context';

/** Sidebar controls for the Noise Texture project — the shared grating fields
 * (with the drawn-line band mask wired to the canvas) plus pen width + export. */
export function NoiseTextureControls() {
  const { state, updateState, clearMaskPath, toggleDrawMode, downloadSVG, downloadLayers } =
    useNoiseTexture();

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
          <span>{state.penWidthMm.toFixed(2)}mm</span>
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

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG}>
          Download SVG
        </button>
        <button
          type="button"
          className="secondary"
          onClick={downloadLayers}
          title="One SVG per colour, zipped — plot each with a different pen"
        >
          Download layers (.zip)
        </button>
      </div>
    </div>
  );
}
