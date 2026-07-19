import { ColorField } from '../../components/ColorField';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { FlowState } from './types';

/** Roll a whole new field — every line/noise knob inside its slider range,
 *  biased off the extremes (line count and spacing stay well clear of the
 *  render-time cliffs at the dense end). Painted seed points and the pen/ink
 *  prefs are left alone. Exported for the genome test. */
export function randomFlowGenome(rng: () => number): Partial<FlowState> {
  return {
    denseFill: rng() < 0.35,
    lineCount: 100 + 10 * Math.floor(rng() * 121),
    lineSpacingMm: Number((1.5 + 0.5 * Math.floor(rng() * 10)).toFixed(1)),
    stepLength: 1 + 0.5 * Math.floor(rng() * 11),
    maxSteps: 100 + 50 * Math.floor(rng() * 15),
    noiseScale: Number((0.002 + 0.001 * Math.floor(rng() * 11)).toFixed(3)),
    octaves: 1 + Math.floor(rng() * 6),
    persistence: Number((0.25 + rng() * 0.5).toFixed(2)),
    lacunarity: Number((1.5 + rng() * 1.5).toFixed(1)),
  };
}

/** Sidebar controls for the Flow Field module. */
export function FlowFieldControls({ state, update }: ControlsProps<FlowState>) {
  const updateState = update;
  const surprise = () => update({ ...randomFlowGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a whole new field — or tune anything below." />

      <div className="paint-section">
        <h3 className="section-title">Paint Mode</h3>

        <div className="control-group">
          <div className="paint-controls">
            <button
              type="button"
              className={state.paintMode ? 'primary active' : 'primary'}
              onClick={() => update({ paintMode: !state.paintMode })}
            >
              {state.paintMode ? 'Stop Painting' : 'Start Painting'}
            </button>
            {state.paintedPoints.length > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => update({ paintedPoints: [] })}
              >
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
        <Slider
          label="Line Spacing"
          value={state.lineSpacingMm}
          min={0.5}
          max={10}
          step={0.5}
          onChange={(v) => updateState({ lineSpacingMm: v })}
          format={(v) => `${v.toFixed(1)}mm`}
        />
      ) : (
        <Slider
          label="Line Count"
          value={state.lineCount}
          min={10}
          max={3000}
          step={10}
          onChange={(v) => updateState({ lineCount: v })}
        />
      )}

      <Slider
        label="Step Length"
        value={state.stepLength}
        min={1}
        max={10}
        step={0.5}
        onChange={(v) => updateState({ stepLength: v })}
      />

      <Slider
        label="Max Steps"
        value={state.maxSteps}
        min={50}
        max={1000}
        step={50}
        onChange={(v) => updateState({ maxSteps: v })}
      />

      <h3 className="section-title">Noise Field</h3>

      <Slider
        label="Noise Scale"
        value={state.noiseScale}
        min={0.001}
        max={0.02}
        step={0.001}
        onChange={(v) => updateState({ noiseScale: v })}
        format={(v) => v.toFixed(4)}
      />

      <Slider
        label="Octaves"
        value={state.octaves}
        min={1}
        max={8}
        step={1}
        onChange={(v) => updateState({ octaves: v })}
      />

      <Slider
        label="Persistence"
        value={state.persistence}
        min={0.1}
        max={0.9}
        step={0.05}
        onChange={(v) => updateState({ persistence: v })}
        format={(v) => v.toFixed(2)}
      />

      <Slider
        label="Lacunarity"
        value={state.lacunarity}
        min={1}
        max={4}
        step={0.1}
        onChange={(v) => updateState({ lacunarity: v })}
        format={(v) => v.toFixed(1)}
      />

      <h3 className="section-title">Style</h3>

      <Slider
        label="Pen Width"
        value={state.penWidthMm}
        min={0.1}
        max={1.5}
        step={0.05}
        onChange={(v) => updateState({ penWidthMm: v })}
        format={(v) => `${v}mm`}
      />

      <ColorField
        label="Stroke Color"
        value={state.strokeColor}
        onChange={(strokeColor) => updateState({ strokeColor })}
      />

      <h3 className="section-title">Seed</h3>

      <SeedControl seed={state.seed} onChange={(seed) => updateState({ seed })} />
    </div>
  );
}
