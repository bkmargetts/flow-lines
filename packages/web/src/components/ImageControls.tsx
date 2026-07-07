import { useRef } from 'react';
import type { GrayscaleImage, LabelImage, Point } from '@flow-lines/core';
import {
  PRESETS,
  type DepthStatus,
  type InkSettings,
  type LabelStatus,
  type PortraitState,
  type PortraitStatus,
  type SegmentStatus,
} from '../projects/image-ink/types';
import { ColorField } from './ColorField';
import { AdvancedSection, AdvGroup } from './controls/AdvancedSection';
import { Slider } from './controls/Slider';

interface ImageControlsProps {
  settings: InkSettings;
  imageName: string | null;
  preset: string;
  applyPreset: (name: string) => void;
  updateSettings: (updates: Partial<InkSettings>) => void;
  onImageFile: (file: File) => void;
  randomizeSeed: () => void;
  /** SVG export is the frame/compositor's job now; the buttons render only when
   *  these are supplied (kept optional for any legacy caller). */
  downloadSVG?: () => void;
  downloadLayers?: () => void;
  hasLayers?: boolean;
  focusPoints: Point[];
  clearFocus: () => void;
  subjectMask: GrayscaleImage | null;
  segmentStatus: SegmentStatus;
  isolateSubject: () => void;
  clearSubjectMask: () => void;
  portraitState: PortraitState | null;
  portraitStatus: PortraitStatus;
  detectFaces: () => void;
  clearPortrait: () => void;
  depthMap: GrayscaleImage | null;
  depthStatus: DepthStatus;
  depthError: string | null;
  estimateDepthMap: () => void;
  clearDepth: () => void;
  labelMap: LabelImage | null;
  labelStatus: LabelStatus;
  labelError: string | null;
  estimateSceneLabels: () => void;
  clearLabels: () => void;
  lowMemory: boolean;
  disableLowMemory: () => void;
}

