import { PHYSARUM_PRESETS, type PhysarumPreset } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { EditableValue } from '../../components/EditableValue';
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

/** Sidebar controls for the Physarum module. */
export function PhysarumControls({ state, update }: ControlsProps<PhysarumState>) {
  const updateState = update;
  const randomizeSeed = () => update({ seed: Math.floor(Math.random() * 1000000) });

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

  return (
    <div className="controls">
      <h3 className="section-title">Render</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Behaviour
            <InfoTip text="How the slime mold behaves. Network grows clean, well-separated transport veins (the canonical look); veins makes thicker, fewer organic channels; dense web packs a fine reticulated mesh; explore sends wandering filaments out from a ring. Each just sets the agents' sensing and trail chemistry — fine-tune under Agents." />
          </span>
        </label>
        <select
          value={state.preset}
          onChange={(e) => selectPreset(e.target.value as PhysarumPreset)}
        >
          {(Object.keys(PRESET_LABELS) as PhysarumPreset[]).map((pr) => (
            <option key={pr} value={pr}>
              {PRESET_LABELS[pr]}
            </option>
          ))}
        </select>
      </div>

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
          <div className="control-group">
            <label>
              <span className="label-text">
                Trail density
                <InfoTip text="What fraction of the agents have their trajectory drawn. The rest still crawl and lay trail (shaping the network the drawn ones follow) — this only thins the ink. Lower keeps the plot light and the veins legible." />
              </span>
              <EditableValue value={Math.round(state.pathFraction * 100)} min={5} max={100} step={5}
                onChange={(v) => updateState({ pathFraction: v / 100 })}>
                {Math.round(state.pathFraction * 100)}%
              </EditableValue>
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={Math.round(state.pathFraction * 100)}
              onChange={(e) => updateState({ pathFraction: parseInt(e.target.value, 10) / 100 })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Trail smoothness
                <InfoTip text="How often an agent's position is recorded (every N steps). Lower samples more finely — wigglier, heavier strokes; higher gives smoother, lighter polylines." />
              </span>
              <EditableValue value={state.sampleEvery} min={1} max={8} step={1}
                onChange={(v) => updateState({ sampleEvery: v })}>
                {state.sampleEvery}
              </EditableValue>
            </label>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={state.sampleEvery}
              onChange={(e) => updateState({ sampleEvery: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Min trail length
                <InfoTip text="Drop trajectory fragments shorter than this many cells, so dust and stubs don't clutter the plot. Higher keeps only the confident, established veins." />
              </span>
              <EditableValue value={state.minPathLength} min={2} max={40} step={1}
                onChange={(v) => updateState({ minPathLength: v })}>
                {state.minPathLength}
              </EditableValue>
            </label>
            <input
              type="range"
              min="2"
              max="40"
              step="1"
              value={state.minPathLength}
              onChange={(e) => updateState({ minPathLength: parseInt(e.target.value, 10) })}
            />
          </div>
        </>
      )}

      {state.style !== 'paths' && state.style !== 'hatch' && (
        <div className="control-group">
          <label>
            <span className="label-text">
              Contour levels
              <InfoTip text="How many nested iso-contours trace the trail density. More levels give a finer tonal gradient (denser shading); fewer give bold, sparse rings." />
            </span>
            <EditableValue value={state.contourLevels} min={2} max={12} step={1}
              onChange={(v) => updateState({ contourLevels: v })}>
              {state.contourLevels}
            </EditableValue>
          </label>
          <input
            type="range"
            min="2"
            max="12"
            step="1"
            value={state.contourLevels}
            onChange={(e) => updateState({ contourLevels: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      {(state.style === 'hatch' || state.style === 'dual') && (
        <div className="control-group">
          <label>
            <span className="label-text">
              Fill threshold
              <InfoTip text="How dense the trail must be before a region is hatched solid. Lower fills more of the network; higher inks only the busiest cores." />
            </span>
            <EditableValue value={state.fillThreshold} min={0.1} max={0.8} step={0.02}
              onChange={(v) => updateState({ fillThreshold: v })}>
              {state.fillThreshold.toFixed(2)}
            </EditableValue>
          </label>
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.02"
            value={state.fillThreshold}
            onChange={(e) => updateState({ fillThreshold: parseFloat(e.target.value) })}
          />
        </div>
      )}

      <h3 className="section-title">Simulation</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Steps
            <InfoTip text="How long the colony crawls before the drawing is taken. The network self-organises over time — more steps lets the veins consolidate and thin into confident channels, fewer leaves a looser, more exploratory tangle." />
          </span>
          <EditableValue value={state.steps} min={50} max={1000} step={25}
            onChange={(v) => updateState({ steps: v })}>
            {state.steps}
          </EditableValue>
        </label>
        <input
          type="range"
          min="50"
          max="1000"
          step="25"
          value={state.steps}
          onChange={(e) => updateState({ steps: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Grid resolution
            <InfoTip text="Width of the simulation grid in cells (rows follow the page shape). Finer grids resolve thinner veins and longer trails but take longer to simulate and plot." />
          </span>
          <EditableValue value={state.gridCols} min={80} max={240} step={4}
            onChange={(v) => updateState({ gridCols: v })}>
            {state.gridCols}
          </EditableValue>
        </label>
        <input
          type="range"
          min="80"
          max="240"
          step="4"
          value={state.gridCols}
          onChange={(e) => updateState({ gridCols: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Agents
            <InfoTip text="How many crawlers seed the network. More agents build a denser, busier web with stronger shared veins; fewer leave a sparse, delicate filigree." />
          </span>
          <EditableValue value={state.agentCount} min={500} max={30000} step={500}
            onChange={(v) => updateState({ agentCount: v })}>
            {state.agentCount}
          </EditableValue>
        </label>
        <input
          type="range"
          min="500"
          max="30000"
          step="500"
          value={state.agentCount}
          onChange={(e) => updateState({ agentCount: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Start layout
            <InfoTip text="Where the agents begin. Scatter spreads them across the whole frame for an even web; centre clusters them into a single growing colony; ring drops them on a circle that collapses inward into a network." />
          </span>
        </label>
        <select
          value={state.startLayout}
          onChange={(e) => updateState({ startLayout: e.target.value as PhysarumState['startLayout'] })}
        >
          {(Object.keys(LAYOUT_LABELS) as PhysarumState['startLayout'][]).map((l) => (
            <option key={l} value={l}>
              {LAYOUT_LABELS[l]}
            </option>
          ))}
        </select>
      </div>

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the veins read cleanly." />
          </span>
          <EditableValue value={state.penWidthMm} min={0.1} max={1.5} step={0.05}
            onChange={(v) => updateState({ penWidthMm: v })}>
            {state.penWidthMm}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.5"
          step="0.05"
          value={state.penWidthMm}
          onChange={(e) => updateState({ penWidthMm: parseFloat(e.target.value) })}
        />
      </div>

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

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="The simulation is deterministic — the seed only sets where the agents start and which way they head, giving a different network without changing the behaviour." />
          </span>
        </label>
        <div className="seed-input">
          <input
            type="number"
            value={state.seed}
            onChange={(e) => updateState({ seed: parseInt(e.target.value, 10) || 0 })}
          />
          <button type="button" className="secondary" onClick={randomizeSeed} title="New random seed">
            🎲
          </button>
        </div>
      </div>

      <details className="advanced">
        <summary>Advanced</summary>

        <details className="adv-group">
          <summary>Agents</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Sensor angle
                <InfoTip text="How far apart the left and right sensors splay from straight ahead. Wider angles make agents turn toward broad trails — thicker, more meandering veins; narrow angles keep them tracking fine lines." />
              </span>
              <EditableValue value={state.sensorAngleDeg} min={5} max={60} step={0.5}
                onChange={(v) => updateState({ sensorAngleDeg: v })}>
                {state.sensorAngleDeg}°
              </EditableValue>
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="0.5"
              value={state.sensorAngleDeg}
              onChange={(e) => updateState({ sensorAngleDeg: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Sensor distance
                <InfoTip text="How many cells ahead the agents look. Longer reach makes them commit to large-scale structure (bigger loops, cleaner trunks); shorter reach reacts to local detail." />
              </span>
              <EditableValue value={state.sensorDistance} min={2} max={30} step={1}
                onChange={(v) => updateState({ sensorDistance: v })}>
                {state.sensorDistance}
              </EditableValue>
            </label>
            <input
              type="range"
              min="2"
              max="30"
              step="1"
              value={state.sensorDistance}
              onChange={(e) => updateState({ sensorDistance: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Rotation
                <InfoTip text="How sharply an agent turns toward the strongest sensor each step. Higher makes twitchy, tight-cornered networks; lower makes lazy, sweeping curves." />
              </span>
              <EditableValue value={state.rotationAngleDeg} min={5} max={90} step={1}
                onChange={(v) => updateState({ rotationAngleDeg: v })}>
                {state.rotationAngleDeg}°
              </EditableValue>
            </label>
            <input
              type="range"
              min="5"
              max="90"
              step="1"
              value={state.rotationAngleDeg}
              onChange={(e) => updateState({ rotationAngleDeg: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Step size
                <InfoTip text="How far an agent moves per step, in cells. Bigger steps cover ground faster (longer, looser trails); smaller steps trace finer, denser detail." />
              </span>
              <EditableValue value={state.stepSize} min={0.3} max={3} step={0.1}
                onChange={(v) => updateState({ stepSize: v })}>
                {state.stepSize.toFixed(1)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.3"
              max="3"
              step="0.1"
              value={state.stepSize}
              onChange={(e) => updateState({ stepSize: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Deposit
                <InfoTip text="How much trail each agent lays per step. More deposit makes strong, self-reinforcing veins that lock in early; less keeps the network fluid and exploratory." />
              </span>
              <EditableValue value={state.depositAmount} min={1} max={20} step={0.5}
                onChange={(v) => updateState({ depositAmount: v })}>
                {state.depositAmount}
              </EditableValue>
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={state.depositAmount}
              onChange={(e) => updateState({ depositAmount: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Decay
                <InfoTip text="How fast trail fades each step. Faster decay forces the colony to keep reinforcing only the most useful routes — sparse, optimised veins; slower decay lets a broad field of trail linger." />
              </span>
              <EditableValue value={state.decay} min={0.01} max={0.3} step={0.01}
                onChange={(v) => updateState({ decay: v })}>
                {state.decay.toFixed(2)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.01"
              max="0.3"
              step="0.01"
              value={state.decay}
              onChange={(e) => updateState({ decay: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Diffusion
                <InfoTip text="How much the trail field blurs each step. More diffusion spreads the scent so agents merge into fat, smooth channels; less keeps trails crisp and threadlike." />
              </span>
              <EditableValue value={state.diffuseRate} min={0} max={1} step={0.05}
                onChange={(v) => updateState({ diffuseRate: v })}>
                {state.diffuseRate.toFixed(2)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.diffuseRate}
              onChange={(e) => updateState({ diffuseRate: parseFloat(e.target.value) })}
            />
          </div>
        </details>

        <details className="adv-group">
          <summary>Field &amp; hand</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Field smoothing
                <InfoTip text="Gaussian blur applied to the trail field before the contours are traced (contour/hatch/dual styles). More smoothing gives cleaner, calmer lines; less keeps fine detail and line count." />
              </span>
              <EditableValue value={state.blurSigma} min={0.4} max={3} step={0.1}
                onChange={(v) => updateState({ blurSigma: v })}>
                {state.blurSigma.toFixed(1)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.4"
              max="3"
              step="0.1"
              value={state.blurSigma}
              onChange={(e) => updateState({ blurSigma: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Wobble
                <InfoTip text="Hand-drawn shake on the strokes. Faint explorer trails wobble most; the busy veins stay steady. 0 is ruler-smooth." />
              </span>
              <EditableValue value={state.wobble} min={0} max={3} step={0.1}
                onChange={(v) => updateState({ wobble: v })}>
                {state.wobble.toFixed(1)}px
              </EditableValue>
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={state.wobble}
              onChange={(e) => updateState({ wobble: parseFloat(e.target.value) })}
            />
          </div>
        </details>

        {state.artStyle && (
          <details className="adv-group">
            <summary>Art — value &amp; composition</summary>

            <div className="control-group">
              <label>
                <span className="label-text">
                  Value bands
                  <InfoTip text="Commit the field to this many decisive value shapes instead of continuous gradation — the artist's tonal abstraction (contour/hatch/dual styles). 0 keeps continuous tone." />
                </span>
                <EditableValue value={state.valueBands} min={0} max={8} step={1}
                  onChange={(v) => updateState({ valueBands: v })}>
                  {state.valueBands === 0 ? 'Continuous' : state.valueBands}
                </EditableValue>
              </label>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={state.valueBands}
                onChange={(e) => updateState({ valueBands: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className="control-group">
              <label>
                <span className="label-text">
                  Hatch angle
                  <InfoTip text="Direction of the strokes filling the dense regions (hatch and dual styles). The cross-hatch layer sits at a shallow offset to this." />
                </span>
                <EditableValue value={state.hatchAngle} min={-90} max={90} step={1}
                  onChange={(v) => updateState({ hatchAngle: v })}>
                  {state.hatchAngle}°
                </EditableValue>
              </label>
              <input
                type="range"
                min="-90"
                max="90"
                step="1"
                value={state.hatchAngle}
                onChange={(e) => updateState({ hatchAngle: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className="control-group">
              <label>
                <span className="label-text">
                  Cross-hatch amount
                  <InfoTip text="How much of the filled region gets a second layer of hatching at a shallow angle — more darkens and enriches the core; less keeps it open and linear." />
                </span>
                <EditableValue value={state.crossHatchAmount} min={0} max={1} step={0.05}
                  onChange={(v) => updateState({ crossHatchAmount: v })}>
                  {state.crossHatchAmount.toFixed(2)}
                </EditableValue>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state.crossHatchAmount}
                onChange={(e) => updateState({ crossHatchAmount: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <label>
                <span className="label-text">
                  Hatch jitter
                  <InfoTip text="Low-frequency variation in hatch spacing and phase, so the fill reads as a hand laying down strokes rather than an even mechanical screen." />
                </span>
                <EditableValue value={state.hatchJitter} min={0} max={1} step={0.05}
                  onChange={(v) => updateState({ hatchJitter: v })}>
                  {state.hatchJitter.toFixed(2)}
                </EditableValue>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state.hatchJitter}
                onChange={(e) => updateState({ hatchJitter: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <label>
                <span className="label-text">
                  Corner vignette
                  <InfoTip text="Hold faint marks off the frame corners so the negative space reads as a decision. Higher clears more; 0 lets the network run to the edges." />
                </span>
                <EditableValue value={state.vignette} min={0} max={1} step={0.05}
                  onChange={(v) => updateState({ vignette: v })}>
                  {state.vignette.toFixed(2)}
                </EditableValue>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state.vignette}
                onChange={(e) => updateState({ vignette: parseFloat(e.target.value) })}
              />
            </div>
          </details>
        )}
      </details>
    </div>
  );
}
