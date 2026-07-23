import { CORAL_PRESETS, type CoralPreset, type CoralSeedShape } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import type { ControlsProps } from '../../modules/types';
import type { CoralState } from './types';

const PRESET_LABELS: Record<CoralPreset, string> = {
  reef: 'Reef (edge + history)',
  brain: 'Brain (tight folds)',
  lichen: 'Lichen (colonies)',
  bloom: 'Bloom (onion rings)',
  maze: 'Maze (page labyrinth)',
};

const SEED_SHAPE_LABELS: Record<CoralSeedShape, string> = {
  circle: 'Circle',
  polygon: 'Polygon',
  line: 'Line (pinned)',
  blobs: 'Blobs (colonies)',
};

/** The presets' page-relative fold wavelength, translated to millimetres for
 * the physical slider (anchored at the ~190mm inner dimension of A4). */
const PRESET_REPULSION_MM: Record<CoralPreset, number> = {
  reef: 7,
  brain: 5,
  lichen: 6.5,
  bloom: 9.5,
  maze: 7,
};

/**
 * Roll a whole new organism. Every knob lands inside its slider's range but
 * biased off the extremes so a roll never comes out unreadable (or takes tens
 * of seconds to grow); the pen/ink aesthetic prefs (colors, pen width,
 * multi-ink) and the preset label are left alone. Exported for the genome
 * test.
 */
export function randomCoralGenome(rng: () => number): Partial<CoralState> {
  const seedShape: CoralSeedShape =
    rng() < 0.45 ? 'circle' : rng() < 0.45 ? 'polygon' : rng() < 0.55 ? 'blobs' : 'line';
  return {
    iterations: 150 + Math.round(rng() * 550),
    growth: Number((0.25 + rng() * 0.7).toFixed(2)),
    repulsionMm: Number((3 + rng() * 7).toFixed(1)),
    maxNodes: 1200 + Math.round(rng() * 2800),
    noiseScale: Number((0.08 + rng() * 0.3).toFixed(2)),
    patchiness: Number((rng() * 0.9).toFixed(2)),
    curvatureBias: Number((rng() * 0.9).toFixed(2)),
    jitter: Number((0.05 + rng() * 0.6).toFixed(2)),
    seedShape,
    blobs: 2 + Math.floor(rng() * 5),
    rings: Math.round(rng() * 30),
    fade: Number((0.2 + rng() * 0.7).toFixed(2)),
    boldPasses: 1 + Math.floor(rng() * 4),
    wobble: Number((0.2 + rng() * 1.3).toFixed(1)),
  };
}

