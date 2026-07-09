import type { GesturePreset } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps } from '../../modules/types';
import type { GestureState } from './types';

const PRESET_LABELS: Record<GesturePreset, string> = {
  auto: 'Auto (seeded pick)',
  kline: 'Kline — black bars',
  sumi: 'Sumi — one sweep',
  hartung: 'Hartung — whip bundle',
  tangle: 'Tangle — scribble knot',
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Sidebar controls for Gestural Ink. The archetype + three feels up top;
 *  mark counts and composition live in Advanced. */
export function GestureControls({ state, update }: ControlsProps<GestureState>) {
  return (
    <div className="controls">
      <h3 className="section-title">Gestural Ink</h3>

      <PresetPicker
        label="Archetype"
        info="The compositional language: a few massive bars, one enso-like sweep, a bundle of parallel whips, or a dominant scribble knot."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={(preset) => update({ preset })}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} title="New composition" />

      <Slider
        label="Energy"
        value={state.energy}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ energy: v })}
        format={pct}
      />
      <Slider
        label="Ink weight"
        value={state.inkWeight}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ inkWeight: v })}
        format={pct}
      />
      <Slider
        label="Dryness"
        value={state.dryness}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ dryness: v })}
        format={pct}
      />

      <AdvancedSection>
        <AdvGroup title="Marks">
          <Slider
            label="Gestures"
            value={state.gestures}
            min={0}
            max={5}
            step={1}
            onChange={(v) => update({ gestures: v })}
            format={(v) => (v === 0 ? 'auto' : String(v))}
          />
          <Slider
            label="Whips"
            value={state.whips}
            min={-1}
            max={12}
            step={1}
            onChange={(v) => update({ whips: v })}
            format={(v) => (v < 0 ? 'auto' : String(v))}
          />
          <Slider
            label="Knots"
            value={state.knots}
            min={-1}
            max={3}
            step={1}
            onChange={(v) => update({ knots: v })}
            format={(v) => (v < 0 ? 'auto' : String(v))}
          />
          <Slider
            label="Spatter"
            value={state.spatter}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ spatter: v })}
            format={pct}
          />
          <Slider
            label="Drips"
            value={state.drips}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ drips: v })}
            format={pct}
          />
        </AdvGroup>

        <AdvGroup title="Composition">
          <Slider
            label="Coverage"
            value={state.coverage}
            min={0.1}
            max={0.7}
            step={0.01}
            onChange={(v) => update({ coverage: v })}
            format={pct}
          />
          <Slider
            label="Lean"
            value={state.balance}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ balance: v })}
            format={pct}
          />
          <Slider
            label="Negative space"
            value={state.negativeSpace}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ negativeSpace: v })}
            format={pct}
          />
        </AdvGroup>

        <AdvGroup title="Pen">
          <Slider
            label="Pen width (mm)"
            value={state.penWidthMm}
            min={0.2}
            max={1.2}
            step={0.05}
            onChange={(v) => update({ penWidthMm: v })}
          />
          <Slider
            label="Wobble (px)"
            value={state.wobble}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => update({ wobble: v })}
          />
          <ColorField label="Ink" value={state.strokeColor} onChange={(strokeColor) => update({ strokeColor })} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
