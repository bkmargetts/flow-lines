import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { MachineState } from './types';
import { MACHINE_PRESETS, getMachinePreset, randomMachineGenome } from './presets';

/** Sidebar controls for the Machine. Complexity and Connectivity are the
 *  module's identity — how packed the page is, and whether it reads as one
 *  mega-machine or an engine-room wall; everything finer lives in Advanced. */
export function MachineControls({ state, update }: ControlsProps<MachineState>) {
  const selectPreset = (id: string) => {
    const preset = getMachinePreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  const surprise = () => update({ ...randomMachineGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <h3 className="section-title">Machine</h3>

      <RandomiseButton onClick={surprise} hint="One roll for a whole new machine — or tune anything below." />

      <div className="control-group">
        <div className="seed-input">
          <select value={state.preset} onChange={(e) => selectPreset(e.target.value)} style={{ flex: 1 }}>
            {MACHINE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            onClick={() => update({ seed: randomSeed() })}
            title="New random machine"
          >
            🎲
          </button>
        </div>
        <p className="paint-hint">Pick a machine, then pack the page and wire it up.</p>
      </div>

      <div className="control-group">
        <div className="seed-input">
          <label className="label-text" style={{ flex: 1 }}>Seed</label>
          <input
            type="number"
            value={state.seed}
            onChange={(e) => update({ seed: parseInt(e.target.value, 10) || 0 })}
            style={{ width: 110 }}
          />
          <button type="button" className="secondary" onClick={() => update({ seed: randomSeed() })} title="Random seed">
            🎲
          </button>
        </div>
      </div>

      <Slider
        label="Complexity"
        value={state.complexity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ complexity: v })}
        format={(v) => (v < 0.02 ? 'one mechanism' : `${Math.round(v * 100)}%`)}
      />
      <Slider
        label="Wall ↔ One machine"
        value={state.connectivity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ connectivity: v })}
        format={(v) => (v < 0.02 ? 'wall' : v > 0.98 ? 'one machine' : `${Math.round(v * 100)}%`)}
      />

      <Slider label="Gear size" value={state.gearSizeMm} min={12} max={42} step={0.5} onChange={(v) => update({ gearSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Scale variety" value={state.scaleVariety} min={0} max={1} step={0.05} onChange={(v) => update({ scaleVariety: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Mechanisms" value={state.mechanisms} min={0} max={1} step={0.05} onChange={(v) => update({ mechanisms: v })} format={(v) => `${Math.round(v * 100)}%`} />

      <AdvancedSection>
        <AdvGroup title="Machine">
          <Slider label="Scaffold" value={state.frameDensity} min={0} max={1} step={0.05} onChange={(v) => update({ frameDensity: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Cutaways" value={state.cutaways} min={0} max={3} step={1} onChange={(v) => update({ cutaways: v })} />
          <div className="control-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={state.hiddenLines} onChange={(e) => update({ hiddenLines: e.target.checked })} />
              <span>Dashed hidden lines</span>
            </label>
          </div>
        </AdvGroup>

        <AdvGroup title="Tone">
          <Slider label="Shading" value={state.shading} min={0} max={1} step={0.05} onChange={(v) => update({ shading: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Hatch spacing" value={state.hatchMm} min={0.5} max={2.5} step={0.05} onChange={(v) => update({ hatchMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Hand sketch" value={state.sketch} min={0} max={1} step={0.05} onChange={(v) => update({ sketch: v })} format={(v) => `${Math.round(v * 100)}%`} />
          {state.sketch > 0.01 && (
            <div className="control-group">
              <label className="label-text">Sketch style</label>
              <select value={state.sketchStyle} onChange={(e) => update({ sketchStyle: e.target.value as MachineState['sketchStyle'] })}>
                <option value="loose">Loose</option>
                <option value="fine">Fine</option>
                <option value="gestural">Gestural</option>
                <option value="scratchy">Scratchy</option>
              </select>
            </div>
          )}
          <ColorField label="Ink" value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
