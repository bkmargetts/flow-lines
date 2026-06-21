import { ColorField, PalettePicker } from '../../components/ColorField';
import { EditableValue } from '../../components/EditableValue';
import type { ControlsProps } from '../../modules/types';
import type { VenationState } from './types';

/** Sidebar controls for the Leaf Venation module. */
export function VenationControls({ state, update }: ControlsProps<VenationState>) {
  const updateState = update;
  const randomizeSeed = () => update({ seed: Math.floor(Math.random() * 1000000) });

  return (
    <div className="controls">
      <h3 className="section-title">Region</h3>

      <div className="control-group">
        <label className="label-text">Shape</label>
        <select
          value={state.region}
          onChange={(e) => updateState({ region: e.target.value as VenationState['region'] })}
        >
          <option value="leaf">Leaf</option>
          <option value="ellipse">Ellipse</option>
          <option value="rect">Rectangle</option>
        </select>
      </div>

      <h3 className="section-title">Attractors</h3>

      <div className="control-group">
        <label>
          Attractors{" "}
          <EditableValue
            value={state.attractorCount}
            min={100}
            max={4000}
            step={50}
            onChange={(v) => updateState({ attractorCount: v })}
          >
            {state.attractorCount}
          </EditableValue>
        </label>
        <input
          type="range"
          min="100"
          max="4000"
          step="50"
          value={state.attractorCount}
          onChange={(e) => updateState({ attractorCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Roots{" "}
          <EditableValue
            value={state.rootCount}
            min={1}
            max={8}
            step={1}
            onChange={(v) => updateState({ rootCount: v })}
          >
            {state.rootCount}
          </EditableValue>
        </label>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={state.rootCount}
          onChange={(e) => updateState({ rootCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <h3 className="section-title">Growth</h3>

      <div className="control-group">
        <label>
          Step Length{" "}
          <EditableValue
            value={state.growthStepMm}
            min={0.5}
            max={4}
            step={0.1}
            onChange={(v) => updateState({ growthStepMm: v })}
          >
            {state.growthStepMm.toFixed(1)}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.5"
          max="4"
          step="0.1"
          value={state.growthStepMm}
          onChange={(e) => updateState({ growthStepMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Attraction Range{" "}
          <EditableValue
            value={state.attractionDistMm}
            min={4}
            max={30}
            step={0.5}
            onChange={(v) => updateState({ attractionDistMm: v })}
          >
            {state.attractionDistMm.toFixed(1)}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="4"
          max="30"
          step="0.5"
          value={state.attractionDistMm}
          onChange={(e) => updateState({ attractionDistMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Kill Radius{" "}
          <EditableValue
            value={state.killDistMm}
            min={1}
            max={12}
            step={0.5}
            onChange={(v) => updateState({ killDistMm: v })}
          >
            {state.killDistMm.toFixed(1)}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="1"
          max="12"
          step="0.5"
          value={state.killDistMm}
          onChange={(e) => updateState({ killDistMm: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Max Iterations{" "}
          <EditableValue
            value={state.maxIterations}
            min={200}
            max={3000}
            step={100}
            onChange={(v) => updateState({ maxIterations: v })}
          >
            {state.maxIterations}
          </EditableValue>
        </label>
        <input
          type="range"
          min="200"
          max="3000"
          step="100"
          value={state.maxIterations}
          onChange={(e) => updateState({ maxIterations: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          Min Vein Length{" "}
          <EditableValue
            value={state.minBranchLengthMm}
            min={0}
            max={20}
            step={0.5}
            onChange={(v) => updateState({ minBranchLengthMm: v })}
          >
            {state.minBranchLengthMm.toFixed(1)}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="0"
          max="20"
          step="0.5"
          value={state.minBranchLengthMm}
          onChange={(e) => updateState({ minBranchLengthMm: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Wander</h3>

      <div className="control-group">
        <label>
          Direction Bias{" "}
          <EditableValue
            value={state.directionBias}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateState({ directionBias: v })}
          >
            {state.directionBias.toFixed(2)}
          </EditableValue>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.directionBias}
          onChange={(e) => updateState({ directionBias: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label>
          Bias Grain{" "}
          <EditableValue
            value={state.biasNoiseScale}
            min={0.001}
            max={0.02}
            step={0.001}
            onChange={(v) => updateState({ biasNoiseScale: v })}
          >
            {state.biasNoiseScale.toFixed(3)}
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.001"
          max="0.02"
          step="0.001"
          value={state.biasNoiseScale}
          onChange={(e) => updateState({ biasNoiseScale: parseFloat(e.target.value) })}
        />
      </div>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          Colour Bands{" "}
          <EditableValue
            value={state.layerCount}
            min={1}
            max={6}
            step={1}
            onChange={(v) => updateState({ layerCount: v })}
          >
            {state.layerCount}
          </EditableValue>
        </label>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={state.layerCount}
          onChange={(e) => updateState({ layerCount: parseInt(e.target.value, 10) })}
        />
        <p className="paint-hint">Vein depth maps onto this many pen colours — 1 plots a single pen.</p>
      </div>

      {state.layerCount > 1 ? (
        <PalettePicker
          palette={state.palette}
          customRamp={state.customRamp}
          colorCount={state.layerCount}
          onChange={(updates) => updateState(updates)}
        />
      ) : (
        <ColorField
          label="Stroke Color"
          value={state.strokeColor}
          onChange={(strokeColor) => updateState({ strokeColor })}
        />
      )}

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.boldTrunk}
            onChange={(e) => updateState({ boldTrunk: e.target.checked })}
          />
          Bold trunk veins
        </label>
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.optimize}
            onChange={(e) => updateState({ optimize: e.target.checked })}
          />
          Optimize plot order
        </label>
      </div>

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
    </div>
  );
}
