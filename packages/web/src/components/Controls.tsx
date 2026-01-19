import { useState } from 'react';
import type { AppState } from '../App';
import { FIELD_PRESETS, type PresetName } from '../App';
import type { FieldMode } from '@flow-lines/core';

interface ControlsProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

type Tab = 'style' | 'lines' | 'pattern' | 'canvas';

// Paper size presets (in pixels at 96 DPI for screen, scalable for print)
const PAPER_PRESETS = [
  { name: 'A4', width: 794, height: 1123 },
  { name: 'A4 Landscape', width: 1123, height: 794 },
  { name: 'A3', width: 1123, height: 1587 },
  { name: 'A5', width: 559, height: 794 },
  { name: 'Letter', width: 816, height: 1056 },
  { name: 'Square', width: 800, height: 800 },
  { name: 'Instagram', width: 1080, height: 1080 },
  { name: '4:5 Portrait', width: 800, height: 1000 },
  { name: '16:9 Wide', width: 1200, height: 675 },
] as const;

const FIELD_MODE_NAMES: Record<FieldMode, string> = {
  normal: 'Classic',
  curl: 'Curl',
  spiral: 'Spiral',
  turbulent: 'Turbulent',
  ridged: 'Ridged',
  warped: 'Warped',
};

export function Controls({ state, updateState }: ControlsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('style');

  const applyPreset = (width: number, height: number) => {
    updateState({ width, height });
  };

  const applyStylePreset = (presetName: PresetName) => {
    const preset = FIELD_PRESETS[presetName] as {
      fieldMode: FieldMode;
      noiseScale: number;
      octaves: number;
      persistence: number;
      lacunarity: number;
      smoothing: number;
      spiralStrength?: number;
      warpStrength?: number;
      lineCount?: number;
      maxSteps?: number;
      stepLength?: number;
      separationDistance?: number;
      bidirectional?: boolean;
      evenDistribution?: boolean;
      fillMode?: boolean;
      strokeWidth?: number;
    };
    updateState({
      fieldMode: preset.fieldMode,
      noiseScale: preset.noiseScale,
      octaves: preset.octaves,
      persistence: preset.persistence,
      lacunarity: preset.lacunarity,
      smoothing: preset.smoothing,
      ...(preset.spiralStrength !== undefined && { spiralStrength: preset.spiralStrength }),
      ...(preset.warpStrength !== undefined && { warpStrength: preset.warpStrength }),
      ...(preset.lineCount !== undefined && { lineCount: preset.lineCount }),
      ...(preset.maxSteps !== undefined && { maxSteps: preset.maxSteps }),
      ...(preset.stepLength !== undefined && { stepLength: preset.stepLength }),
      ...(preset.separationDistance !== undefined && { separationDistance: preset.separationDistance }),
      ...(preset.bidirectional !== undefined && { bidirectional: preset.bidirectional }),
      ...(preset.evenDistribution !== undefined && { evenDistribution: preset.evenDistribution }),
      ...(preset.fillMode !== undefined && { fillMode: preset.fillMode }),
      ...(preset.strokeWidth !== undefined && { strokeWidth: preset.strokeWidth }),
    });
  };

  return (
    <div className="controls">
      {/* Segmented control for tabs */}
      <div className="segment-control">
        <button
          type="button"
          className={activeTab === 'style' ? 'active' : ''}
          onClick={() => setActiveTab('style')}
        >
          Style
        </button>
        <button
          type="button"
          className={activeTab === 'lines' ? 'active' : ''}
          onClick={() => setActiveTab('lines')}
        >
          Lines
        </button>
        <button
          type="button"
          className={activeTab === 'pattern' ? 'active' : ''}
          onClick={() => setActiveTab('pattern')}
        >
          Pattern
        </button>
        <button
          type="button"
          className={activeTab === 'canvas' ? 'active' : ''}
          onClick={() => setActiveTab('canvas')}
        >
          Canvas
        </button>
      </div>

      {/* Tab content */}
      <div className="controls-content">
        {activeTab === 'style' && (
          <>
            <div className="presets-label">Presets</div>
            <div className="presets-grid">
              {(Object.keys(FIELD_PRESETS) as PresetName[]).map((presetName) => (
                <button
                  key={presetName}
                  type="button"
                  className={`preset-btn ${state.fieldMode === FIELD_PRESETS[presetName].fieldMode ? 'active' : ''}`}
                  onClick={() => applyStylePreset(presetName)}
                >
                  {FIELD_PRESETS[presetName].name}
                </button>
              ))}
            </div>

            <div className="presets-label" style={{ marginTop: 16 }}>Field Mode</div>
            <div className="presets-grid">
              {(Object.keys(FIELD_MODE_NAMES) as FieldMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`preset-btn ${state.fieldMode === mode ? 'active' : ''}`}
                  onClick={() => updateState({ fieldMode: mode })}
                >
                  {FIELD_MODE_NAMES[mode]}
                </button>
              ))}
            </div>

            <div className="control-row" style={{ marginTop: 16 }}>
              <label>Smoothing</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={state.smoothing}
                onChange={(e) => updateState({ smoothing: parseFloat(e.target.value) })}
              />
              <span className="value">{state.smoothing.toFixed(1)}</span>
            </div>

            {state.fieldMode === 'spiral' && (
              <div className="control-row">
                <label>Spiral</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={state.spiralStrength}
                  onChange={(e) => updateState({ spiralStrength: parseFloat(e.target.value) })}
                />
                <span className="value">{state.spiralStrength.toFixed(2)}</span>
              </div>
            )}

            {state.fieldMode === 'warped' && (
              <div className="control-row">
                <label>Warp</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={state.warpStrength}
                  onChange={(e) => updateState({ warpStrength: parseFloat(e.target.value) })}
                />
                <span className="value">{state.warpStrength.toFixed(2)}</span>
              </div>
            )}
          </>
        )}

        {activeTab === 'lines' && (
          <>
            <div className="control-row">
              <label>Count</label>
              <input
                type="range"
                min="10"
                max="5000"
                step="10"
                value={state.lineCount}
                onChange={(e) => updateState({ lineCount: parseInt(e.target.value, 10) })}
              />
              <span className="value">{state.lineCount}</span>
            </div>

            <div className="control-row">
              <label>Max Steps</label>
              <input
                type="range"
                min="20"
                max="2000"
                step="20"
                value={state.maxSteps}
                onChange={(e) => updateState({ maxSteps: parseInt(e.target.value, 10) })}
              />
              <span className="value">{state.maxSteps}</span>
            </div>

            <div className="control-row">
              <label>Step</label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={state.stepLength}
                onChange={(e) => updateState({ stepLength: parseFloat(e.target.value) })}
              />
              <span className="value">{state.stepLength}</span>
            </div>

            <div className="control-row">
              <label>Separation</label>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={state.separationDistance}
                onChange={(e) => updateState({ separationDistance: parseInt(e.target.value, 10) })}
              />
              <span className="value">{state.separationDistance}</span>
            </div>

            <div className="toggles-row">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={state.formHatchingMode}
                  onChange={(e) => updateState({ formHatchingMode: e.target.checked, swarmMode: false, fillMode: false })}
                />
                <span>Form hatching</span>
              </label>
              {!state.formHatchingMode && (
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={state.swarmMode}
                    onChange={(e) => updateState({ swarmMode: e.target.checked, fillMode: e.target.checked ? false : state.fillMode })}
                  />
                  <span>Swarm mode</span>
                </label>
              )}
              {!state.swarmMode && !state.formHatchingMode && (
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={state.fillMode}
                    onChange={(e) => updateState({ fillMode: e.target.checked })}
                  />
                  <span>Fill mode</span>
                </label>
              )}
              {!state.fillMode && !state.swarmMode && !state.formHatchingMode && (
                <>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={state.bidirectional}
                      onChange={(e) => updateState({ bidirectional: e.target.checked })}
                    />
                    <span>Bidirectional</span>
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={state.evenDistribution}
                      onChange={(e) => updateState({ evenDistribution: e.target.checked })}
                    />
                    <span>Uniform spread</span>
                  </label>
                </>
              )}
            </div>

            {/* Swarm mode controls */}
            {state.swarmMode && (
              <>
                <div className="presets-label" style={{ marginTop: 16 }}>Swarm Behavior</div>

                <div className="control-row">
                  <label>Agents</label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="10"
                    value={state.swarmAgentCount}
                    onChange={(e) => updateState({ swarmAgentCount: parseInt(e.target.value, 10) })}
                  />
                  <span className="value">{state.swarmAgentCount}</span>
                </div>

                <div className="control-row">
                  <label>Clustering</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.swarmClusterBias}
                    onChange={(e) => updateState({ swarmClusterBias: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.swarmClusterBias.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Child spawn</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.swarmChildSpawnRate}
                    onChange={(e) => updateState({ swarmChildSpawnRate: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.swarmChildSpawnRate.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Flow follow</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.swarmFlowInfluence}
                    onChange={(e) => updateState({ swarmFlowInfluence: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.swarmFlowInfluence.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Attraction</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.swarmClusterAttraction}
                    onChange={(e) => updateState({ swarmClusterAttraction: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.swarmClusterAttraction.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>3D form</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.swarmFormInfluence}
                    onChange={(e) => updateState({ swarmFormInfluence: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.swarmFormInfluence.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Void size</label>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={state.swarmVoidSize}
                    onChange={(e) => updateState({ swarmVoidSize: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.swarmVoidSize.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Length variation</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.swarmEnergyVariation}
                    onChange={(e) => updateState({ swarmEnergyVariation: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.swarmEnergyVariation.toFixed(2)}</span>
                </div>
              </>
            )}

            {/* Form hatching controls */}
            {state.formHatchingMode && (
              <>
                <div className="presets-label" style={{ marginTop: 16 }}>Form Hatching</div>

                <div className="control-row">
                  <label>Form scale</label>
                  <input
                    type="range"
                    min="0.001"
                    max="0.01"
                    step="0.0005"
                    value={state.formScale}
                    onChange={(e) => updateState({ formScale: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.formScale.toFixed(4)}</span>
                </div>

                <div className="control-row">
                  <label>Contrast</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.formContrast}
                    onChange={(e) => updateState({ formContrast: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.formContrast.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Density</label>
                  <input
                    type="range"
                    min="0.2"
                    max="3"
                    step="0.1"
                    value={state.hatchDensity}
                    onChange={(e) => updateState({ hatchDensity: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.hatchDensity.toFixed(1)}</span>
                </div>

                <div className="control-row">
                  <label>Length variation</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.hatchLengthVariation}
                    onChange={(e) => updateState({ hatchLengthVariation: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.hatchLengthVariation.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Angle variation</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.hatchAngleVariation}
                    onChange={(e) => updateState({ hatchAngleVariation: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.hatchAngleVariation.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Wobble</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.organicWobble}
                    onChange={(e) => updateState({ organicWobble: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.organicWobble.toFixed(2)}</span>
                </div>
              </>
            )}

            {state.fillMode && !state.swarmMode && (
              <>
                <div className="toggles-row" style={{ marginTop: 12 }}>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={state.variableDensity}
                      onChange={(e) => updateState({ variableDensity: e.target.checked })}
                    />
                    <span>Fill density</span>
                  </label>
                </div>

                {state.variableDensity && (
                  <>
                    <div className="control-row">
                      <label>Density</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={state.densityVariation}
                        onChange={(e) => updateState({ densityVariation: parseFloat(e.target.value) })}
                      />
                      <span className="value">{state.densityVariation.toFixed(2)}</span>
                    </div>

                    <div className="control-row">
                      <label>Min Sep</label>
                      <input
                        type="range"
                        min="0.5"
                        max="5"
                        step="0.5"
                        value={state.minSeparation}
                        onChange={(e) => updateState({ minSeparation: parseFloat(e.target.value) })}
                      />
                      <span className="value">{state.minSeparation.toFixed(1)}</span>
                    </div>
                  </>
                )}

                {state.densityPoints.length > 0 && (
                  <div className="density-points-info">
                    {state.densityPoints.length} density point{state.densityPoints.length !== 1 ? 's' : ''} placed
                  </div>
                )}
              </>
            )}

            {/* Organic aesthetics section - only shown in fill mode */}
            {state.fillMode && (
              <>
                <div className="presets-label" style={{ marginTop: 16 }}>Organic Feel</div>

                <div className="control-row">
                  <label>Line wobble</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.organicWobble}
                    onChange={(e) => updateState({ organicWobble: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.organicWobble.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Edge attraction</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.edgeAttraction}
                    onChange={(e) => updateState({ edgeAttraction: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.edgeAttraction.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Line fatigue</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.lineFatigue}
                    onChange={(e) => updateState({ lineFatigue: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.lineFatigue.toFixed(2)}</span>
                </div>

                <div className="control-row">
                  <label>Spacing variation</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.spacingVariation}
                    onChange={(e) => updateState({ spacingVariation: parseFloat(e.target.value) })}
                  />
                  <span className="value">{state.spacingVariation.toFixed(2)}</span>
                </div>

                <div className="toggles-row" style={{ marginTop: 8 }}>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={state.velocityFadeout}
                      onChange={(e) => updateState({ velocityFadeout: e.target.checked })}
                    />
                    <span>Soft endings</span>
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'pattern' && (
          <>
            <div className="control-row">
              <label>Scale</label>
              <input
                type="range"
                min="0.001"
                max="0.02"
                step="0.001"
                value={state.noiseScale}
                onChange={(e) => updateState({ noiseScale: parseFloat(e.target.value) })}
              />
              <span className="value">{state.noiseScale.toFixed(3)}</span>
            </div>

            <div className="control-row">
              <label>Octaves</label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={state.octaves}
                onChange={(e) => updateState({ octaves: parseInt(e.target.value, 10) })}
              />
              <span className="value">{state.octaves}</span>
            </div>

            <div className="control-row">
              <label>Detail</label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={state.persistence}
                onChange={(e) => updateState({ persistence: parseFloat(e.target.value) })}
              />
              <span className="value">{state.persistence.toFixed(2)}</span>
            </div>

            <div className="control-row">
              <label>Complexity</label>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={state.lacunarity}
                onChange={(e) => updateState({ lacunarity: parseFloat(e.target.value) })}
              />
              <span className="value">{state.lacunarity.toFixed(1)}</span>
            </div>

            <div className="control-row">
              <label>Seed</label>
              <input
                type="number"
                value={state.seed}
                onChange={(e) => updateState({ seed: parseInt(e.target.value, 10) || 0 })}
                className="seed-input"
              />
            </div>
          </>
        )}

        {activeTab === 'canvas' && (
          <>
            <div className="presets-label">Paper Sizes</div>
            <div className="presets-grid">
              {PAPER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={`preset-btn ${state.width === preset.width && state.height === preset.height ? 'active' : ''}`}
                  onClick={() => applyPreset(preset.width, preset.height)}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="presets-label" style={{ marginTop: 16 }}>Custom Size</div>

            <div className="control-row">
              <label>Width</label>
              <input
                type="range"
                min="200"
                max="1600"
                step="50"
                value={state.width}
                onChange={(e) => updateState({ width: parseInt(e.target.value, 10) })}
              />
              <span className="value">{state.width}</span>
            </div>

            <div className="control-row">
              <label>Height</label>
              <input
                type="range"
                min="200"
                max="1600"
                step="50"
                value={state.height}
                onChange={(e) => updateState({ height: parseInt(e.target.value, 10) })}
              />
              <span className="value">{state.height}</span>
            </div>

            <div className="size-display">
              {state.width} × {state.height} px
            </div>

            <div className="presets-label" style={{ marginTop: 16 }}>Output Settings</div>

            <div className="control-row">
              <label>Stroke</label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={state.strokeWidth}
                onChange={(e) => updateState({ strokeWidth: parseFloat(e.target.value) })}
              />
              <span className="value">{state.strokeWidth.toFixed(1)}</span>
            </div>

            <div className="control-row">
              <label>Margin</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={state.margin}
                onChange={(e) => updateState({ margin: parseInt(e.target.value, 10) })}
              />
              <span className="value">{state.margin}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
