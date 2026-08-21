import {
  SANDPILE_PRESETS,
  type SandpileDomain,
  type SandpilePlacement,
  type SandpilePreset,
} from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps } from '../../modules/types';
import type { SandpileState } from './types';

const PRESET_LABELS: Record<SandpilePreset, string> = {
  facet: 'Facet (cut gem)',
  lattice: 'Lattice (deep box)',
  crystal: 'Crystal (ring of grains)',
  shard: 'Shard (triangle)',
};

const DOMAIN_LABELS: Record<SandpileDomain, string> = {
  rectangle: 'Rectangle',
  disk: 'Disk',
  polygon: 'Polygon',
};

const PLACEMENT_LABELS: Record<SandpilePlacement, string> = {
  scatter: 'Scattered',
  ring: 'On a ring',
  grid: 'On a grid',
};

/**
 * Roll a whole new tropical curve. Grain count is deliberately capped well
 * below the slider's maximum: past roughly 60 grains a large share of the
 * curve's segments fall under 3mm at A3, where the lattice stops reading as a
 * woodcut and starts reading as aliasing. Resolution is capped too, since cost
 * grows about cubically with it. Seed, preset and pen/ink prefs are left alone.
 * Exported for the genome test.
 */
export function randomSandpileGenome(rng: () => number): Partial<SandpileState> {
  const domains: SandpileDomain[] = ['polygon', 'polygon', 'rectangle', 'disk'];
  const domain = domains[Math.floor(rng() * domains.length)];
  const placements: SandpilePlacement[] = ['scatter', 'scatter', 'ring', 'grid'];
  return {
    domain,
    sides: 3 + Math.floor(rng() * 6),
    rotationDeg: Math.round(rng() * 90),
    placement: placements[Math.floor(rng() * placements.length)],
    ringRadius: Number((0.35 + rng() * 0.5).toFixed(2)),
    points: 8 + Math.floor(rng() * 44),
    resolution: 20 * Math.round((300 + rng() * 220) / 20),
    straightness: Number((1.5 + rng() * 1.5).toFixed(1)),
    minSegment: 6 + Math.floor(rng() * 12),
    wobble: Number((rng() * 0.9).toFixed(2)),
  };
}

/** Sidebar controls for the Sandpile module. */
export function SandpileControls({ state, update }: ControlsProps<SandpileState>) {
  const selectPreset = (preset: SandpilePreset) => {
    const p = SANDPILE_PRESETS[preset];
    update({
      preset,
      resolution: p.resolution,
      points: p.points,
      domain: p.domain,
      sides: p.sides,
      placement: p.placement,
    });
  };

  const surprise = () => update({ ...randomSandpileGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton
        onClick={surprise}
        hint="One roll for a whole new curve — or tune anything below."
      />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Look"
        info="Every preset relaxes the same sandpile — 3 grains on every lattice site, one more dropped at each of your points — and differs only in the domain and how the grains are scattered. The set of sites that changed is a tropical curve through those points, and it is the one of least tropical area: a Steiner problem solved by falling sand. Every edge is straight with a rational slope, and every junction balances."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Grains
            <InfoTip text="How many extra grains are dropped. The tropical curve must pass through every one of them, so more grains means a finer, busier network — and shorter segments. Past about 60 on A3 a large share of those segments fall under 3mm, where the lattice stops reading as a woodcut and starts reading as jagged." />
          </span>
        }
        value={state.points}
        min={1}
        max={120}
        step={1}
        onChange={(v) => update({ points: v })}
      />

      <PresetPicker
        label="Domain"
        info="The lattice polygon the sand relaxes inside. Grains that topple off its edge leave the system, so the domain's shape is what stops the curve running away — and it sets the directions the outer edges can take."
        labels={DOMAIN_LABELS}
        value={state.domain}
        onChange={(domain: SandpileDomain) => update({ domain })}
      />

      {state.domain === 'polygon' ? (
        <>
          <Slider
            label="Sides"
            value={state.sides}
            min={3}
            max={12}
            step={1}
            onChange={(v) => update({ sides: v })}
          />
          <Slider
            label="Rotation"
            value={state.rotationDeg}
            min={0}
            max={90}
            step={1}
            onChange={(v) => update({ rotationDeg: v })}
            format={(v) => `${v}°`}
          />
        </>
      ) : null}

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <AdvancedSection>
        <AdvGroup title="Grains">
          <PresetPicker
            label="Placement"
            info="Scattered grains give an irregular, organic network. A ring organises the whole curve around a centre. A grid gives it a repeating skeleton the tropical geometry then distorts."
            labels={PLACEMENT_LABELS}
            value={state.placement}
            onChange={(placement: SandpilePlacement) => update({ placement })}
          />
          {state.placement === 'ring' ? (
            <Slider
              label="Ring radius"
              value={Math.round(state.ringRadius * 100)}
              min={10}
              max={95}
              step={1}
              onChange={(v) => update({ ringRadius: v / 100 })}
              format={(v) => `${v}%`}
            />
          ) : null}
        </AdvGroup>

        <AdvGroup title="Simulation">
          <Slider
            labelNode={
              <span className="label-text">
                Lattice resolution
                <InfoTip text="Sites across the page. Higher resolves the curve more exactly, but relaxation cost grows roughly cubically — this is the one knob that can make the module slow." />
              </span>
            }
            value={state.resolution}
            min={120}
            max={720}
            step={20}
            onChange={(v) => update({ resolution: v })}
          />
        </AdvGroup>

        <AdvGroup title="Extraction">
          <Slider
            labelNode={
              <span className="label-text">
                Straightness
                <InfoTip text="How far the lattice pixels may stray from a straight chord before a new edge is started. An edge of slope p/q is drawn as a staircase, so too tight a value shatters it into fragments; the default is set to a plot budget rather than to maximum fidelity." />
              </span>
            }
            value={state.straightness}
            min={1}
            max={4}
            step={0.1}
            onChange={(v) => update({ straightness: v })}
          />
          <Slider
            labelNode={
              <span className="label-text">
                Shortest edge
                <InfoTip text="Runs shorter than this are dropped. Raising it discards the curve's finest filigree — which is finer than a 0.3mm nib can draw anyway — and keeps the median segment comfortably above the size where a lattice reads as aliasing." />
              </span>
            }
            value={state.minSegment}
            min={3}
            max={30}
            step={1}
            onChange={(v) => update({ minSegment: v })}
          />
        </AdvGroup>

        <AdvGroup title="Hand">
          <Slider
            labelNode={
              <span className="label-text">
                Wobble
                <InfoTip text="Low-frequency wobble on every stroke, so the straight edges read as drawn rather than printed. Keep it modest — the drawing's subject is exact straightness, and too much simply hides it." />
              </span>
            }
            value={state.wobble}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => update({ wobble: v })}
          />
        </AdvGroup>

        <AdvGroup title="Ink">
          <Slider
            label="Pen width (mm)"
            value={state.penWidthMm}
            min={0.1}
            max={1.2}
            step={0.05}
            onChange={(v) => update({ penWidthMm: v })}
          />
          <ColorField
            label="Ink"
            value={state.strokeColor}
            onChange={(v) => update({ strokeColor: v })}
          />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
