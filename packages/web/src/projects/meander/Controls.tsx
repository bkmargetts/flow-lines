import { MEANDER_PRESETS, type MeanderPreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps } from '../../modules/types';
import type { MeanderState } from './types';

const PRESET_LABELS: Record<MeanderPreset, string> = {
  atlas: 'Atlas (Fisk plate)',
  young: 'Young (sparse memory)',
  tangle: 'Tangle (old age)',
};

/**
 * Roll a whole new river. Every knob lands inside its slider's range but
 * biased off the extremes so a roll never comes out unreadable; the pen/ink
 * aesthetic prefs (colors, pen width, multi-ink) and the preset label are left
 * alone. Exported for the genome test.
 */
export function randomMeanderGenome(rng: () => number): Partial<MeanderState> {
  return {
    iterations: 80 + Math.round(rng() * 520),
    migration: Number((0.3 + rng() * 0.65).toFixed(2)),
    bendScale: Number((0.05 + rng() * 0.12).toFixed(3)),
    valleyWidth: Number((0.3 + rng() * 0.6).toFixed(2)),
    // Mostly shallow crossings; sometimes a steeper diagonal.
    flowAngleDeg: 5 * Math.round((rng() < 0.7 ? rng() * 30 : rng() * 180) / 5),
    jitter: Number((0.1 + rng() * 0.7).toFixed(2)),
    channelWidthMm: Number((2 + rng() * 5).toFixed(1)),
    traces: Math.round(rng() * 40),
    fade: Number((0.25 + rng() * 0.65).toFixed(2)),
    oxbows: rng() < 0.85,
    flowLines: Math.floor(rng() * 5),
    boldPasses: 1 + Math.floor(rng() * 4),
    wobble: Number((0.2 + rng() * 1.3).toFixed(1)),
  };
}

