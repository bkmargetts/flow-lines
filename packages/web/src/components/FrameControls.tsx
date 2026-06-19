import type { ComponentType } from 'react';
import type { PaperFit } from '@flow-lines/core';
import { useFrame } from '../FrameContext';
import { InfoTip } from './InfoTip';
import { ColorField } from './ColorField';
import { EditableValue } from './EditableValue';
import { PaperControls } from './PaperControls';
import { TEXTURE_MODULES, getTextureModule, textureParamsFor } from '../textures/registry';

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
 * paper-border margin. Mounted once in the shell so every project tab plots
 * to the same physical sheet.
 */
export function FrameControls() {
  const { frame, updateFrame, updateTextureParams } = useFrame();
  const textureModule = getTextureModule(frame.textureModuleId);
  const textureModuleParams = textureParamsFor(frame.textureModuleId, frame.textureParams);
  const ActiveTextureControls = textureModule.Controls as ComponentType<{
    params: unknown;
    update: (updates: unknown) => void;
  }>;
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

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={frame.textureEnabled}
            onChange={(e) => updateFrame({ textureEnabled: e.target.checked })}
          />
          Background texture
          <InfoTip text="An optional field of plottable strokes laid behind the drawing on its own pen layer (exports as a separate SVG). Held a clean-paper halo off the art so it doesn't crowd it." />
        </label>
      </div>

      {frame.textureEnabled && (
        <details className="adv-group" open>
          <summary>Texture</summary>

          <div className="control-group">
            <label>
              Texture module
              <InfoTip text="The background texture is a pluggable module. 'Pattern' is the classic hatch/grid/dots; 'Grating' is the multi-ink interleaved line grating; 'Blank' is a template to build from." />
            </label>
            <select
              value={frame.textureModuleId}
              onChange={(e) => updateFrame({ textureModuleId: e.target.value })}
            >
              {TEXTURE_MODULES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <ActiveTextureControls
            params={textureModuleParams}
            update={(u) => updateTextureParams(frame.textureModuleId, u as Record<string, unknown>)}
          />

          <div className="control-group">
            <label>
              Halo{" "}
              <EditableValue
                value={frame.textureHaloMm}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) => updateFrame({ textureHaloMm: v })}
              >
                {frame.textureHaloMm.toFixed(1)}mm
              </EditableValue>
              <InfoTip text="Clean-paper sliver reserved around the drawing where the texture holds off, so the art reads off the textured ground. 0 lets the texture run under the drawing." />
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={frame.textureHaloMm}
              onChange={(e) => updateFrame({ textureHaloMm: parseFloat(e.target.value) })}
            />
          </div>
        </details>
      )}
    </div>
  );
}