/** Sidebar controls for the Coral module. */
export function CoralControls({ state, update }: ControlsProps<CoralState>) {
  const updateState = update;

  // The preset binds the organism's life story and the ink treatment; the
  // sliders fine-tune from there.
  const selectPreset = (preset: CoralPreset) => {
    const p = CORAL_PRESETS[preset];
    updateState({
      preset,
      seedShape: p.seedShape,
      iterations: p.iterations,
      growth: p.growth,
      repulsionMm: PRESET_REPULSION_MM[preset],
      patchiness: p.patchiness,
      curvatureBias: p.curvatureBias,
      maxNodes: p.maxNodes,
      rings: p.rings,
      fade: p.fade,
      boldPasses: p.boldPasses,
    });
  };

  const surprise = () => update({ ...randomCoralGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton
        onClick={surprise}
        hint="One roll for a whole new organism — or tune anything below."
      />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Look"
        info="Reef is a balanced colony: a dense folded edge over a readable belt of growth history. Brain grows long and uniform into tight folds. Lichen scatters colonies that crowd each other. Bloom is a lobed flower of onion-skin rings — the history is the drawing. Maze pins a line across the page and lets it buckle into a labyrinth. Each just sets the simulation and ink parameters — fine-tune below."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <PresetPicker
        label="Seed shape"
        info="The geometry the organism grows from. A circle folds into a radial mass, a polygon into lobes, blobs into scattered colonies that tile against each other, and a pinned line buckles into a page-filling labyrinth."
        labels={SEED_SHAPE_LABELS}
        value={state.seedShape}
        onChange={(seedShape) => updateState({ seedShape })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Age
            <InfoTip text="Growth steps the organism has lived through. Older corals grow more folds and press them tighter — until the density cap stops them." />
          </span>
        }
        value={state.iterations}
        min={100}
        max={1200}
        step={10}
        onChange={(v) => updateState({ iterations: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Fold scale
            <InfoTip text="The physical wavelength the curve buckles at, in millimetres — the width of a fold on paper. Everything else scales from it." />
          </span>
        }
        value={state.repulsionMm}
        min={2}
        max={12}
        step={0.5}
        onChange={(v) => updateState({ repulsionMm: v })}
        format={(v) => `${v}mm`}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Rings
            <InfoTip text="How many onion-skin snapshots of the growth stay drawn — the organism's memory. 0 leaves only the bold final silhouette." />
          </span>
        }
        value={state.rings}
        min={0}
        max={40}
        step={1}
        onChange={(v) => updateState({ rings: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Fade
            <InfoTip text="How aggressively old rings fragment with age. High leaves the deep past as drifting dashes; 0 keeps every ring fully inked." />
          </span>
        }
        value={Math.round(state.fade * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => updateState({ fade: v / 100 })}
        format={(v) => `${v}%`}
      />

      <h3 className="section-title">Style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the folds read cleanly." />
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
          <InfoTip text="Draw the final silhouette, the recent rings and the oldest rings in different inks. Each layer still plots with one pen, and the per-layer SVG export keeps them separate — a genuine 2–3 pen plot, not a colour trick." />
        </label>
      </div>

      {state.multiInk ? (
        <>
          <ColorField
            label="Edge ink"
            value={state.edgeColor}
            onChange={(edgeColor) => updateState({ edgeColor })}
            info="Ink for the bold final silhouette."
          />
          <ColorField
            label="Ring ink"
            value={state.ringColor}
            onChange={(ringColor) => updateState({ ringColor })}
            info="Ink for the recent history rings."
          />
          <ColorField
            label="Relic ink"
            value={state.relicColor}
            onChange={(relicColor) => updateState({ relicColor })}
            info="Ink for the oldest, most fragmented rings — let the past literally pale."
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
            <InfoTip text="The simulation is deterministic — the seed sets the seed geometry, the fertile patches and where the pen lifts, giving a different organism without changing the behaviour." />
          </span>
        </label>
      </SeedControl>

      <AdvancedSection>
        <AdvGroup title="Growth">
          <Slider
            labelNode={
              <span className="label-text">
                Growth rate
                <InfoTip text="How eagerly the curve inserts new material. High fills its cap fast and buckles hard; low grows a sparse, open form." />
              </span>
            }
            value={Math.round(state.growth * 100)}
            min={5}
            max={100}
            step={1}
            onChange={(v) => updateState({ growth: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Density cap
                <InfoTip text="The node budget growth stops at. More material folds further and fills more paper — and takes longer to simulate." />
              </span>
            }
            value={state.maxNodes}
            min={800}
            max={6000}
            step={100}
            onChange={(v) => updateState({ maxNodes: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Patchiness
                <InfoTip text="How hard the fertility noise gates growth into patches. High grows hand-sized lobes with quiet arcs between; 0 buckles evenly everywhere." />
              </span>
            }
            value={Math.round(state.patchiness * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateState({ patchiness: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Patch size
                <InfoTip text="The size of the fertile patches, as a fraction of the page. Bigger commits whole flanks to growing or resting; smaller speckles the fertility." />
              </span>
            }
            value={state.noiseScale}
            min={0.06}
            max={0.4}
            step={0.01}
            onChange={(v) => updateState({ noiseScale: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Tip bias
                <InfoTip text="Growth preference for outward tips. High makes lobes ramify the way real coral does; 0 grows folds without favourites." />
              </span>
            }
            value={Math.round(state.curvatureBias * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateState({ curvatureBias: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Jitter
                <InfoTip text="A whisper of random nudge per node. A little keeps perfectly symmetric growth from stalling; a lot makes a nervous, crumbly curve." />
              </span>
            }
            value={Math.round(state.jitter * 100)}
            min={0}
            max={80}
            step={1}
            onChange={(v) => updateState({ jitter: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Blobs
                <InfoTip text="Colony count for the blobs seed shape — ignored by the other seeds." />
              </span>
            }
            value={state.blobs}
            min={2}
            max={6}
            step={1}
            onChange={(v) => updateState({ blobs: v })}
          />
        </AdvGroup>

        <AdvGroup title="Ink & hand">
          <Slider
            labelNode={
              <span className="label-text">
                Bold passes
                <InfoTip text="How many offset passes of the same pen build up the final silhouette. More passes read heavier — still a single pen, never a stroke-width trick." />
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
                <InfoTip text="Hand-drawn shake on the strokes. The old rings wobble most; the silhouette stays steady. 0 is ruler-smooth." />
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