/** Sidebar controls for the Meander module. */
export function MeanderControls({ state, update }: ControlsProps<MeanderState>) {
  const updateState = update;

  // The preset binds the river's life story and the ink treatment; the
  // sliders fine-tune from there.
  const selectPreset = (preset: MeanderPreset) => {
    const p = MEANDER_PRESETS[preset];
    updateState({
      preset,
      iterations: p.iterations,
      migration: p.migration,
      valleyWidth: p.valleyWidth,
      traces: p.traces,
      fade: p.fade,
      oxbows: p.oxbows,
      flowLines: p.flowLines,
      boldPasses: p.boldPasses,
    });
  };

  const surprise = () => update({ ...randomMeanderGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a whole new river — or tune anything below." />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Look"
        info="Atlas is the Fisk survey plate: a long-lived river with a dense belt of scroll-bar history and oxbow lakes. Young is an early river — gentle bends, sparse memory, more paper. Tangle is old age: heavy migration in a wide belt, history crowded with cutoffs. Each just sets the simulation and ink parameters — fine-tune below."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <Slider
        labelNode={
          <span className="label-text">
            River age
            <InfoTip text="Migration steps the river has lived through. Older rivers wander further from their first course, pinch off more oxbows, and leave a deeper belt of history." />
          </span>
        }
        value={state.iterations}
        min={60}
        max={800}
        step={10}
        onChange={(v) => updateState({ iterations: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Migration
            <InfoTip text="How aggressively the outer bank erodes. High grows deep loops fast and cuts them off; low keeps the course close to its history." />
          </span>
        }
        value={Math.round(state.migration * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => updateState({ migration: v / 100 })}
        format={(v) => `${v}%`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Traces
            <InfoTip text="How many former courses stay drawn — the scroll bars of the meander belt. 0 leaves only the present channel and its oxbows." />
          </span>
        }
        value={state.traces}
        min={0}
        max={60}
        step={1}
        onChange={(v) => updateState({ traces: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Fade
            <InfoTip text="How aggressively old traces fragment with age. High leaves the deep past as a few drifting dashes; 0 keeps every course fully inked." />
          </span>
        }
        value={Math.round(state.fade * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => updateState({ fade: v / 100 })}
        format={(v) => `${v}%`}
      />

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.oxbows}
            onChange={(e) => updateState({ oxbows: e.target.checked })}
          />
          Oxbow lakes
          <InfoTip text="Keep the loops the river pinched off as abandoned lakes — drawn as narrowed bank pairs that fragment as they silt up. Off drops them the moment they cut off." />
        </label>
      </div>

      <h3 className="section-title">Style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the belt reads cleanly." />
          </span>
        }
        value={state.penWidthMm}
        min={0.1}
        max={1.5}
        step={0.05}
        onChange={(v) => updateState({ penWidthMm: v })}
        format={(v) => `${v}mm`}
      />

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.multiInk}
            onChange={(e) => updateState({ multiInk: e.target.checked })}
          />
          Multiple inks
          <InfoTip text="Draw the present channel, the historical traces and the oxbow lakes in different inks. Each layer still plots with one pen, and the per-layer SVG export keeps them separate — a genuine 2–3 pen plot, not a colour trick." />
        </label>
      </div>

      {state.multiInk ? (
        <>
          <ColorField
            label="Channel ink"
            value={state.channelColor}
            onChange={(channelColor) => updateState({ channelColor })}
            info="Ink for the present channel — the bold banks and the flow lines between them."
          />
          <ColorField
            label="Trace ink"
            value={state.traceColor}
            onChange={(traceColor) => updateState({ traceColor })}
            info="Ink for the historical scroll-bar traces — the river's memory."
          />
          <ColorField
            label="Oxbow ink"
            value={state.oxbowColor}
            onChange={(oxbowColor) => updateState({ oxbowColor })}
            info="Ink for the abandoned oxbow lakes."
          />
        </>
      ) : (
        <ColorField
          label="Stroke Color"
          value={state.strokeColor}
          onChange={(strokeColor) => updateState({ strokeColor })}
          info="Ink colour of the preview and exported SVG. Plotting still uses a single pen — colour is just for on-screen and paper choice."
        />
      )}

      <h3 className="section-title">Seed</h3>

      <SeedControl seed={state.seed} onChange={(seed) => updateState({ seed })}>
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="The simulation is deterministic — the seed sets the first course, the bank noise and where the pen lifts, giving a different river without changing the behaviour." />
          </span>
        </label>
      </SeedControl>

      <AdvancedSection>
        <AdvGroup title="Course">
          <Slider
            labelNode={
              <span className="label-text">
                Bend scale
                <InfoTip text="The size bends emerge at, as a fraction of the page. Bigger makes a few sweeping loops; smaller crowds the belt with tight ones." />
              </span>
            }
            value={state.bendScale}
            min={0.04}
            max={0.2}
            step={0.005}
            onChange={(v) => updateState({ bendScale: v })}
            format={(v) => v.toFixed(3)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Valley width
                <InfoTip text="The belt the river is allowed to wander across, as a fraction of the page. Narrow confines it to a tight band; wide lets the history sprawl." />
              </span>
            }
            value={Math.round(state.valleyWidth * 100)}
            min={20}
            max={100}
            step={1}
            onChange={(v) => updateState({ valleyWidth: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Flow angle
                <InfoTip text="The axis the river crosses the sheet along, in degrees. 0 runs left to right; a shallow diagonal usually composes best." />
              </span>
            }
            value={state.flowAngleDeg}
            min={0}
            max={180}
            step={5}
            onChange={(v) => updateState({ flowAngleDeg: v })}
            format={(v) => `${v}°`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Jitter
                <InfoTip text="Perpendicular bank noise while the river migrates. More makes a nervous, irregular course; less draws calm confident bends." />
              </span>
            }
            value={Math.round(state.jitter * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateState({ jitter: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Channel width
                <InfoTip text="The river's physical width on paper, in millimetres. Everything scales from it: bank spacing, oxbow width, where history is culled." />
              </span>
            }
            value={state.channelWidthMm}
            min={1.5}
            max={10}
            step={0.5}
            onChange={(v) => updateState({ channelWidthMm: v })}
            format={(v) => `${v}mm`}
          />
        </AdvGroup>

        <AdvGroup title="Ink & hand">
          <Slider
            labelNode={
              <span className="label-text">
                Flow lines
                <InfoTip text="Broken lines inside the channel that read as engraved water — the pen glints along the current, lifts, resumes. 0 leaves open water." />
              </span>
            }
            value={state.flowLines}
            min={0}
            max={5}
            step={1}
            onChange={(v) => updateState({ flowLines: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Bold passes
                <InfoTip text="How many offset passes of the same pen build up the channel banks. More passes read heavier — still a single pen, never a stroke-width trick." />
              </span>
            }
            value={state.boldPasses}
            min={1}
            max={6}
            step={1}
            onChange={(v) => updateState({ boldPasses: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Wobble
                <InfoTip text="Hand-drawn shake on the strokes. The old traces wobble most; the channel banks stay steady. 0 is ruler-smooth." />
              </span>
            }
            value={state.wobble}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => updateState({ wobble: v })}
            format={(v) => `${v.toFixed(1)}px`}
          />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
