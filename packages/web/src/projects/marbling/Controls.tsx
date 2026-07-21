import type { MarblingPattern } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { MARBLING_WEB_PRESETS, getMarblingPreset, randomMarblingGenome } from './presets';
import type { MarblingState } from './types';

const PATTERN_LABELS = Object.fromEntries(
  MARBLING_WEB_PRESETS.map((p) => [p.id, p.label])
) as Record<MarblingPattern, string>;

/** Sidebar controls for Marbling. The pattern preset is the module's
 *  identity; the bath and rake knobs that shape it sit on top, everything
 *  finer lives in Advanced. */
export function MarblingControls({ state, update }: ControlsProps<MarblingState>) {
  const selectPreset = (id: MarblingPattern) => {
    const preset = getMarblingPreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  const groups = Math.max(1, Math.min(4, Math.round(state.inkGroups)));
  const raked = state.preset !== 'stone' && state.preset !== 'vortex';

  return (
    <div className="controls">
      <h3 className="section-title">Marbling</h3>

      <RandomiseButton
        onClick={() => update({ ...randomMarblingGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a whole new bath — or tune anything below."
      />

      <PresetPicker
        label="Pattern"
        info="The classical rake recipe: drops fill the bath, then combs shear it."
        labels={PATTERN_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <Slider label="Drops" value={state.drops} min={10} max={150} step={1} onChange={(v) => update({ drops: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Drop size" value={state.dropSizeMm} min={5} max={40} step={0.5} onChange={(v) => update({ dropSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Comb pitch" value={state.combSpacingMm} min={1.5} max={12} step={0.1} onChange={(v) => update({ combSpacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} disabled={!raked} />
      <Slider label="Swirl" value={state.swirl} min={0} max={1} step={0.01} onChange={(v) => update({ swirl: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.preset === 'stone'} />

      <AdvancedSection>
        <AdvGroup title="Bath">
          <Slider label="Rings per drop" value={state.ringsPerDrop} min={1} max={6} step={1} onChange={(v) => update({ ringsPerDrop: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Drop size jitter" value={state.dropJitter} min={0} max={1} step={0.05} onChange={(v) => update({ dropJitter: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="Rake">
          <Slider label="Shear falloff" value={state.falloffMm} min={0.3} max={6} step={0.1} onChange={(v) => update({ falloffMm: v })} format={(v) => `${v.toFixed(1)}mm`} disabled={!raked} />
          <Slider label="Wavy comb" value={state.wavy} min={0} max={1} step={0.05} onChange={(v) => update({ wavy: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.preset !== 'bouquet'} />
          <Slider label="Vortex twist" value={state.vortex} min={0} max={1} step={0.05} onChange={(v) => update({ vortex: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.preset !== 'vortex'} />
        </AdvGroup>

        <AdvGroup title="Detail">
          <Slider label="Detail" value={state.detailMm} min={0.2} max={1.5} step={0.05} onChange={(v) => update({ detailMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>

        <AdvGroup title="Ink">
          <Slider label="Pens" value={state.inkGroups} min={1} max={4} step={1} onChange={(v) => update({ inkGroups: v })} format={(v) => `${Math.round(v)}`} />
          <ColorField label={groups > 1 ? 'Pen 1' : 'Ink'} value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
          {groups > 1 && (
            <ColorField label="Pen 2" value={state.ink2Color} onChange={(v) => update({ ink2Color: v })} />
          )}
          {groups > 2 && (
            <ColorField label="Pen 3" value={state.ink3Color} onChange={(v) => update({ ink3Color: v })} />
          )}
          {groups > 3 && (
            <ColorField label="Pen 4" value={state.ink4Color} onChange={(v) => update({ ink4Color: v })} />
          )}
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
