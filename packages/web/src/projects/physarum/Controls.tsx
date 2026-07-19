import { PHYSARUM_PRESETS, type PhysarumPreset } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { PhysarumState } from './types';

const PRESET_LABELS: Record<PhysarumPreset, string> = {
  network: 'Network (clean veins)',
  veins: 'Veins (thick channels)',
  denseWeb: 'Dense web (fine mesh)',
  explore: 'Explore (wandering)',
};

const LAYOUT_LABELS: Record<PhysarumState['startLayout'], string> = {
  scatter: 'Scatter (whole frame)',
  center: 'Centre (single colony)',
  ring: 'Ring (collapsing)',
};

const PHYSARUM_STYLES: PhysarumState['style'][] = ['paths', 'contour', 'hatch', 'dual'];

/** Roll a whole new colony. The behaviour anchors on the preset table (a
 *  random behaviour's sensing and trail chemistry, exactly as selectPreset
 *  sets it — free-rolled chemistry mostly dissolves into fog), then the run
 *  length, grid and render treatment roll freely. The agent count derives
 *  from the rolled grid at the preset's density so the colony always fits its
 *  arena, and the traced-path fraction caps at 30% (every trail of 30k agents
 *  is a monster plot). The art-style master switch and the pen/ink prefs are
 *  left alone. Exported for the genome test. */
