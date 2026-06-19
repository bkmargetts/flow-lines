import type { FlowState } from '../projects/flow-field/types';
import { ColorField } from './ColorField';
import { EditableValue } from './EditableValue';

interface ControlsProps {
  state: FlowState;
  updateState: (updates: Partial<FlowState>) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
  downloadLayers?: () => void;
  hasLayers?: boolean;
  togglePaintMode: () => void;
  clearPaintedPoints: () => void;
}

export function Controls({
  state,
  updateState,
  randomizeSeed,
  downloadSVG,
  downloadLayers,
  hasLayers,
  togglePaintMode,
  clearPaintedPoints,
}: ControlsProps) {
  return (
    <div className="controls">
      <div className="paint-section">
        <h3 className="section-title">Paint Mode</h3>

        <div className="control-group">
          <div className="paint-controls">
            <button
              type="button"
              className={state.paintMode ? 'primary active' : 'primary'}
              onClick={togglePaintMode}
            >
              {state.paintMode ? 'Stop Painting' : 'Start Painting'}
            </button>
            {state.paintedPoints.length > 0 && (
              <button type="button" className="secondary" onClick={clearPaintedPoints}>
                Clear ({state.paintedPoints.length})
              </button>
            )}
          </div>
          {state.paintedPoints.length > 0 && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={state.showDots}
                onChange={(e) => updateState({ showDots: e.target.checked })}
              />
              Show seed points
            </label>
          )}
          <p className="paint-hint">
            {state.paintMode
              ? 'Click or drag on canvas to place flow line seeds'
              : state.paintedPoints.length > 0
                ? `${state.paintedPoints.length} points placed. Lines flow from your painted points.`
                : 'Paint your own starting points for flow lines instead of random placement'}
          </p>
        </div>
      </div>

      <h3 className="section-title">Lines</h3>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.denseFill}
            onChange={(e) => updateState({ denseFill: e.target.checked })}
          />
          Dense fill (evenly spaced)
        </label>
        <p className="paint-hint">
          {state.denseFill
            ? 'Lines pack the page evenly at the spacing below — no clumps or gaps.'
            : 'Scatter a fixed number of random lines.'}
        </p>
      </div>

      {state.denseFill ? (
        <div className="control-group">
          <label>
            Line Spacing{" "}
            <EditableValue
              value={state.lineSpacingMm}
              min={0.5}
              max={10}
              step={0.5}
              onChange={(v) => updateState({ lineSpacingMm: v })}
            >
              {state.lineSpacingMm.toFixed(1)}mm
            </EditableValue>
          </label>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={state.lineSpacingMm}
            onChange={(e) => updateState({ lineSpacingMm: parseFloat(e.target.value) })}
          />
        </div>
      ) : (
        <div className="control-group">
          <label>
            Line Count{" "}
            <EditableValue
              value={state.lineCount}
              min={10}
              max={3000}
              step={10}
              onChange={(v) => updateState({ lineCount: v })}
            >
              {state.lineCount}
            </EditableValue>
          </label>
          <input
            type="range"
            min="10"
            max="3000"
            step="10"
            value={state.lineCount}
            onChange={(e) => updateState({ lineCount: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      <div className="control-group">
        <label>
          Step Length{" "}
          <EditableValue
            value={state.stepLength}
            min={1}
            max={10}
            step={0.5}
            onChange={(v) => updateState({ stepLength: v })}
          >
            {state.stepLength}
          </EditableValue>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={state.stepLength}
          onChange={(e) => updateState({ stepLength: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Max Steps{" "}
          <EditableValue
            value={state.maxSteps}
            min={50}
            max={1000}
            step={50}
            onChange={(v) => updateState({ maxSteps: v })}
          >
            {state.maxSteps}
          </EditableValue>
        </label>
        <input
          type="range"
          min="50"
          max="1000"
          step="50"
          value={state.maxSteps}
          onChange={(e) => updateState({ maxSteps: parseInt(e.target.value, 10) })}
        />
      </div>

      <h3 className="section-title">Noise Field</h3>

      <div className="control-group">
        <label>
          Noise Scale{" "}
          <EditableValue
            value={state.noiseScale}
            min={0.001}
            max={0.02}
            step={0.001}
            onChange={(v) => updateState({ noiseScale: v })}
          >
            {state.noiseScale.toFixed(4)}
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.001"
          max="0.02"
          step="0.001"
          value={state.noiseScale}
          onChange={(e) => updateState({ noiseScale: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Octaves{" "}
          <EditableValue
            value={state.octaves}
            min={1}
            max={8}
            step={1}
            onChange={(v) => updateState({ octaves: v })}
          >
            {state.octaves}
          </EditableValue>
        </label>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={state.octaves}
          onChange={(e) => updateState({ octaves: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Persistence{" "}
          <EditableValue
            value={state.persistence}
            min={0.1}
            max={0.9}
            step={0.05}
            onChange={(v) => updateState({ persistence: v })}
          >
            {state.persistence.toFixed(2)}
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.1"
          max="0.9"
          step="0.05"
          value={state.persistence}
          onChange={(e) => updateState({ persistence: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Lacunarity{" "}
          <EditableValue
            value={state.lacunarity}
            min={1}
            max={4}
            step={0.1}
            onChange={(v) => updateState({ lacunarity: v })}
          >
            {state.lacunarity.toFixed(1)}
          </EditableValue>
        </label>
        <input
          type="range"
          min="1"
          max="4"
          step="0.1"
          value={state.lacunarity}
          onChange={(e) => updateState({ lacunarity: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          Pen Width{" "}
          <EditableValue
            value={state.penWidthMm}
            min={0.1}
            max={1.5}
            step={0.05}
            onChange={(v) => updateState({ penWidthMm: v })}
          >
            {state.penWidthMm}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.5"
          step="0.05"
          value={state.penWidthMm}
          onChange={(e) => updateState({ penWidthMm: parseFloat(e.target.value) })}
        />
      </div>

      <ColorField
        label="Stroke Color"
        value={state.strokeColor}
        onChange={(strokeColor) => updateState({ strokeColor })}
      />

      <h3 className="section-title">Seed</h3>

      <div className="control-group">
        <div className="seed-input">
          <input
            type="number"
            value={state.seed}
            onChange={(e) => updateState({ seed: parseInt(e.target.value, 10) || 0 })}
          />
          <button type="button" className="secondary" onClick={randomizeSeed}>
            🎲
          </button>
        </div>
      </div>

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG}>
          Download SVG
        </button>
        {hasLayers && downloadLayers && (
          <button
            type="button"
            className="secondary"
            onClick={downloadLayers}
            title="One SVG per pen layer (texture / drawing), zipped"
          >
            Download layers (.zip)
          </button>
        )}
      </div>
    </div>
  );
}
