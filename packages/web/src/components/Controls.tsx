import { useState } from 'react';
import type { AppState } from '../App';

interface ControlsProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

type Tab = 'lines' | 'noise' | 'canvas';

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

export function Controls({ state, updateState }: ControlsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('lines');

  const applyPreset = (width: number, height: number) => {
    updateState({ width, height });
  };

  return (
    <div className="controls">
      {/* Segmented control for tabs */}
      <div className="segment-control">
        <button
          type="button"
          className={activeTab === 'lines' ? 'active' : ''}
          onClick={() => setActiveTab('lines')}
        >
          Lines
        </button>
        <button
          type="button"
          className={activeTab === 'noise' ? 'active' : ''}
          onClick={() => setActiveTab('noise')}
        >
          Noise
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
        {activeTab === 'lines' && (
          <>
            <div className="control-row">
              <label>Count</label>
              <input
                type="range"
                min="10"
                max="2000"
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

            <div className="control-row">
              <label>Stroke</label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={state.strokeWidth}
                onChange={(e) => updateState({ strokeWidth: parseFloat(e.target.value) })}
              />
              <span className="value">{state.strokeWidth}</span>
            </div>
          </>
        )}

        {activeTab === 'noise' && (
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
              <label>Lacunarity</label>
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
          </>
        )}
      </div>
    </div>
  );
}
