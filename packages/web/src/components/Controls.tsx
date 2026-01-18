import type { AppState, BrushType } from '../App';
import { Tooltip } from './Tooltip';

interface ControlsProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
  togglePaintMode: () => void;
  clearPaintedPoints: () => void;
  toggleAttractorMode: () => void;
  clearAttractors: () => void;
}

export function Controls({
  state,
  updateState,
  randomizeSeed,
  downloadSVG,
  togglePaintMode,
  clearPaintedPoints,
  toggleAttractorMode,
  clearAttractors,
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

      <div className="attractor-section">
        <h3 className="section-title">Attractors</h3>

        <div className="control-group">
          <div className="paint-controls">
            <button
              type="button"
              className={state.attractorMode ? 'primary active' : 'primary'}
              onClick={toggleAttractorMode}
            >
              {state.attractorMode ? 'Stop Placing' : 'Place Attractors'}
            </button>
            {state.attractors.length > 0 && (
              <button type="button" className="secondary" onClick={clearAttractors}>
                Clear ({state.attractors.length})
              </button>
            )}
          </div>

          {state.attractorMode && (
            <>
              <div className="brush-type-selector">
                <button
                  type="button"
                  className={state.attractorBrushType === 'attractor' ? 'primary small' : 'secondary small'}
                  onClick={() => updateState({ attractorBrushType: 'attractor' })}
                >
                  Attractor
                </button>
                <button
                  type="button"
                  className={state.attractorBrushType === 'repeller' ? 'primary small' : 'secondary small'}
                  onClick={() => updateState({ attractorBrushType: 'repeller' })}
                >
                  Repeller
                </button>
              </div>

              <Tooltip text="Radius of influence for attractors/repellers">
                <div className="control-group">
                  <label>
                    Radius <span>{state.attractorRadius}px</span>
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="150"
                    step="5"
                    value={state.attractorRadius}
                    onChange={(e) => updateState({ attractorRadius: parseInt(e.target.value, 10) })}
                  />
                </div>
              </Tooltip>

              <Tooltip text="How strongly lines are pulled or pushed. Higher = more dramatic curves.">
                <div className="control-group">
                  <label>
                    Strength <span>{state.attractorStrength.toFixed(1)}</span>
                  </label>
                  <input
                    type="range"
                    min="0.2"
                    max="3"
                    step="0.1"
                    value={state.attractorStrength}
                    onChange={(e) => updateState({ attractorStrength: parseFloat(e.target.value) })}
                  />
                </div>
              </Tooltip>
            </>
          )}

          {state.attractors.length > 0 && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={state.showAttractors}
                onChange={(e) => updateState({ showAttractors: e.target.checked })}
              />
              Show attractor zones
            </label>
          )}

          <p className="paint-hint">
            {state.attractorMode
              ? `Click on canvas to place ${state.attractorBrushType === 'attractor' ? 'an attractor (pulls lines)' : 'a repeller (pushes lines)'}`
              : state.attractors.length > 0
                ? `${state.attractors.length} zone${state.attractors.length !== 1 ? 's' : ''} placed. Lines curve toward/away from zones.`
                : 'Add attraction/repulsion zones to bend flow lines'}
          </p>
        </div>
      </div>

      <h3 className="section-title">Canvas</h3>

      <Tooltip text="Canvas width in pixels for the output SVG">
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
      </Tooltip>

      <Tooltip text="Canvas height in pixels for the output SVG">
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
      </Tooltip>

      <h3 className="section-title">Lines</h3>

      <Tooltip text="Number of flow lines to generate. Ignored when using paint mode with custom seed points.">
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
      </Tooltip>

      <Tooltip text="Distance each line travels per step. Smaller values create smoother, more detailed curves.">
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
      </Tooltip>

      <Tooltip text="Maximum length of each line before it stops. Higher values allow lines to travel further across the canvas.">
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
      </Tooltip>

      <Tooltip text="Empty border around the canvas edges. Lines won't start or extend into the margin area.">
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
      </Tooltip>

      <h3 className="section-title">Noise Field</h3>

      <Tooltip text="Zoom level of the noise field. Smaller values create larger, sweeping patterns. Larger values create tighter, more chaotic patterns.">
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
      </Tooltip>

      <Tooltip text="Layers of detail in the noise. More octaves add finer details on top of the base pattern.">
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
      </Tooltip>

      <Tooltip text="How much each octave contributes to the final pattern. Higher values make the fine details more prominent.">
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
      </Tooltip>

      <Tooltip text="Frequency multiplier between octaves. Higher values make each successive layer of detail much finer.">
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
      </Tooltip>

      <h3 className="section-title">Style</h3>

      <Tooltip text="Line thickness in the output SVG. For pen plotters, this should match your pen width.">
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
      </Tooltip>

      <Tooltip text="Line color in the output SVG. Accepts hex (#000000), rgb, or named colors.">
        <div className="control-group">
          <label>Stroke Color</label>
          <input
            type="text"
            value={state.strokeColor}
            onChange={(e) => updateState({ strokeColor: e.target.value })}
          />
        </div>
      </Tooltip>

      <h3 className="section-title">Seed</h3>

      <Tooltip text="Random seed for reproducible results. Same seed with same settings will always produce identical output.">
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
      </Tooltip>

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG}>
          Download SVG
        </button>
      </div>
    </div>
  );
}