export function ImageControls({
  settings,
  imageName,
  preset,
  applyPreset,
  updateSettings,
  onImageFile,
  randomizeSeed,
  downloadSVG,
  downloadLayers,
  hasLayers,
  focusPoints,
  clearFocus,
  subjectMask,
  segmentStatus,
  isolateSubject,
  clearSubjectMask,
  portraitState,
  portraitStatus,
  detectFaces,
  clearPortrait,
  depthMap,
  depthStatus,
  depthError,
  estimateDepthMap,
  clearDepth,
  labelMap,
  labelStatus,
  labelError,
  estimateSceneLabels,
  clearLabels,
  lowMemory,
  disableLowMemory,
}: ImageControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // One quiet line that tells the user what the AI understood
  const statusParts: string[] = [];
  if (portraitStatus === 'loading') statusParts.push('looking for faces…');
  else if (portraitState)
    statusParts.push(
      `${portraitState.faceCount} face${portraitState.faceCount === 1 ? '' : 's'} detected`
    );
  if (segmentStatus === 'loading') statusParts.push('isolating subject…');
  else if (subjectMask)
    statusParts.push(`subject${focusPoints.length > 1 ? 's' : ''} isolated`);
  if (depthStatus === 'loading') statusParts.push('estimating depth…');
  else if (depthMap) statusParts.push('3D form applied');
  if (labelStatus === 'loading') statusParts.push('reading the scene…');
  else if (labelMap) statusParts.push('scene labeled');

  return (
    <div className="controls">
      <div className="paint-section">
        <h3 className="section-title">Image → Ink</h3>

        <div className="control-group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="primary"
            onClick={() => fileInputRef.current?.click()}
          >
            {imageName ? 'Choose Another Image' : 'Choose Image…'}
          </button>

          <p className="paint-hint">
            {!imageName
              ? 'Upload a photo and get plotter-ready pen-and-ink art. Faces are handled automatically.'
              : focusPoints.length === 0
                ? 'Tip: tap your subject in the preview — the drawing will focus on it and fade the background.'
                : `${focusPoints.length} focus point${focusPoints.length === 1 ? '' : 's'} set. Tap to add more.`}
          </p>

          {statusParts.length > 0 && (
            <p className="paint-hint status-line">✨ {statusParts.join(' · ')}</p>
          )}

          {focusPoints.length > 0 && (
            <button type="button" className="secondary" onClick={clearFocus}>
              Clear Focus ({focusPoints.length})
            </button>
          )}

          {imageName && !depthMap && depthStatus !== 'loading' && (
            <button type="button" className="secondary" onClick={estimateDepthMap}>
              Add 3D Form (AI)
            </button>
          )}
          {depthStatus === 'error' && (
            <p className="paint-hint">
              Depth estimation failed
              {depthError ? `: ${depthError.slice(0, 200)}` : ' — check your connection and try again.'}
            </p>
          )}

          {lowMemory && (
            <p className="paint-hint">
              ⚡ Low-memory mode: a previous session crashed on this device, so
              renders are smaller and lighter here.{' '}
              <button type="button" className="link-button" onClick={disableLowMemory}>
                Turn off
              </button>
            </p>
          )}
        </div>
      </div>

      <h3 className="section-title">Style</h3>

      <div className="preset-row">
        {Object.entries(PRESETS)
          .filter(([, def]) => !def.artist)
          .map(([name, def]) => (
            <button
              key={name}
              type="button"
              className={preset === name ? 'preset active' : 'preset'}
              onClick={() => applyPreset(name)}
              disabled={!imageName}
            >
              {def.label}
            </button>
          ))}
      </div>

      <h3 className="section-title">Artist styles</h3>

      <div className="preset-row">
        {Object.entries(PRESETS)
          .filter(([, def]) => def.artist)
          .map(([name, def]) => (
            <button
              key={name}
              type="button"
              className={preset === name ? 'preset active' : 'preset'}
              onClick={() => applyPreset(name)}
              disabled={!imageName}
              title={def.hint}
            >
              {def.label}
            </button>
          ))}
      </div>

      <div className="button-group">
        {downloadSVG && (
          <button type="button" className="primary" onClick={downloadSVG} disabled={!imageName}>
            Download SVG
          </button>
        )}
        <button
          type="button"
          className="secondary"
          onClick={randomizeSeed}
          title="New random variation"
        >
          🎲
        </button>
      </div>

      {hasLayers && downloadLayers && (
        <div className="button-group">
          <button
            type="button"
            className="secondary"
            onClick={downloadLayers}
            disabled={!imageName}
            title="One SVG per pen layer (drawing pens / texture / border), zipped — plot each with a different pen"
          >
            Download layers (.zip)
          </button>
        </div>
      )}

      <AdvancedSection>
        <AdvGroup title="Tone & Density">
          <Slider
            label="Layers"
            value={settings.layers}
            min={1}
            max={5}
            step={1}
            onChange={(v) => updateSettings({ layers: v })}
          />

          <Slider
            label="Shadow Spacing"
            value={settings.minSpacing}
            min={1.5}
            max={8}
            step={0.5}
            onChange={(v) => updateSettings({ minSpacing: v })}
            format={(v) => `${v.toFixed(1)}px`}
          />

          <Slider
            label="Highlight Spacing"
            value={settings.maxSpacing}
            min={6}
            max={30}
            step={1}
            onChange={(v) => updateSettings({ maxSpacing: v })}
            format={(v) => `${v.toFixed(0)}px`}
          />

          <Slider
            label="White Cutoff"
            value={settings.whiteCutoff}
            min={0}
            max={0.4}
            step={0.02}
            onChange={(v) => updateSettings({ whiteCutoff: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            label="Tone Gamma"
            value={settings.toneGamma}
            min={0.5}
            max={2.5}
            step={0.05}
            onChange={(v) => updateSettings({ toneGamma: v })}
            format={(v) => v.toFixed(2)}
          >
            <p className="paint-hint">Higher keeps midtones light, pushes ink into shadows.</p>
          </Slider>

          <Slider
            label="Value Bands"
            value={settings.valueBands}
            min={0}
            max={6}
            step={1}
            onChange={(v) => updateSettings({ valueBands: v })}
            format={(v) => (v < 2 ? 'off' : v)}
          >
            <p className="paint-hint">
              Commit tone to a few big value shapes, like an artist&apos;s value plan.
            </p>
          </Slider>

          <Slider
            label="Massing"
            value={settings.massing}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSettings({ massing: v })}
            disabled={settings.valueBands < 2}
            format={(v) => (settings.valueBands < 2 ? 'needs value bands' : v.toFixed(2))}
          >
            <p className="paint-hint">
              Compose the value plan by role: swell ground behind the subject, commit lights and darks apart.
            </p>
          </Slider>

          <Slider
            label="Hatch Patchiness"
            value={settings.hatchPatchiness}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSettings({ hatchPatchiness: v })}
            format={(v) => v.toFixed(2)}
          >
            <p className="paint-hint">
              Cross-hatch builds up in patches with gaps instead of a woven screen.
            </p>
          </Slider>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.richBlacks}
                onChange={(e) => updateSettings({ richBlacks: e.target.checked })}
              />
              Rich blacks (deep shadows go solid)
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.solidBlacks}
                onChange={(e) => updateSettings({ solidBlacks: e.target.checked })}
                disabled={settings.valueBands < 2}
              />
              Solid blacks (fill the darkest value band with ink)
            </label>
          </div>
        </AdvGroup>

        <AdvGroup title="Marks & Style">
          <Slider
            label="Hatch Angle"
            value={settings.hatchAngle}
            min={-90}
            max={90}
            step={5}
            onChange={(v) => updateSettings({ hatchAngle: v })}
            format={(v) => `${v}°`}
          />

          <Slider
            label="Wobble"
            value={settings.wobble}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => updateSettings({ wobble: v })}
            format={(v) => `${v.toFixed(1)}px`}
          />

          <Slider
            label="Texture Strokes"
            value={settings.textureStrokes}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSettings({ textureStrokes: v })}
            format={(v) => v.toFixed(2)}
          />

          <div className="control-group">
            <label>Texture Mark Style</label>
            <select
              value={settings.textureStyle}
              onChange={(e) =>
                updateSettings({
                  textureStyle: e.target.value as 'ticks' | 'stipple' | 'scribble',
                })
              }
            >
              <option value="ticks">Directional ticks</option>
              <option value="stipple">Stipple dots</option>
              <option value="scribble">Scribble</option>
            </select>
          </div>

          <Slider
            label="Max Stroke Length"
            value={settings.maxStrokeLength}
            min={0}
            max={80}
            step={4}
            onChange={(v) => updateSettings({ maxStrokeLength: v })}
            format={(v) => (v === 0 ? 'unlimited' : `${v}px`)}
          />

          <Slider
            label="Flow Smoothing"
            value={settings.fieldSmoothing}
            min={2}
            max={12}
            step={1}
            onChange={(v) => updateSettings({ fieldSmoothing: v })}
          />

          <Slider
            label="Scribble Tone"
            value={settings.scribbleTone}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSettings({ scribbleTone: v })}
            format={(v) => (v === 0 ? 'off' : v.toFixed(2))}
          >
            <p className="paint-hint">
              One continuous ballpoint scribble carries the tone instead of hatching — loops in shadow, waves in light.
            </p>
          </Slider>

          <Slider
            label="Line Swell"
            value={settings.lineSwell}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSettings({ lineSwell: v })}
            format={(v) => (v === 0 ? 'off' : v.toFixed(2))}
          >
            <p className="paint-hint">
              Hatch lines thicken through shadow and thin to hairlines in the light, like an engraving.
            </p>
          </Slider>

          <Slider
            label="Counterchange"
            value={settings.counterchange}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSettings({ counterchange: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            label="Silhouette Halo"
            value={settings.contourHalo}
            min={0}
            max={6}
            step={0.2}
            onChange={(v) => updateSettings({ contourHalo: v })}
            format={(v) => (v === 0 ? 'off' : `${v.toFixed(1)}px`)}
          />

          <div className="control-group">
            <label>Stipple open skies</label>
            <select
              value={String(settings.skyStipple)}
              onChange={(e) =>
                updateSettings({
                  skyStipple: e.target.value === 'auto' ? 'auto' : e.target.value === 'true',
                })
              }
            >
              <option value="auto">Auto (when labels find sky)</option>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </div>

          <div className="control-group">
            <label>Calm water (broken horizontal strokes)</label>
            <select
              value={String(settings.calmWater)}
              onChange={(e) =>
                updateSettings({
                  calmWater: e.target.value === 'auto' ? 'auto' : e.target.value === 'true',
                })
              }
            >
              <option value="auto">Auto (when labels find water)</option>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.crossContour}
                onChange={(e) => updateSettings({ crossContour: e.target.checked })}
              />
              Cross-contour hatching (etching style)
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.facetHatch}
                onChange={(e) => updateSettings({ facetHatch: e.target.checked })}
              />
              Faceted hatching (straight strokes in patches)
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.followTone}
                onChange={(e) => updateSettings({ followTone: e.target.checked })}
              />
              Strokes follow image contours
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.drawOutlines}
                onChange={(e) => updateSettings({ drawOutlines: e.target.checked })}
              />
              Bold contour outlines
            </label>
          </div>

          <Slider
            label="Outline Passes"
            value={settings.outlinePasses}
            min={1}
            max={4}
            step={1}
            onChange={(v) => updateSettings({ outlinePasses: v })}
            disabled={!settings.drawOutlines}
          />

          <Slider
            label="Outline Threshold"
            value={settings.outlineThreshold}
            min={0.1}
            max={0.8}
            step={0.05}
            onChange={(v) => updateSettings({ outlineThreshold: v })}
            disabled={!settings.drawOutlines}
            format={(v) => v.toFixed(2)}
          />
        </AdvGroup>

        <AdvGroup title="Subject & Focus">
          <Slider
            label="Detail Emphasis"
            value={settings.detailEmphasis}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSettings({ detailEmphasis: v })}
            format={(v) => v.toFixed(2)}
          />

          {focusPoints.length > 0 && (
            <>
              <Slider
                label="Focus Radius"
                value={settings.focusRadiusPct}
                min={5}
                max={60}
                step={1}
                onChange={(v) => updateSettings({ focusRadiusPct: v })}
                format={(v) => `${v}%`}
              />

              <Slider
                label="Focus Strength"
                value={settings.focusStrength}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => updateSettings({ focusStrength: v })}
                format={(v) => v.toFixed(2)}
              />

              <div className="control-group">
                <div className="paint-controls">
                  <button
                    type="button"
                    className="secondary"
                    onClick={isolateSubject}
                    disabled={segmentStatus === 'loading'}
                  >
                    {segmentStatus === 'loading' ? 'Isolating…' : 'Re-isolate Subjects (AI)'}
                  </button>
                  {subjectMask && (
                    <button type="button" className="secondary" onClick={clearSubjectMask}>
                      Clear Mask
                    </button>
                  )}
                </div>
                {segmentStatus === 'error' && (
                  <p className="paint-hint">
                    Subject isolation failed — check your connection and try again.
                  </p>
                )}
              </div>

              {subjectMask && (
                <Slider
                  label="Mask Strength"
                  value={settings.maskStrength}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => updateSettings({ maskStrength: v })}
                  format={(v) => v.toFixed(2)}
                />
              )}
            </>
          )}
        </AdvGroup>

        <AdvGroup title="Scene Labels">
          <div className="control-group">
            <p className="paint-hint">
              A small scene model labels sky, water, foliage, buildings and
              people so marks match the material — runs automatically on
              upload.
            </p>
            <div className="paint-controls">
              <button
                type="button"
                className="secondary"
                onClick={estimateSceneLabels}
                disabled={!imageName || labelStatus === 'loading'}
              >
                {labelStatus === 'loading' ? 'Reading scene…' : 'Re-read Scene (AI)'}
              </button>
              {labelMap && (
                <button type="button" className="secondary" onClick={clearLabels}>
                  Clear
                </button>
              )}
            </div>
            {labelStatus === 'error' && (
              <p className="paint-hint">
                Scene labeling failed
                {labelError
                  ? `: ${labelError.slice(0, 200)}`
                  : ' — check your connection and try again.'}
              </p>
            )}
          </div>
        </AdvGroup>

        <AdvGroup title="Portrait & 3D Form">
          <div className="control-group">
            <div className="paint-controls">
              <button
                type="button"
                className="secondary"
                onClick={detectFaces}
                disabled={!imageName || portraitStatus === 'loading'}
              >
                {portraitStatus === 'loading' ? 'Detecting…' : 'Re-detect Faces (AI)'}
              </button>
              {portraitState && (
                <button type="button" className="secondary" onClick={clearPortrait}>
                  Clear
                </button>
              )}
            </div>
            {portraitStatus === 'error' && (
              <p className="paint-hint">Face detection failed — check your connection.</p>
            )}
            {portraitStatus === 'none' && (
              <p className="paint-hint">No faces found in this image.</p>
            )}
          </div>

          {portraitState && (
            <>
              <Slider
                label="Skin Lightening"
                value={settings.skinLightening}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => updateSettings({ skinLightening: v })}
                format={(v) => v.toFixed(2)}
              />

              <div className="control-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.featureLines}
                    onChange={(e) => updateSettings({ featureLines: e.target.checked })}
                  />
                  Draw feature lines (eyes, brows, lips)
                </label>
              </div>
            </>
          )}

          {depthMap && (
            <>
              <Slider
                label="Form Strength"
                value={settings.formStrength}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => updateSettings({ formStrength: v })}
                format={(v) => v.toFixed(2)}
              />

              <Slider
                label="Depth Fade"
                value={settings.depthIsolation}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => updateSettings({ depthIsolation: v })}
                format={(v) => v.toFixed(2)}
              />

              <div className="control-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.autoStyle}
                    onChange={(e) => updateSettings({ autoStyle: e.target.checked })}
                  />
                  Auto mark-making (wrap curved forms)
                </label>
                <button type="button" className="secondary" onClick={clearDepth}>
                  Clear 3D Form
                </button>
              </div>
            </>
          )}
        </AdvGroup>

        <AdvGroup title="Marks & Output">
          <Slider
            label="Detail Resolution"
            value={settings.workingSize}
            min={400}
            max={1000}
            step={50}
            onChange={(v) => updateSettings({ workingSize: v })}
            format={(v) => `${v}px`}
          />

          <Slider
            label="Pen Width"
            value={settings.penWidthMm}
            min={0.1}
            max={1.5}
            step={0.05}
            onChange={(v) => updateSettings({ penWidthMm: v })}
            format={(v) => `${v}mm`}
          />

          <ColorField
            label="Stroke Color"
            value={settings.strokeColor}
            onChange={(strokeColor) => updateSettings({ strokeColor })}
          />

          <div className="control-group">
            <label>Seed</label>
            <div className="seed-input">
              <input
                type="number"
                value={settings.seed}
                onChange={(e) => updateSettings({ seed: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>
        </AdvGroup>
      </AdvancedSection>

    </div>
  );
}
