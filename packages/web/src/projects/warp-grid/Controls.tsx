import type { WarpBasePattern, WarpGridPreset } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { WARP_GRID_WEB_PRESETS, getWarpGridPreset, randomWarpGridGenome } from './presets';
import type { WarpGridState } from './types';

const PRESET_LABELS = Object.fromEntries(
  WARP_GRID_WEB_PRESETS.map((p) => [p.id, p.label])
) as Record<WarpGridPreset, string>;

const PATTERN_LABELS: Record<WarpBasePattern, string> = {
  lines: 'Lines',
  waves: 'Waves',
  circles: 'Circles',
  rays: 'Rays',
};

/** Sidebar controls for Warp Grid. The preset is the module's identity; the
 *  form-strength knobs that shape the illusion sit on top, everything finer
 *  lives in Advanced. */
export function WarpGridControls({ state, update }: ControlsProps<WarpGridState>) {
  const selectPreset = (id: WarpGridPreset) => {
    const preset = getWarpGridPreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  const directional = state.pattern === 'lines' || state.pattern === 'waves';

  return (
    <div className="controls">
      <h3 className="section-title">Warp Grid</h3>

      <RandomiseButton
        onClick={() => update({ ...randomWarpGridGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a whole new scene of hidden forms — or tune anything below."
      />

      <PresetPicker
        label="Look"
        info="The base grating plus the hidden forms that deform it."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <Slider label="Relief" value={state.relief} min={0} max={1} step={0.01} onChange={(v) => update({ relief: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Strength" value={state.strength} min={0} max={1} step={0.01} onChange={(v) => update({ strength: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Forms" value={state.deformers} min={0} max={8} step={1} onChange={(v) => update({ deformers: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Line pitch" value={state.spacingMm} min={1.5} max={8} step={0.1} onChange={(v) => update({ spacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />

      <AdvancedSection>
        <AdvGroup title="Grating">
          <PresetPicker
            label="Pattern"
            labels={PATTERN_LABELS}
            value={state.pattern}
            onChange={(pattern) => update({ pattern })}
          />
          <Slider label="Angle" value={state.angle} min={0} max={180} step={1} onChange={(v) => update({ angle: v })} format={(v) => `${Math.round(v)}°`} disabled={!directional} />
          <Slider label="Wave amount" value={state.waveAmp} min={0} max={1} step={0.05} onChange={(v) => update({ waveAmp: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.pattern !== 'waves'} />
          <Slider label="Wavelength" value={state.wavelengthMm} min={10} max={60} step={1} onChange={(v) => update({ wavelengthMm: v })} format={(v) => `${Math.round(v)}mm`} />
        </AdvGroup>

        <AdvGroup title="Hidden forms">
          <Slider label="Form size" value={state.scale} min={0.1} max={0.6} step={0.01} onChange={(v) => update({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Terrain grain" value={state.noiseScale} min={0.1} max={0.8} step={0.01} onChange={(v) => update({ noiseScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="3D read">
          <Toggle
            label="Occlude (hidden-line relief)"
            checked={state.occlude}
            onChange={(occlude) => update({ occlude })}
            disabled={!directional}
          />
          <Slider label="Compression floor" value={state.dropFloor} min={0} max={1} step={0.01} onChange={(v) => update({ dropFloor: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Edge calm" value={state.edgeCalm} min={0} max={1} step={0.01} onChange={(v) => update({ edgeCalm: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="Detail">
          <Slider label="Detail" value={state.detailMm} min={0.25} max={1.5} step={0.05} onChange={(v) => update({ detailMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <ColorField label="Ink" value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
