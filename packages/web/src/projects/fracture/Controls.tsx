import { FRACTURE_PRESETS, type FracturePreset } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps } from '../../modules/types';
import type { FractureState } from './types';

const PRESET_LABELS: Record<FracturePreset, string> = {
  mud: 'Mud (bold plates)',
  crazing: 'Crazing (fine net)',
  shatter: 'Shatter (from the edges)',
};

/**
 * Roll a whole new fracture. Every knob lands inside its slider's range but
 * biased off the extremes so a roll never comes out unreadable; the pen/ink
 * aesthetic prefs (colors, pen width, multi-ink) and the preset label are left
 * alone. Exported for the genome test.
 */
export function randomFractureGenome(rng: () => number): Partial<FractureState> {
  return {
    generations: 1 + Math.floor(rng() * 4),
    crackDensity: Number((0.15 + rng() * 0.8).toFixed(2)),
    straightness: Number((0.2 + rng() * 0.75).toFixed(2)),
    // Isotropic mud most rolls; sometimes a directional crazing grain.
    anisotropy: rng() < 0.55 ? 0 : Number((0.2 + rng() * 0.6).toFixed(2)),
    anisotropyAngleDeg: 5 * Math.round(rng() * 36),
    stressScale: Number((0.15 + rng() * 0.45).toFixed(2)),
    jitter: Number((0.1 + rng() * 0.75).toFixed(2)),
    arrestThreshold: Number((rng() * 0.5).toFixed(2)),
    edgeNucleation: rng() < 0.7 ? 0 : Number((0.3 + rng() * 0.6).toFixed(2)),
    plateHatch: rng() < 0.65,
    hatchCoverage: Number((0.15 + rng() * 0.65).toFixed(2)),
    hatchAngleDeg: Math.round(-70 + rng() * 140),
    edgeCurl: Number((rng() * 0.9).toFixed(2)),
    boldPasses: 1 + Math.floor(rng() * 5),
    wobble: Number((0.2 + rng() * 1.3).toFixed(1)),
  };
}

