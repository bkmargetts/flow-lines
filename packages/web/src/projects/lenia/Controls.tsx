import { LENIA_PRESETS, type LeniaPreset } from '@flow-lines/core';
import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { EditableValue } from '../../components/EditableValue';
import { SketchControls } from '../../components/SketchControls';
import type { ControlsProps } from '../../modules/types';
import type { LeniaState } from './types';

const PRESET_LABELS: Record<LeniaPreset, string> = {
  orbium: 'Orbium (gliders)',
  cells: 'Cells (colony)',
  rings: 'Rings (target waves)',
  pulse: 'Pulse (symmetric)',
};

/** Sidebar controls for the Lenia module. */
export function LeniaControls({ state, update }: ControlsProps<LeniaState>) {
  const updateState = update;
  const randomizeSeed = () => update({ seed: Math.floor(Math.random() * 1000000) });

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

  return (
    <div className="controls">
      <h3 className="section-title">Render</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Lifeform
            <InfoTip text="The rule the continuous automaton settles into. Orbium grows solitary gliders that travel and leave trails; cells and rings form pulsing colonies and target waves; pulse seeds a symmetric specimen. Each just sets a starting kernel + growth — fine-tune them under Advanced." />
          </span>
        </label>
        <select
          value={state.preset}
          onChange={(e) => selectPreset(e.target.value as LeniaPreset)}
        >
          {(Object.keys(PRESET_LABELS) as LeniaPreset[]).map((p) => (
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
              <InfoTip text="How dense the life field must be before a region is hatched solid. Lower fills more of the field; higher inks only the densest cores." />
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
          <div className="control-group">
            <label>
              <span className="label-text">
                Trail length
                <InfoTip text="How slowly old trail fades (the per-step decay). Higher holds longer comet tails; lower keeps only the recent wake." />
              </span>
              <EditableValue value={state.decay} min={0.9} max={0.998} step={0.002}
                onChange={(v) => updateState({ decay: v })}>
                {state.decay.toFixed(3)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.9"
              max="0.998"
              step="0.002"
              value={state.decay}
              onChange={(e) => updateState({ decay: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Trail lift
                <InfoTip text="Perceptual brightening of the faint trail before it is traced. A moving creature deposits little per cell, so a lift below 1 makes the ghostly tails visible against the solid present." />
              </span>
              <EditableValue value={state.gamma} min={0.3} max={1} step={0.05}
                onChange={(v) => updateState({ gamma: v })}>
                {state.gamma.toFixed(2)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={state.gamma}
              onChange={(e) => updateState({ gamma: parseFloat(e.target.value) })}
            />
          </div>
        </>
      )}

      <h3 className="section-title">Simulation</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Steps
            <InfoTip text="How long the automaton runs before the shutter closes. Creatures emerge from the seed and travel/develop over time — more steps means longer trails and more mature colonies, but gliders can eventually collide and die out, so very long runs may thin." />
          </span>
          <EditableValue value={state.steps} min={100} max={700} step={20}
            onChange={(v) => updateState({ steps: v })}>
            {state.steps}
          </EditableValue>
        </label>
        <input
          type="range"
          min="100"
          max="700"
          step="20"
          value={state.steps}
          onChange={(e) => updateState({ steps: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            Grid resolution
            <InfoTip text="Width of the simulation grid in cells (rows follow the page shape). Finer grids resolve smaller features and longer lines but take longer to simulate and plot. Below ~72 a colony has too little room to ignite." />
          </span>
          <EditableValue value={state.gridCols} min={72} max={180} step={2}
            onChange={(v) => updateState({ gridCols: v })}>
            {state.gridCols}
          </EditableValue>
        </label>
        <input
          type="range"
          min="72"
          max="180"
          step="2"
          value={state.gridCols}
          onChange={(e) => updateState({ gridCols: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">
            {state.seedPattern === 'orbium' ? 'Gliders' : 'Seed spots'}
            <InfoTip text="How many starting forms are dropped — gliders for Orbium, soup patches for the colonies. More makes a busier frame where neighbouring growths collide and interleave." />
          </span>
          <EditableValue value={state.seedSpots} min={1} max={state.seedPattern === 'orbium' ? 6 : 8} step={1}
            onChange={(v) => updateState({ seedSpots: v })}>
            {state.seedSpots}
          </EditableValue>
        </label>
        <input
          type="range"
          min="1"
          max={state.seedPattern === 'orbium' ? '6' : '8'}
          step="1"
          value={state.seedSpots}
          onChange={(e) => updateState({ seedSpots: parseInt(e.target.value, 10) })}
        />
      </div>

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

      <div className="control-group">
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="The simulation is deterministic — the seed only sets where the starting forms and their headings land, giving a different composition without changing the rule." />
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
          <summary>Rule</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Kernel radius (R)
                <InfoTip text="How far each cell senses its neighbours. Larger radii grow bigger, slower creatures; the canonical Orbium wants R = 13. Bigger radii also cost more to simulate." />
              </span>
              <EditableValue value={state.kernelRadius} min={6} max={18} step={1}
                onChange={(v) => updateState({ kernelRadius: v })}>
                {state.kernelRadius}
              </EditableValue>
            </label>
            <input
              type="range"
              min="6"
              max="18"
              step="1"
              value={state.kernelRadius}
              onChange={(e) => updateState({ kernelRadius: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Growth centre (μ)
                <InfoTip text="The neighbourhood density a cell most wants. The whole character of the life — gliders vs colonies vs static blobs — lives in μ and σ; nudge them to wander between regimes." />
              </span>
              <EditableValue value={state.mu} min={0.05} max={0.4} step={0.005}
                onChange={(v) => updateState({ mu: v })}>
                {state.mu.toFixed(3)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.05"
              max="0.4"
              step="0.005"
              value={state.mu}
              onChange={(e) => updateState({ mu: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Growth width (σ)
                <InfoTip text="How tolerant the growth is around μ. Tight σ gives sharp, fragile creatures (the Orbium is very tight); wider σ gives softer, more forgiving colonies." />
              </span>
              <EditableValue value={state.sigma} min={0.008} max={0.06} step={0.001}
                onChange={(v) => updateState({ sigma: v })}>
                {state.sigma.toFixed(3)}
              </EditableValue>
            </label>
            <input
              type="range"
              min="0.008"
              max="0.06"
              step="0.001"
              value={state.sigma}
              onChange={(e) => updateState({ sigma: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              <span className="label-text">
                Time resolution (T)
                <InfoTip text="How finely time is sliced (the step is 1/T). Higher T takes smaller, smoother steps — steadier creatures; lower T is coarser and more volatile." />
              </span>
              <EditableValue value={state.timeRes} min={2} max={20} step={1}
                onChange={(v) => updateState({ timeRes: v })}>
                {state.timeRes}
              </EditableValue>
            </label>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={state.timeRes}
              onChange={(e) => updateState({ timeRes: parseInt(e.target.value, 10) })}
            />
          </div>
        </details>

        <details className="adv-group">
          <summary>Field &amp; hand</summary>

          <div className="control-group">
            <label>
              <span className="label-text">
                Field smoothing
                <InfoTip text="Gaussian blur applied to the life field before the contours are traced. More smoothing gives cleaner, calmer lines; less keeps the fine detail (and the line count)." />
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

          <SketchControls sketch={state.sketch} sketchStyle={state.sketchStyle} onChange={update} />
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
