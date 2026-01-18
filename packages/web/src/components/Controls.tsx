import type { AppState } from '../App';

interface ControlsProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
}

export function Controls({ state, updateState, randomizeSeed, downloadSVG }: ControlsProps) {
  return (
    <div className="controls">
      <h3 className="section-title">Canvas</h3>

      <div className="control-group">
        <label>
          Width <span>{state.width}px</span>
        </label>
        <input
          type="range"
          min="200"
          max="1200"
          step="50"
          value={state.width}
          onChange={(e) => updateState({ width: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Height <span>{state.height}px</span>
        </label>
        <input
          type="range"
          min="200"
          max="1200"
          step="50"
          value={state.height}
          onChange={(e) => updateState({ height: parseInt(e.target.value, 10) })}
        />
      </div>

      <h3 className="section-title">Lines</h3>

      <div className="control-group">
        <label>
          Line Count <span>{state.lineCount}</span>
        </label>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={state.lineCount}
          onChange={(e) => updateState({ lineCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Step Length <span>{state.stepLength}</span>
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
          Max Steps <span>{state.maxSteps}</span>
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

      <div className="control-group">
        <label>
          Margin <span>{state.margin}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={state.margin}
          onChange={(e) => updateState({ margin: parseInt(e.target.value, 10) })}
        />
      </div>

      <h3 className="section-title">Noise Field</h3>

      <div className="control-group">
        <label>
          Noise Scale <span>{state.noiseScale.toFixed(4)}</span>
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
          Octaves <span>{state.octaves}</span>
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
          Persistence <span>{state.persistence.toFixed(2)}</span>
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
          Lacunarity <span>{state.lacunarity.toFixed(1)}</span>
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
          Stroke Width <span>{state.strokeWidth}px</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.5"
          value={state.strokeWidth}
          onChange={(e) => updateState({ strokeWidth: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>Stroke Color</label>
        <input
          type="text"
          value={state.strokeColor}
          onChange={(e) => updateState({ strokeColor: e.target.value })}
        />
      </div>

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
      </div>
    </div>
  );
}
