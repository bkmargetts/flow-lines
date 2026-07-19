import { RD_PRESETS, type RDPreset } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { RDState } from './types';

const PRESET_LABELS: Record<RDPreset, string> = {
  coral: 'Coral (branching)',
  mitosis: 'Mitosis (dividing spots)',
  maze: 'Maze (labyrinth)',
  fingerprint: 'Fingerprint (ridges)',
  holes: 'Holes (bubbles)',
  waves: 'Waves (fronts)',
  solitons: 'Solitons (pulses)',
  worms: 'Worms (filaments)',
};

const RD_STYLES: RDState['style'][] = ['contour', 'hatch', 'dual'];
const RD_SEED_LAYOUTS: RDState['seedLayout'][] = ['scatter', 'center', 'grid'];

/** Roll a whole new reaction. Most of the raw feed/kill plane is a dead
 *  (blank or uniform) field, so the roll anchors on the preset table — a
 *  random pattern regime plus a tiny f/k jitter so repeat rolls of the same
 *  preset still differ — then rolls the render treatment freely. Steps and
 *  grid resolution stay below their slider maxima (sim cost is grid²·steps).
 *  The art-style master switch, U/V diffusion and the pen/ink prefs are left
 *  alone. Exported for the genome test. */
export function randomRDGenome(rng: () => number): Partial<RDState> {
  const presets = Object.keys(RD_PRESETS) as RDPreset[];
  const preset = presets[Math.floor(rng() * presets.length)];
  const { f, k } = RD_PRESETS[preset];
  const jitter = () => (rng() - 0.5) * 0.003;
  return {
    preset,
    feed: Number(Math.min(0.09, Math.max(0.01, f + jitter())).toFixed(4)),
    kill: Number(Math.min(0.07, Math.max(0.03, k + jitter())).toFixed(4)),
    style: RD_STYLES[Math.floor(rng() * RD_STYLES.length)],
    contourLevels: 3 + Math.floor(rng() * 8),
    fillThreshold: Number((0.2 + 0.02 * Math.floor(rng() * 21)).toFixed(2)),
    steps: 2000 + 250 * Math.floor(rng() * 13),
    gridCols: 100 + 2 * Math.floor(rng() * 51),
    seedLayout: RD_SEED_LAYOUTS[Math.floor(rng() * RD_SEED_LAYOUTS.length)],
    seedSpots: 3 + Math.floor(rng() * 22),
    blurSigma: Number((0.6 + 0.1 * Math.floor(rng() * 15)).toFixed(1)),
    wobble: Number((0.2 + rng() * 1.8).toFixed(1)),
    hatchAngle: Math.round(-90 + rng() * 180),
    crossHatchAmount: Number((0.05 * Math.floor(rng() * 21)).toFixed(2)),
    hatchJitter: Number((0.05 * Math.floor(rng() * 21)).toFixed(2)),
    valueBands: rng() < 0.25 ? 0 : 3 + Math.floor(rng() * 5),
    vignette: Number((0.05 * Math.floor(rng() * 15)).toFixed(2)),
  };
}