/** Sidebar controls for the Fracture module. */
export function FractureControls({ state, update }: ControlsProps<FractureState>) {
  const updateState = update;

  // The preset binds the growth behaviour and the ink treatment; the sliders
  // fine-tune from there.
  const selectPreset = (preset: FracturePreset) => {
    const p = FRACTURE_PRESETS[preset];
    updateState({
      preset,
      generations: p.generations,
      crackDensity: p.crackDensity,
      straightness: p.straightness,
      anisotropy: p.anisotropy,
      edgeNucleation: p.edgeNucleation,
      plateHatch: p.plateHatch,
      hatchCoverage: p.hatchCoverage,
      edgeCurl: p.edgeCurl,
      boldPasses: p.boldPasses,
    });
  };

  const surprise = () => update({ ...randomFractureGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a whole new fracture — or tune anything below." />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Look"
        info="Mud is a dried riverbed: a few bold committed plates subdivided by finer cracks, lightly facet-hatched. Crazing is ceramic glaze: a dense fine net, no bold, no fill. Shatter drives long primaries in from the edges with hard facets and heavy curl shadows. Each just sets the growth and ink parameters — fine-tune below."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Generations
            <InfoTip text="How many rounds of cracking the sheet endures. The first generation spans big bold plates; each later one can only subdivide the plates the earlier ones left — the hierarchy of real mud cracks." />
          </span>
        }
        value={state.generations}
        min={1}
        max={4}
        step={1}
        onChange={(v) => updateState({ generations: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Crack density
            <InfoTip text="How eagerly the sheet nucleates new cracks. Low leaves a few monumental plates; high shatters it fine. Existing cracks always screen their neighbourhood, so density never degrades into scribble." />
          </span>
        }
        value={Math.round(state.crackDensity * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => updateState({ crackDensity: v / 100 })}
        format={(v) => `${v}%`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Straightness
            <InfoTip text="Tip inertia. High makes confident straight primaries that read as brittle shatter; low lets cracks meander and arc — softer, muddier character." />
          </span>
        }
        value={Math.round(state.straightness * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => updateState({ straightness: v / 100 })}
        format={(v) => `${v}%`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Alignment
            <InfoTip text="Pulls crack directions toward one shared axis (set the axis under Advanced). 0 is isotropic mud; higher reads as directional crazing — stress with a grain." />
          </span>
        }
        value={Math.round(state.anisotropy * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => updateState({ anisotropy: v / 100 })}
        format={(v) => `${v}%`}
      />

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.plateHatch}
            onChange={(e) => updateState({ plateHatch: e.target.checked })}
          />
          Plate hatching
          <InfoTip text="Shade some plates with facet hatching — every plate at its own confident angle, the way ink artists shade broken ground patch by patch. Off leaves the pure crack network." />
        </label>
      </div>

      {state.plateHatch && (
        <>
          <Slider
            labelNode={
              <span className="label-text">
                Hatch coverage
                <InfoTip text="What fraction of the plates get hatched. Restraint is the point — paper does most of the work, and a few committed dark facets carry the tone." />
              </span>
            }
            value={Math.round(state.hatchCoverage * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateState({ hatchCoverage: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Edge curl
                <InfoTip text="A tighter hatch band hugging the crack edges — the shadow of a plate curling up off the sheet, the signature of deep dried mud. 0 keeps the plates flat." />
              </span>
            }
            value={Math.round(state.edgeCurl * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateState({ edgeCurl: v / 100 })}
            format={(v) => `${v}%`}
          />
        </>
      )}

      <h3 className="section-title">Style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the crack web reads cleanly." />
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
          <InfoTip text="Draw the bold primary cracks, the fine crack web and the plate hatching in different inks. Each layer still plots with one pen, and the per-layer SVG export keeps them separate — a genuine 2–3 pen plot, not a colour trick." />
        </label>
      </div>

      {state.multiInk ? (
        <>
          <ColorField
            label="Primary ink"
            value={state.primaryColor}
            onChange={(primaryColor) => updateState({ primaryColor })}
            info="Ink for the bold first-generation cracks — the big committed spans."
          />
          <ColorField
            label="Fine ink"
            value={state.fineColor}
            onChange={(fineColor) => updateState({ fineColor })}
            info="Ink for the finer crack generations — the subdividing web."
          />
          <ColorField
            label="Plate ink"
            value={state.plateColor}
            onChange={(plateColor) => updateState({ plateColor })}
            info="Ink for the plate facet hatching and curl shadows."
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
            <InfoTip text="The simulation is deterministic — the seed sets the stress field, where cracks nucleate and how tips wander, giving a different fracture without changing the behaviour." />
          </span>
        </label>
      </SeedControl>

      <AdvancedSection>
        <AdvGroup title="Growth">
          <Slider
            labelNode={
              <span className="label-text">
                Stress scale
                <InfoTip text="Feature size of the stress field, as a fraction of the page. Bigger features make broad calm regions and broad busy ones; smaller speckles the variation finely." />
              </span>
            }
            value={state.stressScale}
            min={0.1}
            max={0.8}
            step={0.05}
            onChange={(v) => updateState({ stressScale: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Jitter
                <InfoTip text="Per-step shake on a growing tip. More makes ragged, nervous cracks; less draws clean confident lines." />
              </span>
            }
            value={state.jitter}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateState({ jitter: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Arrest threshold
                <InfoTip text="Stress below this stops a growing tip, leaving calm regions of the sheet uncracked. Higher keeps more open paper; 0 cracks everything." />
              </span>
            }
            value={state.arrestThreshold}
            min={0}
            max={0.6}
            step={0.05}
            onChange={(v) => updateState({ arrestThreshold: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Edge seeding
                <InfoTip text="Fraction of the primary cracks that start on the frame border and drive inward — the shatter look. 0 nucleates everything in the field." />
              </span>
            }
            value={Math.round(state.edgeNucleation * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateState({ edgeNucleation: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Alignment axis
                <InfoTip text="The shared axis cracks align to when Alignment is above 0, in degrees. 90 runs them vertically." />
              </span>
            }
            value={state.anisotropyAngleDeg}
            min={0}
            max={180}
            step={5}
            onChange={(v) => updateState({ anisotropyAngleDeg: v })}
            format={(v) => `${v}°`}
          />
        </AdvGroup>

        <AdvGroup title="Ink & hand">
          <Slider
            labelNode={
              <span className="label-text">
                Bold passes
                <InfoTip text="How many offset passes of the same pen build up the primary cracks. More passes read heavier — still a single pen, never a stroke-width trick." />
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
                Hatch angle
                <InfoTip text="Base direction of the plate facet hatching. Every plate deviates from it by its own angle, so the facets read patch by patch." />
              </span>
            }
            value={state.hatchAngleDeg}
            min={-90}
            max={90}
            step={1}
            onChange={(v) => updateState({ hatchAngleDeg: v })}
            format={(v) => `${v}°`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Wobble
                <InfoTip text="Hand-drawn shake on the strokes. Plate hatching wobbles most; the bold primaries stay steady. 0 is ruler-smooth." />
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
