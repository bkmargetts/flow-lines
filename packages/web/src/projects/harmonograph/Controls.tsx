import type { HarmonographMode, HarmonographPreset, RosetteEnvelope, TrochoidKind } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { HARMONOGRAPH_WEB_PRESETS, getHarmonographPreset, randomHarmonographGenome } from './presets';
import type { HarmonographState } from './types';

const PRESET_LABELS = Object.fromEntries(
  HARMONOGRAPH_WEB_PRESETS.map((p) => [p.id, p.label])
) as Record<HarmonographPreset, string>;

const MODE_LABELS: Record<HarmonographMode, string> = {
  harmonograph: 'Pendulums',
  spirograph: 'Wheels',
  rosette: 'Rosette',
};

const KIND_LABELS: Record<TrochoidKind, string> = {
  hypo: 'Inside',
  epi: 'Outside',
};

const ENVELOPE_LABELS: Record<RosetteEnvelope, string> = {
  flat: 'Flat',
  bloom: 'Bloom',
  edge: 'Edge',
};

/** Sidebar controls for Harmonograph. The preset picks the drawing machine;
 *  the knobs that shape its figure sit on top, everything finer lives in
 *  Advanced. */
export function HarmonographControls({ state, update }: ControlsProps<HarmonographState>) {
  const selectPreset = (id: HarmonographPreset) => {
    const preset = getHarmonographPreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  const groups = Math.max(1, Math.min(4, Math.round(state.inkGroups)));
  const mode = state.mode;

  return (
    <div className="controls">
      <h3 className="section-title">Harmonograph</h3>

      <RandomiseButton
        onClick={() => update({ ...randomHarmonographGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a whole new machine — or tune anything below."
      />

      <PresetPicker
        label="Machine"
        info="Damped pendulums, spirograph wheels, or the guilloché rose engine."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      {mode === 'harmonograph' && (
        <>
          <Slider label="Ratio · y" value={state.ratioNum} min={1} max={9} step={1} onChange={(v) => update({ ratioNum: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Ratio · x" value={state.ratioDen} min={1} max={9} step={1} onChange={(v) => update({ ratioDen: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Damping" value={state.damping} min={0} max={1} step={0.01} onChange={(v) => update({ damping: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Turns" value={state.periods} min={2} max={120} step={1} onChange={(v) => update({ periods: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Rotation" value={state.rotary} min={0} max={1} step={0.01} onChange={(v) => update({ rotary: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </>
      )}
      {mode === 'spirograph' && (
        <>
          <Slider label="Lobes" value={state.lobes} min={3} max={24} step={1} onChange={(v) => update({ lobes: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Wheel order" value={state.wheelOrder} min={1} max={12} step={1} onChange={(v) => update({ wheelOrder: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Pen offset" value={state.penOffset} min={0} max={1.5} step={0.01} onChange={(v) => update({ penOffset: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Nest" value={state.nest} min={1} max={24} step={1} onChange={(v) => update({ nest: v })} format={(v) => `${Math.round(v)}`} />
        </>
      )}
      {mode === 'rosette' && (
        <>
          <Slider label="Rings" value={state.rings} min={4} max={80} step={1} onChange={(v) => update({ rings: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Waves" value={state.waves} min={3} max={48} step={1} onChange={(v) => update({ waves: v })} format={(v) => `${Math.round(v)}`} />
          <Slider label="Depth" value={state.waveAmp} min={0} max={1} step={0.01} onChange={(v) => update({ waveAmp: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Weave" value={state.phaseAdvanceDeg} min={0} max={45} step={0.5} onChange={(v) => update({ phaseAdvanceDeg: v })} format={(v) => `${v.toFixed(1)}°`} />
        </>
      )}

      <AdvancedSection>
        <AdvGroup title="Figure">
          <PresetPicker
            label="Mode"
            labels={MODE_LABELS}
            value={mode}
            onChange={(m) => update({ mode: m })}
          />
          <Slider label="Size" value={state.scale} min={0.3} max={1} step={0.01} onChange={(v) => update({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Jitter" value={state.jitter} min={0} max={1} step={0.01} onChange={(v) => update({ jitter: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        {mode === 'harmonograph' && (
          <AdvGroup title="Pendulums">
            <Slider label="Detune" value={state.detune} min={0} max={0.05} step={0.001} onChange={(v) => update({ detune: v })} format={(v) => v.toFixed(3)} />
            <Slider label="Phase" value={state.phaseDeg} min={0} max={180} step={1} onChange={(v) => update({ phaseDeg: v })} format={(v) => `${Math.round(v)}°`} />
            <Slider label="Passes" value={state.passes} min={1} max={8} step={1} onChange={(v) => update({ passes: v })} format={(v) => `${Math.round(v)}`} />
          </AdvGroup>
        )}
        {mode === 'spirograph' && (
          <AdvGroup title="Wheels">
            <PresetPicker
              label="Rolling"
              labels={KIND_LABELS}
              value={state.trochoidKind}
              onChange={(trochoidKind) => update({ trochoidKind })}
            />
            <Slider label="Nest shrink" value={state.nestShrink} min={0.5} max={1} step={0.01} onChange={(v) => update({ nestShrink: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.nest < 2} />
            <Slider label="Nest rotate" value={state.nestRotateDeg} min={-30} max={30} step={0.5} onChange={(v) => update({ nestRotateDeg: v })} format={(v) => `${v.toFixed(1)}°`} disabled={state.nest < 2} />
          </AdvGroup>
        )}
        {mode === 'rosette' && (
          <AdvGroup title="Rose engine">
            <Slider label="Inner hole" value={state.innerHole} min={0} max={0.9} step={0.01} onChange={(v) => update({ innerHole: v })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Second waves" value={state.waves2} min={0} max={12} step={1} onChange={(v) => update({ waves2: v })} format={(v) => (v > 0 ? `${Math.round(v)}` : 'off')} />
            <Slider label="Second depth" value={state.wave2Amp} min={0} max={1} step={0.01} onChange={(v) => update({ wave2Amp: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.waves2 < 1} />
            <PresetPicker
              label="Envelope"
              labels={ENVELOPE_LABELS}
              value={state.envelope}
              onChange={(envelope) => update({ envelope })}
            />
          </AdvGroup>
        )}

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