/** Sidebar controls for the Reaction–Diffusion module. */
export function RDControls({ state, update }: ControlsProps<RDState>) {
  const updateState = update;

  // The preset sets a feed/kill base; the advanced sliders fine-tune from there.
  const selectPreset = (preset: RDPreset) => {
    const { f, k } = RD_PRESETS[preset];
    updateState({ preset, feed: f, kill: k });
  };

  const surprise = () => update({ ...randomRDGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a whole new reaction — or tune anything below." />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Pattern"
        info="The feed/kill regime the two chemicals settle into. Coral branches outward; mitosis divides into spots; maze and fingerprint fill with corridors and ridges; waves and solitons make fronts and isolated pulses. Each just sets a starting feed/kill — fine-tune them under Advanced."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <div className="control-group">
        <label>
          <span className="label-text">
            Style
            <InfoTip text="Contour: nested iso-contours of the chemical field — organic topographic line work. Hatch: the dense regions filled with angled hatching and a confident outline. Dual: contour lines wrapped around a hatched solid core, for a multi-pen plot." />
          </span>
        </label>
        <select
          value={state.style}
          onChange={(e) => updateState({ style: e.target.value as RDState['style'] })}
        >
          <option value="contour">Contour ridges (organic)</option>
          <option value="hatch">Hatch fill (mass)</option>
          <option value="dual">Dual (lines + core)</option>
        </select>
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.artStyle}
            onChange={(e) => updateState({ artStyle: e.target.checked })}
          />
          Art style
          <InfoTip text="The hand-drawn treatment: the field commits to a few tonal bands, contours wobble and hold off the frame corners, and the drawing sits clear of the page edge so the shared border frames it. Turn off for the faithful, literal field." />
        </label>
      </div>

      {state.style !== 'hatch' && (
        <Slider
          labelNode={
            <span className="label-text">
              Contour levels
              <InfoTip text="How many nested iso-contours trace the field. More levels give a finer tonal gradient (denser shading); fewer give bold, sparse rings." />
            </span>
          }
          value={state.contourLevels}
          min={2}
          max={12}
          step={1}
          onChange={(v) => updateState({ contourLevels: v })}
        />
      )}

      {state.style !== 'contour' && (
        <Slider
          labelNode={
            <span className="label-text">
              Fill threshold
              <InfoTip text="How concentrated the chemical must be before a region is hatched solid. Lower fills more of the field; higher inks only the densest cores." />
            </span>
          }
          value={state.fillThreshold}
          min={0.1}
          max={0.8}
          step={0.02}
          onChange={(v) => updateState({ fillThreshold: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      <h3 className="section-title">Simulation</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Steps
            <InfoTip text="How long the reaction runs before the shutter closes. Patterns start as small seeds and grow/branch over thousands of steps — more steps mean a more developed, frame-filling structure." />
          </span>
        }
        value={state.steps}
        min={1000}
        max={6000}
        step={250}
        onChange={(v) => updateState({ steps: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Grid resolution
            <InfoTip text="Width of the simulation grid in cells (rows follow the page shape). Finer grids resolve smaller features and longer lines but take longer to simulate and plot." />
          </span>
        }
        value={state.gridCols}
        min={64}
        max={250}
        step={2}
        onChange={(v) => updateState({ gridCols: v })}
      />

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed layout
            <InfoTip text="Where the initial chemical is dropped. Scatter strews blobs across the frame (busy, all-over); centre grows one structure from the middle (a single specimen); grid seeds a regular lattice (even, tiled patterns)." />
          </span>
        </label>
        <select
          value={state.seedLayout}
          onChange={(e) => updateState({ seedLayout: e.target.value as RDState['seedLayout'] })}
        >
          <option value="scatter">Scatter</option>
          <option value="center">Centre</option>
          <option value="grid">Grid</option>
        </select>
      </div>

      {state.seedLayout !== 'center' && (
        <Slider
          labelNode={
            <span className="label-text">
              Seed spots
              <InfoTip text="How many blobs of chemical are dropped to start. More seeds means a busier frame where neighbouring growths collide and interleave." />
            </span>
          }
          value={state.seedSpots}
          min={1}
          max={40}
          step={1}
          onChange={(v) => updateState({ seedSpots: v })}
        />
      )}

      <h3 className="section-title">Style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the filled cores read cleanly." />
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
          <InfoTip text="Draw the dense core, mid field and faint rim contours in different inks. Each layer still plots with one pen, and the per-layer SVG export keeps them separate — a genuine 2–3 pen plot, not a colour trick." />
        </label>
      </div>

      {state.multiInk ? (
        <>
          <ColorField
            label="Core ink"
            value={state.coreColor}
            onChange={(coreColor) => updateState({ coreColor })}
            info="Ink for the dense core — the darkest, most committed marks."
          />
          <ColorField
            label="Mid ink"
            value={state.midColor}
            onChange={(midColor) => updateState({ midColor })}
            info="Ink for the mid field — the bulk of the contour line work."
          />
          <ColorField
            label="Rim ink"
            value={state.rimColor}
            onChange={(rimColor) => updateState({ rimColor })}
            info="Ink for the faint outer rim contours — the lightest marks."
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
            <InfoTip text="The reaction is deterministic — the seed only sets where the starting blobs are dropped, giving a different composition without changing the chemistry." />
          </span>
        </label>
      </SeedControl>

      <AdvancedSection>
        <AdvGroup title="Reaction">
          <Slider
            labelNode={
              <span className="label-text">
                Feed rate (f)
                <InfoTip text="How fast chemical U is replenished. Together with the kill rate this sets which pattern forms — the Pattern presets just pick a starting pair. Small changes can completely change the structure." />
              </span>
            }
            value={state.feed}
            min={0.01}
            max={0.09}
            step={0.0005}
            onChange={(v) => updateState({ feed: v })}
            format={(v) => v.toFixed(4)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Kill rate (k)
                <InfoTip text="How fast chemical V is removed. Paired with the feed rate it tunes the regime; nudge both to wander between coral, spots and mazes." />
              </span>
            }
            value={state.kill}
            min={0.03}
            max={0.07}
            step={0.0005}
            onChange={(v) => updateState({ kill: v })}
            format={(v) => v.toFixed(4)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                U diffusion
                <InfoTip text="How fast chemical U spreads. The classic patterns want U spreading about twice as fast as V; drift it to stretch or freeze the structure." />
              </span>
            }
            value={state.du}
            min={0.4}
            max={1.2}
            step={0.05}
            onChange={(v) => updateState({ du: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                V diffusion
                <InfoTip text="How fast chemical V spreads. Keeping it around half the U diffusion is what gives the Turing instability its characteristic scale." />
              </span>
            }
            value={state.dv}
            min={0.2}
            max={0.7}
            step={0.05}
            onChange={(v) => updateState({ dv: v })}
            format={(v) => v.toFixed(2)}
          />
        </AdvGroup>

        <AdvGroup title="Field & hand">
          <Slider
            labelNode={
              <span className="label-text">
                Field smoothing
                <InfoTip text="Gaussian blur applied to the chemical field before the contours are traced. More smoothing gives cleaner, calmer lines; less keeps the fine detail (and the line count)." />
              </span>
            }
            value={state.blurSigma}
            min={0.4}
            max={3}
            step={0.1}
            onChange={(v) => updateState({ blurSigma: v })}
            format={(v) => v.toFixed(1)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Wobble
                <InfoTip text="Hand-drawn shake on the strokes. Faint rim contours wobble most; the dense core stays steady. 0 is ruler-smooth." />
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

        {state.artStyle && (
          <AdvGroup title="Art — value & composition">
            <Slider
              labelNode={
                <span className="label-text">
                  Value bands
                  <InfoTip text="Commit the field to this many decisive value shapes instead of continuous gradation — the artist's tonal abstraction. 0 keeps continuous tone." />
                </span>
              }
              value={state.valueBands}
              min={0}
              max={8}
              step={1}
              onChange={(v) => updateState({ valueBands: v })}
              format={(v) => (v === 0 ? 'Continuous' : v)}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Hatch angle
                  <InfoTip text="Direction of the strokes filling the dense regions (hatch and dual styles). The cross-hatch layer sits at a shallow offset to this." />
                </span>
              }
              value={state.hatchAngle}
              min={-90}
              max={90}
              step={1}
              onChange={(v) => updateState({ hatchAngle: v })}
              format={(v) => `${v}°`}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Cross-hatch amount
                  <InfoTip text="How much of the filled region gets a second layer of hatching at a shallow angle — more darkens and enriches the core; less keeps it open and linear." />
                </span>
              }
              value={state.crossHatchAmount}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateState({ crossHatchAmount: v })}
              format={(v) => v.toFixed(2)}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Hatch jitter
                  <InfoTip text="Low-frequency variation in hatch spacing and phase, so the fill reads as a hand laying down strokes rather than an even mechanical screen." />
                </span>
              }
              value={state.hatchJitter}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateState({ hatchJitter: v })}
              format={(v) => v.toFixed(2)}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Corner vignette
                  <InfoTip text="Hold faint contours off the frame corners so the negative space reads as a decision. Higher clears more; 0 lets the field run to the edges." />
                </span>
              }
              value={state.vignette}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateState({ vignette: v })}
              format={(v) => v.toFixed(2)}
            />
          </AdvGroup>
        )}
      </AdvancedSection>
    </div>
  );
}
