import { useConway } from './context';

/** Sidebar controls for the Conway Long Exposure project. */
export function ConwayControls() {
  const { state, updateState, randomizeSeed, downloadSVG } = useConway();

  return (
    <div className="controls">
      <h3 className="section-title">Exposure</h3>

      <div className="control-group">
        <label>
          Generations <span>{state.generations}</span>
        </label>
        <input
          type="range"
          min="20"
          max="400"
          step="10"
          value={state.generations}
          onChange={(e) => updateState({ generations: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Trail length (decay) <span>{state.decay.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.8"
          max="0.98"
          step="0.01"
          value={state.decay}
          onChange={(e) => updateState({ decay: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Grid cell size <span>{state.cellSize.toFixed(1)}mm</span>
        </label>
        <input
          type="range"
          min="1"
          max="4"
          step="0.1"
          value={state.cellSize}
          onChange={(e) => updateState({ cellSize: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          Pen Width <span>{state.penWidthMm}mm</span>
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
        <p className="paint-hint">
          The Game of Life is deterministic — the seed only sets where the
          R-pentomino sits and how it&apos;s turned.
        </p>
      </div>

      <details className="advanced">
        <summary>Advanced</summary>

        <details className="adv-group">
          <summary>Fade &amp; tiers</summary>

          <div className="control-group">
            <label>
              Trail brightness (gamma) <span>{state.gamma.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={state.gamma}
              onChange={(e) => updateState({ gamma: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Faint cutoff <span>{state.faintThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.02"
              value={state.faintThreshold}
              onChange={(e) => updateState({ faintThreshold: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Faint → medium <span>{state.mediumThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="0.6"
              step="0.02"
              value={state.mediumThreshold}
              onChange={(e) => updateState({ mediumThreshold: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Medium → solid <span>{state.solidThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.4"
              max="0.9"
              step="0.02"
              value={state.solidThreshold}
              onChange={(e) => updateState({ solidThreshold: parseFloat(e.target.value) })}
            />
          </div>
        </details>

        <details className="adv-group">
          <summary>Forms &amp; hand</summary>

          <div className="control-group">
            <label>
              Residue cluster size <span>{state.residueMaxCells}</span>
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={state.residueMaxCells}
              onChange={(e) => updateState({ residueMaxCells: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              Wobble <span>{state.wobble.toFixed(1)}px</span>
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={state.wobble}
              onChange={(e) => updateState({ wobble: parseFloat(e.target.value) })}
            />
          </div>
        </details>
      </details>

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG}>
          Download SVG
        </button>
      </div>
    </div>
  );
}
