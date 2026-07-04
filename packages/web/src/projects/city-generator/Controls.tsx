import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { CityState } from './types';
import { CITY_PRESETS, getCityPreset } from './presets';

/** Sidebar controls for the City Generator. The master Flow ↔ Rigid slider
 *  is the module's identity; everything finer lives in Advanced. */
export function CityGeneratorControls({ state, update }: ControlsProps<CityState>) {
  const selectPreset = (id: string) => {
    const preset = getCityPreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  return (
    <div className="controls">
      <h3 className="section-title">City</h3>

      <div className="control-group">
        <div className="seed-input">
          <select value={state.preset} onChange={(e) => selectPreset(e.target.value)} style={{ flex: 1 }}>
            {CITY_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            onClick={() => update({ seed: randomSeed() })}
            title="New random city"
          >
            🎲
          </button>
        </div>
        <p className="paint-hint">Pick a style, then slide between flowing and rigid.</p>
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
        label="Flow ↔ Rigid"
        value={state.order}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ order: v })}
        format={(v) => (v < 0.02 ? 'flowing' : v > 0.98 ? 'rigid' : `${Math.round(v * 100)}%`)}
      />

      <div className="control-group">
        <label className="label-text">Viewpoint</label>
        <select value={state.viewpoint} onChange={(e) => update({ viewpoint: e.target.value as CityState['viewpoint'] })}>
          <option value="isometric">Isometric</option>
          <option value="skyline">Skyline</option>
        </select>
      </div>

      <Slider label="Density" value={state.density} min={0.3} max={1} step={0.01} onChange={(v) => update({ density: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Building height" value={state.heightMm} min={8} max={80} step={1} onChange={(v) => update({ heightMm: v })} format={(v) => `${v.toFixed(0)}mm`} />
      <Slider label="Zoom" value={state.zoom} min={0.3} max={3} step={0.05} onChange={(v) => update({ zoom: v })} format={(v) => `${v.toFixed(2)}×`} />

      <AdvancedSection>
        <AdvGroup title="Layout">
          <Slider label="Blocks across" value={state.blockCols} min={2} max={14} step={1} onChange={(v) => update({ blockCols: v })} />
          <Slider label="Blocks deep" value={state.blockRows} min={2} max={14} step={1} onChange={(v) => update({ blockRows: v })} />
          <Slider label="Lot size" value={state.lotSizeMm} min={6} max={26} step={0.5} onChange={(v) => update({ lotSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <Slider label="Street width" value={state.streetMm} min={1} max={14} step={0.5} onChange={(v) => update({ streetMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <Slider label="Downtown" value={state.downtown} min={0} max={1} step={0.05} onChange={(v) => update({ downtown: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="Buildings">
          <Slider label="Height variety" value={state.heightVariance} min={0} max={1} step={0.05} onChange={(v) => update({ heightVariance: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Storey height" value={state.storeyMm} min={1.5} max={7} step={0.1} onChange={(v) => update({ storeyMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <Slider label="Setback tiers" value={state.tiers} min={0} max={1} step={0.05} onChange={(v) => update({ tiers: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Lean & bow" value={state.lean} min={0} max={1} step={0.05} onChange={(v) => update({ lean: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="Windows">
          <Slider label="Window density" value={state.windows} min={0} max={1} step={0.05} onChange={(v) => update({ windows: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Window size" value={state.windowMm} min={1.2} max={5} step={0.1} onChange={(v) => update({ windowMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
        </AdvGroup>

        <AdvGroup title="Shading">
          <Slider label="Shade strength" value={state.shadeStrength} min={0} max={1} step={0.05} onChange={(v) => update({ shadeStrength: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Hatch spacing" value={state.hatchSpacingMm} min={0.5} max={4} step={0.1} onChange={(v) => update({ hatchSpacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <div className="control-group">
            <label className="label-text">Light from</label>
            <select value={state.lightSide} onChange={(e) => update({ lightSide: e.target.value as CityState['lightSide'] })}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
        </AdvGroup>

        {state.viewpoint === 'skyline' && (
          <AdvGroup title="Skyline">
            <Slider label="Depth rows" value={state.skylineRows} min={1} max={5} step={1} onChange={(v) => update({ skylineRows: v })} />
          </AdvGroup>
        )}

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Hand sketch" value={state.sketch} min={0} max={1} step={0.05} onChange={(v) => update({ sketch: v })} format={(v) => `${Math.round(v * 100)}%`} />
          {state.sketch > 0.01 && (
            <div className="control-group">
              <label className="label-text">Sketch style</label>
              <select value={state.sketchStyle} onChange={(e) => update({ sketchStyle: e.target.value as CityState['sketchStyle'] })}>
                <option value="loose">Loose</option>
                <option value="fine">Fine</option>
                <option value="gestural">Gestural</option>
                <option value="scratchy">Scratchy</option>
              </select>
            </div>
          )}
        </AdvGroup>

        <AdvGroup title="Ink">
          <ColorField label="Contours" value={state.contourColor} onChange={(v) => update({ contourColor: v })} />
          <ColorField label="Windows" value={state.windowColor} onChange={(v) => update({ windowColor: v })} />
          <ColorField label="Hatch" value={state.hatchColor} onChange={(v) => update({ hatchColor: v })} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
