import {
  PAPER_SIZES,
  type Orientation,
  type PaperFit,
  type SketchStyle,
} from '@flow-lines/core';
import { useFrame } from '../FrameContext';
import { useTileLayout } from '../lib/use-tile-layout';
import { InfoTip } from './InfoTip';
import { ColorField } from './ColorField';
import { EditableValue } from './EditableValue';
import { PaperControls } from './PaperControls';
import { SeedControl } from './controls/SeedControl';

/** Paper-tone swatches shown behind the drawing in the preview (never plotted). */
const PAPER_TONES: Array<{ id: string; label: string }> = [
  { id: '#ffffff', label: 'Bright white' },
  { id: '#faf9f6', label: 'Soft white' },
  { id: '#f4efe2', label: 'Warm' },
  { id: '#ece3cf', label: 'Cream' },
  { id: '#e7e7e4', label: 'Cool grey' },
  { id: '#1c2230', label: 'Slate (dark)' },
  { id: '#0d0d12', label: 'Ink black' },
];

/**
 * The shared page frame — paper, orientation, render density, fit and the
 * paper-border margin. Mounted once in the shell so every layer plots
 * to the same physical sheet.
 */
export function FrameControls() {
  const { frame, updateFrame } = useFrame();
  const { layout: tileLayout, error: tileError } = useTileLayout();
  const tileSummary =
    tileError ??
    (tileLayout
      ? tileLayout.single
        ? 'Fits on 1 sheet'
        : `${tileLayout.rows} × ${tileLayout.cols} sheets (${tileLayout.tiles.length})`
      : null);
  return (
    <div className="frame-controls">
      <h3 className="section-title">Page</h3>

      <PaperControls
        paper={frame.paper}
        orientation={frame.orientation}
        resolution={frame.resolution}
        onChange={updateFrame}
      />

      <div className="control-group">
        <label>Fit to page</label>
        <div className="segmented">
          <button
            type="button"
            className={frame.fit === 'fit' ? 'active' : ''}
            onClick={() => updateFrame({ fit: 'fit' as PaperFit })}
          >
            Fit
          </button>
          <button
            type="button"
            className={frame.fit === 'fill' ? 'active' : ''}
            onClick={() => updateFrame({ fit: 'fill' as PaperFit })}
          >
            Fill
          </button>
        </div>
      </div>

      <div className="control-group">
        <label>
          Margin{" "}
          <EditableValue
            value={frame.marginMm}
            min={0}
            max={40}
            step={1}
            onChange={(v) => updateFrame({ marginMm: v })}
          >
            {frame.marginMm}mm
          </EditableValue>
        </label>
        <input
          type="range"
          min="0"
          max="40"
          step="1"
          value={frame.marginMm}
          onChange={(e) => updateFrame({ marginMm: parseInt(e.target.value, 10) })}
        />
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.tileEnabled}
            onChange={(e) => updateFrame({ tileEnabled: e.target.checked })}
          />
          Split across sheets
          <InfoTip text="Plot a big drawing on paper your plotter can actually hold: the sheet above stays the artwork's true size, and export slices it across a grid of smaller sheets to trim and assemble. The drawing itself is untouched — each sheet is an exact slice of the same plot. Use 'Download sheets' to get one SVG per sheet." />
        </label>
        {frame.tileEnabled && tileSummary && (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{tileSummary}</div>
        )}
      </div>

      {frame.tileEnabled && (
        <div className="control-group">
          <label>Sheet size</label>
          <select
            value={frame.tileSheet}
            onChange={(e) => updateFrame({ tileSheet: e.target.value })}
          >
            {PAPER_SIZES.map((size) => (
              <option key={size.id} value={size.id}>
                {size.name} ({size.widthMm}×{size.heightMm}mm)
              </option>
            ))}
          </select>
          <label>Sheet orientation</label>
          <div className="segmented">
            <button
              type="button"
              className={frame.tileOrientation === 'portrait' ? 'active' : ''}
              onClick={() => updateFrame({ tileOrientation: 'portrait' as Orientation })}
            >
              Portrait
            </button>
            <button
              type="button"
              className={frame.tileOrientation === 'landscape' ? 'active' : ''}
              onClick={() => updateFrame({ tileOrientation: 'landscape' as Orientation })}
            >
              Landscape
            </button>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={frame.tilePerSheetMargin}
              onChange={(e) => updateFrame({ tilePerSheetMargin: e.target.checked })}
            />
            Margin on each sheet
            <InfoTip text="On: every sheet keeps the page margin as clear paper around its slice — safe for plotters that can't reach the paper edge; trim the margins away when assembling. Off: sheets are raw edge-to-edge slices of the drawing, so the margin only remains around the assembled whole — fewer sheets, but the pen must plot right to the paper edge." />
          </label>
          <label>
            Overlap{" "}
            <EditableValue
              value={frame.tileOverlapMm}
              min={0}
              max={20}
              step={1}
              onChange={(v) => updateFrame({ tileOverlapMm: v })}
            >
              {frame.tileOverlapMm}mm
            </EditableValue>
            <InfoTip text="Adjacent sheets repeat this much artwork along their shared edge, as a glue flap: cut one sheet on the trim line and paste its neighbour's flap behind it. 0 means sheets butt-join exactly." />
          </label>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={frame.tileOverlapMm}
            onChange={(e) => updateFrame({ tileOverlapMm: parseInt(e.target.value, 10) })}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={frame.tileMarks}
              onChange={(e) => updateFrame({ tileMarks: e.target.checked })}
            />
            Trim marks
            <InfoTip text="Short ticks on the margin line wherever two sheets meet, on their own 'tile-marks' pen layer — cut along them and glue any overlap flap behind the neighbouring sheet. Held clear of the paper edge so the pen never runs off. Needs a per-sheet margin (with sheets edge-to-edge there is nothing to cut)." />
          </label>
          {frame.tileMarks && (
            <>
              <label>
                Mark offset{" "}
                <EditableValue
                  value={frame.tileMarkOffsetMm}
                  min={0}
                  max={10}
                  step={0.5}
                  onChange={(v) => updateFrame({ tileMarkOffsetMm: v })}
                >
                  {frame.tileMarkOffsetMm}mm
                </EditableValue>
                <InfoTip text="Pulls each tick back from the margin line by this gap, toward the paper edge. 0 ends the tick exactly on the line. The paper-edge safety clearance always wins — if the margin is too crowded the ticks shorten and eventually drop." />
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={frame.tileMarkOffsetMm}
                onChange={(e) => updateFrame({ tileMarkOffsetMm: parseFloat(e.target.value) })}
              />
            </>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={frame.tileCrosses}
              onChange={(e) => updateFrame({ tileCrosses: e.target.checked })}
            />
            Registration crosses
            <InfoTip text="A small + in each corner of every sheet, on its own 'tile-crosses' pen layer — re-register the paper between pen swaps, or plot them in a light ink. They live entirely in the blank margin corner and drop out where they don't fit. Needs a per-sheet margin." />
          </label>
          {frame.tileCrosses && (
            <>
              <label>
                Cross offset{" "}
                <EditableValue
                  value={frame.tileCrossOffsetMm}
                  min={0}
                  max={15}
                  step={0.5}
                  onChange={(v) => updateFrame({ tileCrossOffsetMm: v })}
                >
                  {frame.tileCrossOffsetMm}mm
                </EditableValue>
                <InfoTip text="Distance from the paper edge to each cross's centre. The plotter-safety clearance always wins, so a cross never sits closer to the edge than is safe to stroke." />
              </label>
              <input
                type="range"
                min="0"
                max="15"
                step="0.5"
                value={frame.tileCrossOffsetMm}
                onChange={(e) => updateFrame({ tileCrossOffsetMm: parseFloat(e.target.value) })}
              />
            </>
          )}
        </div>
      )}

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.borderEnabled}
            onChange={(e) => updateFrame({ borderEnabled: e.target.checked })}
          />
          Page border
          <InfoTip text="A ruled rectangle framing the page on its own pen layer, like a print plate. A pure overlay — it never moves the drawing, so the rest of the output is unchanged. The background texture holds its halo off it too." />
        </label>
      </div>

      {frame.borderEnabled && (
        <div className="control-group">
          <label>
            Border inset{" "}
            <EditableValue
              value={frame.borderInsetMm}
              min={-frame.marginMm}
              max={20}
              step={1}
              onChange={(v) => updateFrame({ borderInsetMm: v })}
            >
              {frame.borderInsetMm}mm
            </EditableValue>
            <InfoTip text="Where the rule sits relative to the margin. 0 sits it right at the margin (touching the art). Negative pushes it outward toward the paper edge, opening a clear gap between the art and the border. Positive pushes it inward, into the art." />
          </label>
          <input
            type="range"
            min={-frame.marginMm}
            max="20"
            step="1"
            value={frame.borderInsetMm}
            onChange={(e) => updateFrame({ borderInsetMm: parseInt(e.target.value, 10) })}
          />
          <label>
            Corner radius{" "}
            <EditableValue
              value={frame.borderCornerRadiusMm}
              min={0}
              max={20}
              step={1}
              onChange={(v) => updateFrame({ borderCornerRadiusMm: v })}
            >
              {frame.borderCornerRadiusMm}mm
            </EditableValue>
            <InfoTip text="Rounds the border's corners by this radius. 0 keeps sharp right-angle corners. The straight edges stay straight; only the corners curve." />
          </label>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={frame.borderCornerRadiusMm}
            onChange={(e) => updateFrame({ borderCornerRadiusMm: parseInt(e.target.value, 10) })}
          />
        </div>
      )}

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.densityEnabled}
            onChange={(e) => updateFrame({ densityEnabled: e.target.checked })}
          />
          Density protection
          <InfoTip text="Trims runs where lines coalesce and re-ink the same path. Caps how many passes may stack on one patch before further overlap is cut — 1 keeps each path inked once (clean flow diagrams), higher allows built-up texture. Lines that merely cross at a point are left whole. Bold outlines (deliberate multi-pass) are exempt. The plot window shows the clean, as-plotted result so you can see the effect on the artwork. Applies to every tool." />
        </label>
      </div>

      {frame.densityEnabled && (
        <div className="control-group">
          <label>
            Max passes before trimming{" "}
            <EditableValue
              value={frame.densityMaxPasses}
              min={1}
              max={8}
              step={1}
              onChange={(v) => updateFrame({ densityMaxPasses: v })}
            >
              {frame.densityMaxPasses}
            </EditableValue>
          </label>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            value={frame.densityMaxPasses}
            onChange={(e) => updateFrame({ densityMaxPasses: parseInt(e.target.value, 10) })}
          />
          <label>
            Min overlap to trim{" "}
            <EditableValue
              value={frame.densityMinOverlapMm}
              min={0.5}
              max={8}
              step={0.5}
              onChange={(v) => updateFrame({ densityMinOverlapMm: v })}
            >
              {frame.densityMinOverlapMm.toFixed(1)} mm
            </EditableValue>
            <InfoTip text="How far two lines must run together before the shared run is cut. Below this they're treated as a crossing and kept whole. Lower it to thin the dense convergence right at flow singularities (where many lines genuinely meet); raise it to trim only long parallel duplication and preserve detail at the poles." />
          </label>
          <input
            type="range"
            min="0.5"
            max="8"
            step="0.5"
            value={frame.densityMinOverlapMm}
            onChange={(e) => updateFrame({ densityMinOverlapMm: parseFloat(e.target.value) })}
          />
        </div>
      )}

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.sketchEnabled}
            onChange={(e) => updateFrame({ sketchEnabled: e.target.checked })}
          />
          Hand sketch
          <InfoTip text="Redraws the whole sheet with a sketching hand as one finishing pass over every layer: strokes wobble and misregister, long lines lift and resume, open ends overshoot their stop, and higher intensity restates lines in extra overdraw passes. Any module-level wobble or sketch settings still apply underneath. Deterministic per sketch seed. Overdraw multiplies pen travel — if density protection is on with 1 max pass it will eat the restatements, so raise max passes. Heavy on photo renders at high intensity." />
        </label>
      </div>

      {frame.sketchEnabled && (
        <div className="control-group">
          <label className="label-text">Sketch style</label>
          <select
            value={frame.sketchStyle}
            onChange={(e) => updateFrame({ sketchStyle: e.target.value as SketchStyle })}
          >
            <option value="loose">Loose</option>
            <option value="fine">Fine</option>
            <option value="gestural">Gestural</option>
            <option value="scratchy">Scratchy</option>
          </select>
          <label>
            Intensity{" "}
            <EditableValue
              value={Math.round(frame.sketchIntensity * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => updateFrame({ sketchIntensity: v / 100 })}
            >
              {Math.round(frame.sketchIntensity * 100)}%
            </EditableValue>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={frame.sketchIntensity}
            onChange={(e) => updateFrame({ sketchIntensity: parseFloat(e.target.value) })}
          />
          <label>
            Overshoot{" "}
            <EditableValue
              value={Math.round(frame.sketchOvershoot * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => updateFrame({ sketchOvershoot: v / 100 })}
            >
              {Math.round(frame.sketchOvershoot * 100)}%
            </EditableValue>
            <InfoTip text="How far open line ends run past their stopping point, the way a quick hand doesn't brake exactly on the mark. Not every end overshoots." />
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={frame.sketchOvershoot}
            onChange={(e) => updateFrame({ sketchOvershoot: parseFloat(e.target.value) })}
          />
          <label>
            Pen lifts{" "}
            <EditableValue
              value={Math.round(frame.sketchBreaks * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => updateFrame({ sketchBreaks: v / 100 })}
            >
              {Math.round(frame.sketchBreaks * 100)}%
            </EditableValue>
            <InfoTip text="How often long strokes break where the pen lifts and resumes, so lines read as drawn in strokes rather than traced in one go." />
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={frame.sketchBreaks}
            onChange={(e) => updateFrame({ sketchBreaks: parseFloat(e.target.value) })}
          />
          <SeedControl
            seed={frame.sketchSeed}
            onChange={(sketchSeed) => updateFrame({ sketchSeed })}
            title="New random sketch seed"
          >
            <label className="label-text">Sketch seed</label>
          </SeedControl>
        </div>
      )}

      <div className="control-group">
        <label>Paper tone</label>
        <div className="paper-swatches">
          {PAPER_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`paper-swatch ${frame.paperTone === tone.id ? 'active' : ''}`}
              title={tone.label}
              aria-label={tone.label}
              style={{ background: tone.id }}
              onClick={() => updateFrame({ paperTone: tone.id })}
            />
          ))}
        </div>
      </div>
      <ColorField
        label="Paper tone (custom)"
        value={frame.paperTone}
        onChange={(paperTone) => updateFrame({ paperTone })}
      />
      {/* Deploys lag and browsers cache the bundle hard — show which build
          this actually is, so "did the fix land?" is answerable at a glance. */}
      <div style={{ fontSize: 11, opacity: 0.45, textAlign: 'right', marginTop: 8 }}>build {__BUILD_STAMP__}</div>
    </div>
  );
}
