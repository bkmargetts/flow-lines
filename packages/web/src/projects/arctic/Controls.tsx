import { ARCTIC_PRESETS, type ArcticMarks, type ArcticPreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import type { ControlsProps } from '../../modules/types';
import type { ArcticState } from './types';

const PRESET_LABELS: Record<ArcticPreset, string> = {
  dissolve: 'Dissolve (one class)',
  horizon: 'Horizon (both horizontals)',
  brick: 'Brick (every outline)',
  weave: 'Weave (all four)',
};

const MARK_LABELS: Record<ArcticMarks, string> = {
  one: 'One class',
  horizontals: 'Horizontals',
  all: 'All four',
  outline: 'Domino outlines',
};

/**
 * Roll a whole new tiling. Order and the mark strategy are the only things
 * worth rolling — everything else about this drawing is a theorem. The seed,
 * the preset label and the pen/ink prefs are left alone. Exported for the
 * genome test.
 */
export function randomArcticGenome(rng: () => number): Partial<ArcticState> {
  const marks: ArcticMarks[] = ['one', 'one', 'horizontals', 'all', 'outline'];
  const pick = marks[Math.floor(rng() * marks.length)];
  return {
    // 'brick' draws every outline, so it needs a much lower order to stay
    // above a fine nib; the spine strategies can afford far more detail.
    order: pick === 'outline' ? 40 + Math.floor(rng() * 50) : 70 + Math.floor(rng() * 130),
    marks: pick,
    upright: rng() < 0.35,
    wobble: Number((rng() * 0.9).toFixed(2)),
  };
}

/** Sidebar controls for the Arctic module. */
export function ArcticControls({ state, update }: ControlsProps<ArcticState>) {
  const selectPreset = (preset: ArcticPreset) => {
    const p = ARCTIC_PRESETS[preset];
    update({ preset, order: p.order, marks: p.marks, upright: p.upright });
  };

  const surprise = () => update({ ...randomArcticGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton
        onClick={surprise}
        hint="One roll for a whole new tiling — or tune anything below."
      />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Look"
        info="Every preset draws the SAME kind of object — a uniformly random domino tiling of the Aztec diamond — and differs only in which of the four domino classes get inked. Dissolve inks one, so a solid mass at one pole dissolves into speckle across an exact circular arc. Horizon inks both horizontal classes: dense rules top and bottom, clean paper left and right. Brick draws every outline, the even grey the theorem hides inside. Weave inks all four."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Order
            <InfoTip text="The size of the diamond, n. It holds n(n+1) dominoes, so detail grows as n² — and so does the time to sample it. Higher n makes the arctic circle sharper and the frozen corners denser; past about 200 the individual dominoes drop below what a fine nib can resolve on A3." />
          </span>
        }
        value={state.order}
        min={10}
        max={240}
        step={1}
        onChange={(v) => update({ order: v })}
      />

      <PresetPicker
        label="Inked classes"
        info="A domino tiling has four classes, and the arctic circle theorem is a statement about them: in each frozen corner one class takes over completely. Inking a SUBSET turns that into tone — solid welded rules where the inked class froze, clean paper where the others did, broken dashes in the disordered middle. Inking all four gives a weave; inking every outline gives an even grey that hides the whole effect."
        labels={MARK_LABELS}
        value={state.marks}
        onChange={(marks: ArcticMarks) => update({ marks })}
      />

      <Toggle
        label="Stand on end"
        checked={state.upright}
        onChange={(v) => update({ upright: v })}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <AdvancedSection>
        <AdvGroup title="Hand">
          <Slider
            labelNode={
              <span className="label-text">
                Wobble
                <InfoTip text="Low-frequency wobble on every stroke, so the lattice reads as drawn rather than printed. A little goes a long way here: the drawing's whole subject is the contrast between perfect order and disorder, and too much wobble blurs the boundary between them." />
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
          <Toggle
            label="One ink per domino class"
            checked={state.multiInk}
            onChange={(v) => update({ multiInk: v })}
          />
          {state.multiInk ? (
            <>
              <ColorField
                label="North"
                value={state.northColor}
                onChange={(v) => update({ northColor: v })}
              />
              <ColorField
                label="South"
                value={state.southColor}
                onChange={(v) => update({ southColor: v })}
              />
              <ColorField
                label="East"
                value={state.eastColor}
                onChange={(v) => update({ eastColor: v })}
              />
              <ColorField
                label="West"
                value={state.westColor}
                onChange={(v) => update({ westColor: v })}
              />
            </>
          ) : (
            <ColorField
              label="Ink"
              value={state.strokeColor}
              onChange={(v) => update({ strokeColor: v })}
            />
          )}
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
