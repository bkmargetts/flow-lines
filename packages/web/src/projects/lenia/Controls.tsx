import { LENIA_PRESETS, type LeniaPreset } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { LeniaState } from './types';

const PRESET_LABELS: Record<LeniaPreset, string> = {
  orbium: 'Orbium (gliders)',
  cells: 'Cells (colony)',
  rings: 'Rings (target waves)',
  pulse: 'Pulse (symmetric)',
};

const LENIA_STYLES: LeniaState['style'][] = ['contour', 'hatch', 'dual'];

/** Roll a whole new specimen. Lenia's viable μ/σ/kernel space is razor-thin
 *  (Orbium dies outside a hair's width), so the roll anchors on the preset
 *  table — the full rule bundle exactly as selectPreset sets it, never
 *  jittered — then rolls the run length and render treatment freely. Steps
 *  and grid resolution stay below their slider maxima (sim cost is
 *  grid²·R²·steps), and seed spots cap at 6 so the roll is valid for either
 *  seed pattern. The art-style master switch and the pen/ink prefs are left
 *  alone. Exported for the genome test. */
export function randomLeniaGenome(rng: () => number): Partial<LeniaState> {
  const presets = Object.keys(LENIA_PRESETS) as LeniaPreset[];
  const preset = presets[Math.floor(rng() * presets.length)];
  const p = LENIA_PRESETS[preset];
  return {
    preset,
    kernelRadius: p.R,
    mu: p.mu,
    sigma: p.sigma,
    timeRes: p.T,
    beta: p.beta,
    seedPattern: p.seedPattern,
    longExposure: p.longExposure,
    steps: 160 + 20 * Math.floor(rng() * 18),
    gridCols: 84 + 2 * Math.floor(rng() * 34),
    seedSpots: 1 + Math.floor(rng() * 6),
    decay: Number((0.92 + 0.002 * Math.floor(rng() * 39)).toFixed(3)),
    gamma: Number((0.35 + 0.05 * Math.floor(rng() * 13)).toFixed(2)),
    style: LENIA_STYLES[Math.floor(rng() * LENIA_STYLES.length)],
    contourLevels: 3 + Math.floor(rng() * 8),
    fillThreshold: Number((0.2 + 0.02 * Math.floor(rng() * 21)).toFixed(2)),
    blurSigma: Number((0.6 + 0.1 * Math.floor(rng() * 15)).toFixed(1)),
    wobble: Number((0.2 + rng() * 1.8).toFixed(1)),
    hatchAngle: Math.round(-90 + rng() * 180),
    crossHatchAmount: Number((0.05 * Math.floor(rng() * 21)).toFixed(2)),
    hatchJitter: Number((0.05 * Math.floor(rng() * 21)).toFixed(2)),
    valueBands: rng() < 0.25 ? 0 : 3 + Math.floor(rng() * 5),
    vignette: Number((0.05 * Math.floor(rng() * 15)).toFixed(2)),
  };
}