export function randomPhysarumGenome(rng: () => number): Partial<PhysarumState> {
  const presets = Object.keys(PHYSARUM_PRESETS) as PhysarumPreset[];
  const preset = presets[Math.floor(rng() * presets.length)];
  const p = PHYSARUM_PRESETS[preset];
  const gridCols = 100 + 4 * Math.floor(rng() * 31);
  return {
    preset,
    sensorAngleDeg: p.sensorAngleDeg,
    sensorDistance: p.sensorDistance,
    rotationAngleDeg: p.rotationAngleDeg,
    stepSize: p.stepSize,
    depositAmount: p.depositAmount,
    decay: p.decay,
    diffuseRate: p.diffuseRate,
    startLayout: p.startLayout,
    gridCols,
    agentCount: Math.min(
      30000,
      Math.max(500, 500 * Math.round((p.agentDensity * gridCols * gridCols) / 500))
    ),
    steps: 200 + 25 * Math.floor(rng() * 25),
    style: PHYSARUM_STYLES[Math.floor(rng() * PHYSARUM_STYLES.length)],
    pathFraction: (2 + Math.floor(rng() * 29)) / 100,
    sampleEvery: 1 + Math.floor(rng() * 4),
    minPathLength: 4 + Math.floor(rng() * 17),
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

/** Sidebar controls for the Physarum module. */
export function PhysarumControls({ state, update }: ControlsProps<PhysarumState>) {
  const updateState = update;

  // The preset binds the agents' behaviour (sensors, deposit, decay) and a
  // starting layout; the sliders fine-tune from there. The agent count is
  // seeded from the preset's density over a square-ish grid as a sensible start.
  const selectPreset = (preset: PhysarumPreset) => {
    const p = PHYSARUM_PRESETS[preset];
    updateState({
      preset,
      sensorAngleDeg: p.sensorAngleDeg,
      sensorDistance: p.sensorDistance,
      rotationAngleDeg: p.rotationAngleDeg,
      stepSize: p.stepSize,
      depositAmount: p.depositAmount,
      decay: p.decay,
      diffuseRate: p.diffuseRate,
      startLayout: p.startLayout,
      agentCount: Math.round(p.agentDensity * state.gridCols * state.gridCols),
    });
  };

  const surprise = () => update({ ...randomPhysarumGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a whole new colony — or tune anything below." />

      <h3 className="section-title">Render</h3>

      <PresetPicker
        label="Behaviour"
        info="How the slime mold behaves. Network grows clean, well-separated transport veins (the canonical look); veins makes thicker, fewer organic channels; dense web packs a fine reticulated mesh; explore sends wandering filaments out from a ring. Each just sets the agents' sensing and trail chemistry — fine-tune under Agents."
        labels={PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <div className="control-group">
        <label>
          <span className="label-text">
            Style
            <InfoTip text="Paths: the agents' own trajectories traced as lines — the marks are literally the trails the slime laid down. Contour: nested iso-contours of the trail density (topographic line work). Hatch: the dense network filled with angled hatching and an outline. Dual: contour lines around a hatched core." />
          </span>
        </label>
        <select
          value={state.style}
          onChange={(e) => updateState({ style: e.target.value as PhysarumState['style'] })}
        >
          <option value="paths">Paths (agent trails)</option>
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
          <InfoTip text="The hand-drawn treatment: marks wobble and hold off the frame corners, the field commits to a few tonal bands, and the drawing sits clear of the page edge so the shared border frames it. Turn off for the faithful, literal network." />
        </label>
      </div>

      {state.style === 'paths' && (
        <>
          <Slider
            labelNode={
              <span className="label-text">
                Trail density
                <InfoTip text="What fraction of the agents have their trajectory drawn. The rest still crawl and lay trail (shaping the network the drawn ones follow) — this only thins the ink. Lower keeps the plot light and the veins legible." />
              </span>
            }
            value={Math.round(state.pathFraction * 100)}
            min={1}
            max={100}
            step={1}
            onChange={(v) => updateState({ pathFraction: v / 100 })}
            format={(v) => `${v}%`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Trail smoothness
                <InfoTip text="How often an agent's position is recorded (every N steps). Lower samples more finely — wigglier, heavier strokes; higher gives smoother, lighter polylines." />
              </span>
            }
            value={state.sampleEvery}
            min={1}
            max={8}
            step={1}
            onChange={(v) => updateState({ sampleEvery: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Min trail length
                <InfoTip text="Drop trajectory fragments shorter than this many cells, so dust and stubs don't clutter the plot. Higher keeps only the confident, established veins." />
              </span>
            }
            value={state.minPathLength}
            min={2}
            max={40}
            step={1}
            onChange={(v) => updateState({ minPathLength: v })}
          />
        </>
      )}

      {state.style !== 'paths' && state.style !== 'hatch' && (
        <Slider
          labelNode={
            <span className="label-text">
              Contour levels
              <InfoTip text="How many nested iso-contours trace the trail density. More levels give a finer tonal gradient (denser shading); fewer give bold, sparse rings." />
            </span>
          }
          value={state.contourLevels}
          min={2}
          max={12}
          step={1}
          onChange={(v) => updateState({ contourLevels: v })}
        />
      )}

      {(state.style === 'hatch' || state.style === 'dual') && (
        <Slider
          labelNode={
            <span className="label-text">
              Fill threshold
              <InfoTip text="How dense the trail must be before a region is hatched solid. Lower fills more of the network; higher inks only the busiest cores." />
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
            <InfoTip text="How long the colony crawls before the drawing is taken. The network self-organises over time — more steps lets the veins consolidate and thin into confident channels, fewer leaves a looser, more exploratory tangle." />
          </span>
        }
        value={state.steps}
        min={50}
        max={1000}
        step={25}
        onChange={(v) => updateState({ steps: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Grid resolution
            <InfoTip text="Width of the simulation grid in cells (rows follow the page shape). Finer grids resolve thinner veins and longer trails but take longer to simulate and plot." />
          </span>
        }
        value={state.gridCols}
        min={80}
        max={240}
        step={4}
        onChange={(v) => updateState({ gridCols: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Agents
            <InfoTip text="How many crawlers seed the network. More agents build a denser, busier web with stronger shared veins; fewer leave a sparse, delicate filigree." />
          </span>
        }
        value={state.agentCount}
        min={500}
        max={30000}
        step={500}
        onChange={(v) => updateState({ agentCount: v })}
      />

      <PresetPicker
        label="Start layout"
        info="Where the agents begin. Scatter spreads them across the whole frame for an even web; centre clusters them into a single growing colony; ring drops them on a circle that collapses inward into a network."
        labels={LAYOUT_LABELS}
        value={state.startLayout}
        onChange={(startLayout) => updateState({ startLayout })}
      />

      <h3 className="section-title">Style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the veins read cleanly." />
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
          <InfoTip text="Draw the busy shared veins, the mid network and the faint explorer trails in different inks. Each layer still plots with one pen, and the per-layer SVG export keeps them separate — a genuine 2–3 pen plot, not a colour trick." />
        </label>
      </div>

      {state.multiInk ? (
        <>
          <ColorField
            label="Core ink"
            value={state.coreColor}
            onChange={(coreColor) => updateState({ coreColor })}
            info="Ink for the busy shared veins — the darkest, most travelled channels."
          />
          <ColorField
            label="Mid ink"
            value={state.midColor}
            onChange={(midColor) => updateState({ midColor })}
            info="Ink for the mid network — the bulk of the line work."
          />
          <ColorField
            label="Rim ink"
            value={state.rimColor}
            onChange={(rimColor) => updateState({ rimColor })}
            info="Ink for the faint explorer trails — the lightest marks."
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
            <InfoTip text="The simulation is deterministic — the seed only sets where the agents start and which way they head, giving a different network without changing the behaviour." />
          </span>
        </label>
      </SeedControl>

      <AdvancedSection>
        <AdvGroup title="Agents">
          <Slider
            labelNode={
              <span className="label-text">
                Sensor angle
                <InfoTip text="How far apart the left and right sensors splay from straight ahead. Wider angles make agents turn toward broad trails — thicker, more meandering veins; narrow angles keep them tracking fine lines." />
              </span>
            }
            value={state.sensorAngleDeg}
            min={5}
            max={60}
            step={0.5}
            onChange={(v) => updateState({ sensorAngleDeg: v })}
            format={(v) => `${v}°`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Sensor distance
                <InfoTip text="How many cells ahead the agents look. Longer reach makes them commit to large-scale structure (bigger loops, cleaner trunks); shorter reach reacts to local detail." />
              </span>
            }
            value={state.sensorDistance}
            min={2}
            max={30}
            step={1}
            onChange={(v) => updateState({ sensorDistance: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Rotation
                <InfoTip text="How sharply an agent turns toward the strongest sensor each step. Higher makes twitchy, tight-cornered networks; lower makes lazy, sweeping curves." />
              </span>
            }
            value={state.rotationAngleDeg}
            min={5}
            max={90}
            step={1}
            onChange={(v) => updateState({ rotationAngleDeg: v })}
            format={(v) => `${v}°`}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Step size
                <InfoTip text="How far an agent moves per step, in cells. Bigger steps cover ground faster (longer, looser trails); smaller steps trace finer, denser detail." />
              </span>
            }
            value={state.stepSize}
            min={0.3}
            max={3}
            step={0.1}
            onChange={(v) => updateState({ stepSize: v })}
            format={(v) => v.toFixed(1)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Deposit
                <InfoTip text="How much trail each agent lays per step. More deposit makes strong, self-reinforcing veins that lock in early; less keeps the network fluid and exploratory." />
              </span>
            }
            value={state.depositAmount}
            min={1}
            max={20}
            step={0.5}
            onChange={(v) => updateState({ depositAmount: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Decay
                <InfoTip text="How fast trail fades each step. Faster decay forces the colony to keep reinforcing only the most useful routes — sparse, optimised veins; slower decay lets a broad field of trail linger." />
              </span>
            }
            value={state.decay}
            min={0.01}
            max={0.3}
            step={0.01}
            onChange={(v) => updateState({ decay: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Diffusion
                <InfoTip text="How much the trail field blurs each step. More diffusion spreads the scent so agents merge into fat, smooth channels; less keeps trails crisp and threadlike." />
              </span>
            }
            value={state.diffuseRate}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateState({ diffuseRate: v })}
            format={(v) => v.toFixed(2)}
          />
        </AdvGroup>

        <AdvGroup title="Field & hand">
          <Slider
            labelNode={
              <span className="label-text">
                Field smoothing
                <InfoTip text="Gaussian blur applied to the trail field before the contours are traced (contour/hatch/dual styles). More smoothing gives cleaner, calmer lines; less keeps fine detail and line count." />
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
                <InfoTip text="Hand-drawn shake on the strokes. Faint explorer trails wobble most; the busy veins stay steady. 0 is ruler-smooth." />
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
                  <InfoTip text="Commit the field to this many decisive value shapes instead of continuous gradation — the artist's tonal abstraction (contour/hatch/dual styles). 0 keeps continuous tone." />
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
                  <InfoTip text="Hold faint marks off the frame corners so the negative space reads as a decision. Higher clears more; 0 lets the network run to the edges." />
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
