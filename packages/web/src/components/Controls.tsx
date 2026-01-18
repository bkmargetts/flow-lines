import { useState } from 'react';
import type { AppState, BrushType } from '../App';
import { Tooltip } from './Tooltip';
import { Accordion } from './ControlPanel';

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="controls">
      {/* Quick actions - always visible */}
      <div className="quick-actions">
        <div className="seed-row">
          <Tooltip text="Random seed for reproducible results">
            <input
              type="number"
              value={state.seed}
              onChange={(e) => updateState({ seed: parseInt(e.target.value, 10) || 0 })}
              className="seed-input-field"
            />
          </Tooltip>
          <button type="button" className="icon-btn" onClick={randomizeSeed} aria-label="Randomize">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <Tooltip text="Number of flow lines to generate">
          <div className="control-group">
            <label>
              Lines <span>{state.lineCount}</span>
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

        <button type="button" className="primary download-btn" onClick={downloadSVG}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download SVG
        </button>
      </div>

      {/* Interactive modes */}
      <Accordion title="Paint Mode" defaultOpen={state.paintMode || state.paintedPoints.length > 0}>
        <div className="control-group">
          <div className="paint-controls">
            <button
              type="button"
              className={state.paintMode ? 'primary active' : 'secondary'}
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
          <p className="hint">
            {state.paintMode
              ? 'Click or drag to place flow line seeds'
              : 'Paint starting points for flow lines'}
          </p>
        </div>
      </Accordion>

      <Accordion title="Attractors" defaultOpen={state.attractorMode || state.attractors.length > 0}>
        <div className="control-group">
          <div className="paint-controls">
            <button
              type="button"
              className={state.attractorMode ? 'primary active' : 'secondary'}
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
                  className={state.attractorBrushType === 'attractor' ? 'attractor-btn active' : 'attractor-btn'}
                  onClick={() => updateState({ attractorBrushType: 'attractor' })}
                >
                  Attract
                </button>
                <button
                  type="button"
                  className={state.attractorBrushType === 'repeller' ? 'repeller-btn active' : 'repeller-btn'}
                  onClick={() => updateState({ attractorBrushType: 'repeller' })}
                >
                  Repel
                </button>
              </div>

              <Tooltip text="Radius of influence">
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

              <Tooltip text="How strongly lines are pulled or pushed">
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
              Show zones
            </label>
          )}

          <p className="hint">
            {state.attractorMode
              ? `Click to place ${state.attractorBrushType === 'attractor' ? 'attractor' : 'repeller'}`
              : 'Add zones to bend flow lines'}
          </p>
        </div>
      </Accordion>

      {/* Advanced toggle */}
      <button
        type="button"
        className="advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
        <svg
          className={`toggle-icon ${showAdvanced ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Advanced controls */}
      {showAdvanced && (
        <div className="advanced-controls">
          <Accordion title="Canvas">
            <Tooltip text="Canvas width in pixels">
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

            <Tooltip text="Canvas height in pixels">
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
          </Accordion>

          <Accordion title="Lines">
            <Tooltip text="Distance each line travels per step">
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

            <Tooltip text="Maximum length of each line">
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

            <Tooltip text="Empty border around edges">
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
          </Accordion>

          <Accordion title="Noise Field">
            <Tooltip text="Zoom level of the noise pattern">
              <div className="control-group">
                <label>
                  Scale <span>{state.noiseScale.toFixed(4)}</span>
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

            <Tooltip text="Layers of detail in the noise">
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

            <Tooltip text="Contribution of each octave">
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

            <Tooltip text="Frequency multiplier between octaves">
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
          </Accordion>

          <Accordion title="Style">
            <Tooltip text="Line thickness">
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

            <Tooltip text="Line color">
              <div className="control-group">
                <label>Stroke Color</label>
                <input
                  type="text"
                  value={state.strokeColor}
                  onChange={(e) => updateState({ strokeColor: e.target.value })}
                />
              </div>
            </Tooltip>
          </Accordion>
        </div>
      )}
    </div>
  );
}