/** Sidebar controls for the Lenia module. */
export function LeniaControls({ state, update }: ControlsProps<LeniaState>) {
  const updateState = update;

  // The preset binds a rule (kernel + growth) and a seed pattern; the advanced
  // sliders fine-tune from there.
  const selectPreset = (preset: LeniaPreset) => {
    const p = LENIA_PRESETS[preset];
    updateState({
      preset,
      kernelRadius: p.R,
      mu: p.mu,
      sigma: p.sigma,
      timeRes: p.T,
      beta: p.beta,
      seedPattern: p.seedPattern,
      longExposure: p.longExposure,
    });
  };

  const surprise = () => update({ ...randomLeniaGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a whole new specimen — or tune anything below." />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Lifeform"
        info="The rule the continuous automaton settles into. Orbium grows solitary gliders that travel and leave trails; cells and rings form pulsing colonies and target waves; pulse seeds a symmetric specimen. Each just sets a starting kernel + growth — fine-tune them under Advanced."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <div className="control-group">
        <label>
          <span className="label-text">
            Style
            <InfoTip text="Contour: nested iso-contours of the life field — organic topographic line work. Hatch: the dense regions filled with angled hatching and a confident outline. Dual: contour lines wrapped around a hatched solid core, for a multi-pen plot." />
          </span>
        </label>
        <select
          value={state.style}
          onChange={(e) => updateState({ style: e.target.value as LeniaState['style'] })}
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
              <InfoTip text="How dense the life field must be before a region is hatched solid. Lower fills more of the field; higher inks only the densest cores." />
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

      <h3 className="section-title">Long exposure</h3>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.longExposure}
            onChange={(e) => updateState({ longExposure: e.target.checked })}
          />
          Trail the creatures
          <InfoTip text="Hold the shutter open across the whole run: every cell records the brightest it ever was, so a gliding creature leaves a comet trail of where it has been, with the final living form traced crisp on top. Off draws only the final frame — a still life of the colony." />
        </label>
      </div>

      {state.longExposure && (
        <>
          <Slider
            labelNode={
              <span className="label-text">
                Trail length
                <InfoTip text="How slowly old trail fades (the per-step decay). Higher holds longer comet tails; lower keeps only the recent wake." />
              </span>
            }
            value={state.decay}
            min={0.9}
            max={0.998}
            step={0.002}
            onChange={(v) => updateState({ decay: v })}
            format={(v) => v.toFixed(3)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Trail lift
                <InfoTip text="Perceptual brightening of the faint trail before it is traced. A moving creature deposits little per cell, so a lift below 1 makes the ghostly tails visible against the solid present." />
              </span>
            }
            value={state.gamma}
            min={0.3}
            max={1}
            step={0.05}
            onChange={(v) => updateState({ gamma: v })}
            format={(v) => v.toFixed(2)}
          />
        </>
      )}

      <h3 className="section-title">Simulation</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Steps
            <InfoTip text="How long the automaton runs before the shutter closes. Creatures emerge from the seed and travel/develop over time — more steps means longer trails and more mature colonies, but gliders can eventually collide and die out, so very long runs may thin." />
          </span>
        }
        value={state.steps}
        min={100}
        max={700}
        step={20}
        onChange={(v) => updateState({ steps: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Grid resolution
            <InfoTip text="Width of the simulation grid in cells (rows follow the page shape). Finer grids resolve smaller features and longer lines but take longer to simulate and plot. Below ~72 a colony has too little room to ignite." />
          </span>
        }
        value={state.gridCols}
        min={72}
        max={180}
        step={2}
        onChange={(v) => updateState({ gridCols: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            {state.seedPattern === 'orbium' ? 'Gliders' : 'Seed spots'}
            <InfoTip text="How many starting forms are dropped — gliders for Orbium, soup patches for the colonies. More makes a busier frame where neighbouring growths collide and interleave." />
          </span>
        }
        value={state.seedSpots}
        min={1}
        max={state.seedPattern === 'orbium' ? 6 : 8}
        step={1}
        onChange={(v) => updateState({ seedSpots: v })}
      />

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
            info="Ink for the faint outer rim contours (and the comet trails) — the lightest marks."
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
            <InfoTip text="The simulation is deterministic — the seed only sets where the starting forms and their headings land, giving a different composition without changing the rule." />
          </span>
        </label>
      </SeedControl>

      <AdvancedSection>
        <AdvGroup title="Rule">
          <Slider
            labelNode={
              <span className="label-text">
                Kernel radius (R)
                <InfoTip text="How far each cell senses its neighbours. Larger radii grow bigger, slower creatures; the canonical Orbium wants R = 13. Bigger radii also cost more to simulate." />
              </span>
            }
            value={state.kernelRadius}
            min={6}
            max={18}
            step={1}
            onChange={(v) => updateState({ kernelRadius: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Growth centre (μ)
                <InfoTip text="The neighbourhood density a cell most wants. The whole character of the life — gliders vs colonies vs static blobs — lives in μ and σ; nudge them to wander between regimes." />
              </span>
            }
            value={state.mu}
            min={0.05}
            max={0.4}
            step={0.005}
            onChange={(v) => updateState({ mu: v })}
            format={(v) => v.toFixed(3)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Growth width (σ)
                <InfoTip text="How tolerant the growth is around μ. Tight σ gives sharp, fragile creatures (the Orbium is very tight); wider σ gives softer, more forgiving colonies." />
              </span>
            }
            value={state.sigma}
            min={0.008}
            max={0.06}
            step={0.001}
            onChange={(v) => updateState({ sigma: v })}
            format={(v) => v.toFixed(3)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Time resolution (T)
                <InfoTip text="How finely time is sliced (the step is 1/T). Higher T takes smaller, smoother steps — steadier creatures; lower T is coarser and more volatile." />
              </span>
            }
            value={state.timeRes}
            min={2}
            max={20}
            step={1}
            onChange={(v) => updateState({ timeRes: v })}
          />
        </AdvGroup>

        <AdvGroup title="Field & hand">
          <Slider
            labelNode={
              <span className="label-text">
                Field smoothing
                <InfoTip text="Gaussian blur applied to the life field before the contours are traced. More smoothing gives cleaner, calmer lines; less keeps the fine detail (and the line count)." />
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
