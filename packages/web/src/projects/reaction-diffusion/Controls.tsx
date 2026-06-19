import { RD_PRESETS, type RDPreset } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { EditableValue } from '../../components/EditableValue';
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

/** Sidebar controls for the Reaction–Diffusion module. */
export function RDControls({ state, update }: ControlsProps<RDState>) {
  const updateState = update;
  const randomizeSeed = () => update({ seed: Math.floor(Math.random() * 1000000) });

  // The preset sets a feed/kill base; the advanced sliders fine-tune from there.
  const selectPreset = (preset: RDPreset) => {
    const { f, k } = RD_PRESETS[preset];
    updateState({ preset, feed: f, kill: k });
  };

  return (
    <div className="controls">
      <h3 className="section-title">Render</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pattern
            <InfoTip text="The feed/kill regime the two chemicals settle into. Coral branches outward; mitosis divides into spots; maze and fingerprint fill with corridors and ridges; waves and solitons make fronts and isolated pulses. Each just sets a starting feed/kill — fine-tune them under Advanced." />
          </span>
        </label>
        <select
          value={state.preset}
          onChange={(e) => selectPreset(e.target.value as RDPreset)}
        >
          {(Object.keys(PRESET_LABELS) as RDPreset[]).map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

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
        <div className="control-group">
          <label>
            <span className="label-text">
              Contour levels
              <InfoTip text="How many nested iso-contours trace the field. More levels give a finer tonal gradient (denser shading); fewer give bold, sparse rings." />
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

      {state.style !== 'contour' && (
        <div className="control-group">
          <label>
            <span className="label-text">
              Fill threshold
              <InfoTip text="How concentrated the chemical must be before a region is hatched solid. Lower fills more of the field; higher inks only the densest cores." />
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
            <InfoTip text="How long the reaction runs before the shutter closes. Patterns start as small seeds and grow/branch over thousands of steps — more steps mean a more developed, frame-filling structure." />
          </span>
          <EditableValue value={state.steps} min={1000} max={6000} step={250}
            onChange={(v) => updateState({ steps: v })}>
            {state.steps}
          </EditableValue>
        </label>
        <input
          type="range"
          min="1000"
          max="6000"
          step="250"
          value={state.steps}
          onChange={(e) => updateState({ steps: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Grid resolution
            <InfoTip text="Width of the simulation grid in cells (rows follow the page shape). Finer grids resolve smaller features and longer lines but take longer to simulate and plot." />
          </span>
          <EditableValue value={state.gridCols} min={64} max={250} step={2}
            onChange={(v) => updateState({ gridCols: v })}>
            {state.gridCols}
          </EditableValue>
        </label>
        <input
          type="range"
          min="64"
          max="250"
          step="2"
          value={state.gridCols}
          onChange={(e) => updateState({ gridCols: parseInt(e.target.value, 10) })}
        />
      </div>

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
        <div className="control-group">
          <label>
            <span className="label-text">
              Seed spots
              <InfoTip text="How many blobs of chemical are dropped to start. More seeds means a busier frame where neighbouring growths collide and interleave." />
            </span>
            <EditableValue value={state.seedSpots} min={1} max={40} step={1}
              onChange={(v) => updateState({ seedSpots: v })}>
              {state.seedSpots}
            </EditableValue>
          </label>
          <input
            type="range"
            min="1"
            max="40"
            step="1"
            value={state.seedSpots}
            onChange={(e) => updateState({ seedSpots: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the filled cores read cleanly." />
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

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="The reaction is deterministic — the seed only sets where the starting blobs are dropped, giving a different composition without changing the chemistry." />
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
          <summary>Reaction</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Feed rate (f)
                <InfoTip text="How fast chemical U is replenished. Together with the kill rate this sets which pattern forms — the Pattern presets just pick a starting pair. Small changes can completely change the structure." />
              </span>
              <EditableValue value={state.feed} min={0.01} max={0.09} step={0.0005}
                onChange={(v) => updateState({ feed: v })}>
                {state.feed.toFixed(4)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.01"
              max="0.09"
              step="0.0005"
              value={state.feed}
              onChange={(e) => updateState({ feed: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Kill rate (k)
                <InfoTip text="How fast chemical V is removed. Paired with the feed rate it tunes the regime; nudge both to wander between coral, spots and mazes." />
              </span>
              <EditableValue value={state.kill} min={0.03} max={0.07} step={0.0005}
                onChange={(v) => updateState({ kill: v })}>
                {state.kill.toFixed(4)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.03"
              max="0.07"
              step="0.0005"
              value={state.kill}
              onChange={(e) => updateState({ kill: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                U diffusion
                <InfoTip text="How fast chemical U spreads. The classic patterns want U spreading about twice as fast as V; drift it to stretch or freeze the structure." />
              </span>
              <EditableValue value={state.du} min={0.4} max={1.2} step={0.05}
                onChange={(v) => updateState({ du: v })}>
                {state.du.toFixed(2)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.4"
              max="1.2"
              step="0.05"
              value={state.du}
              onChange={(e) => updateState({ du: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                V diffusion
                <InfoTip text="How fast chemical V spreads. Keeping it around half the U diffusion is what gives the Turing instability its characteristic scale." />
              </span>
              <EditableValue value={state.dv} min={0.2} max={0.7} step={0.05}
                onChange={(v) => updateState({ dv: v })}>
                {state.dv.toFixed(2)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.2"
              max="0.7"
              step="0.05"
              value={state.dv}
              onChange={(e) => updateState({ dv: parseFloat(e.target.value) })}
            />
          </div>
        </details>

        <details className="adv-group">
          <summary>Field &amp; hand</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Field smoothing
                <InfoTip text="Gaussian blur applied to the chemical field before the contours are traced. More smoothing gives cleaner, calmer lines; less keeps the fine detail (and the line count)." />
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
                <InfoTip text="Hand-drawn shake on the strokes. Faint rim contours wobble most; the dense core stays steady. 0 is ruler-smooth." />
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
                  <InfoTip text="Commit the field to this many decisive value shapes instead of continuous gradation — the artist's tonal abstraction. 0 keeps continuous tone." />
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
                  <InfoTip text="Hold faint contours off the frame corners so the negative space reads as a decision. Higher clears more; 0 lets the field run to the edges." />
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
