import { useRef } from 'react';
import type { GrayscaleImage, LabelImage, Point, PaperFit } from '@flow-lines/core';
import type {
  DepthStatus,
  InkSettings,
  LabelStatus,
  PortraitState,
  PortraitStatus,
  SegmentStatus,
} from '../App';
import { PaperControls } from './PaperControls';

/** Curated parameter bundles — the only decision most users need to make */
export const PRESETS: Record<string, { label: string; settings: Partial<InkSettings> }> = {
  classic: {
    label: 'Classic',
    settings: {
      layers: 3,
      minSpacing: 2.5,
      maxSpacing: 14,
      whiteCutoff: 0.08,
      toneGamma: 1.3,
      valueBands: 4,
      massing: 0.5,
      hatchPatchiness: 0.35,
      detailEmphasis: 0.3,
      textureStrokes: 0.45,
      wobble: 0.8,
      workingSize: 720,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 4,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
  portrait: {
    label: 'Portrait',
    settings: {
      layers: 3,
      minSpacing: 2.5,
      maxSpacing: 14,
      toneGamma: 1.7,
      valueBands: 0,
      massing: 0,
      hatchPatchiness: 0.35,
      detailEmphasis: 0.35,
      textureStrokes: 0.4,
      wobble: 0.9,
      workingSize: 800,
      skinLightening: 0.6,
      whiteCutoff: 0.08,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 4,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
  pet: {
    label: 'Pet',
    settings: {
      layers: 2,
      minSpacing: 2.5,
      maxSpacing: 12,
      toneGamma: 1.45,
      valueBands: 4,
      massing: 0.4,
      hatchPatchiness: 0.35,
      detailEmphasis: 0.35,
      textureStrokes: 1,
      wobble: 1,
      workingSize: 800,
      whiteCutoff: 0.08,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 4,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
  landscape: {
    label: 'Landscape',
    settings: {
      layers: 5,
      minSpacing: 1.8,
      maxSpacing: 16,
      toneGamma: 1,
      valueBands: 4,
      massing: 0.4,
      hatchPatchiness: 0.7,
      detailEmphasis: 0.45,
      textureStrokes: 0.5,
      wobble: 0.9,
      workingSize: 800,
      whiteCutoff: 0.14,
      hatchAngle: 0,
      skyStipple: true,
      calmWater: true,
      crossContour: false,
      facetHatch: true,
      maxStrokeLength: 70,
      fieldSmoothing: 5,
      textureStyle: 'ticks',
    },
  },
  sketch: {
    label: 'Sketch',
    settings: {
      layers: 1,
      minSpacing: 3.2,
      maxSpacing: 24,
      toneGamma: 1.35,
      valueBands: 3,
      massing: 0.5,
      hatchPatchiness: 0.6,
      detailEmphasis: 0.4,
      textureStrokes: 0.6,
      wobble: 2.2,
      workingSize: 720,
      whiteCutoff: 0.1,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 3,
      hatchAngle: -30,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'scribble',
    },
  },
  etching: {
    label: 'Etching',
    settings: {
      layers: 2,
      minSpacing: 2.8,
      maxSpacing: 14,
      whiteCutoff: 0.15,
      toneGamma: 1.8,
      valueBands: 5,
      massing: 0.5,
      hatchPatchiness: 0.5,
      detailEmphasis: 0.35,
      textureStrokes: 0.15,
      wobble: 0.4,
      workingSize: 800,
      crossContour: true,
      facetHatch: true,
      maxStrokeLength: 48,
      fieldSmoothing: 8,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
};

interface ImageControlsProps {
  settings: InkSettings;
  imageName: string | null;
  preset: string;
  applyPreset: (name: string) => void;
  updateSettings: (updates: Partial<InkSettings>) => void;
  onImageFile: (file: File) => void;
  randomizeSeed: () => void;
  downloadSVG: () => void;
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
        {Object.entries(PRESETS).map(([name, def]) => (
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

      <h3 className="section-title">Paper</h3>

      <PaperControls
        paper={settings.paper}
        orientation={settings.orientation}
        resolution={settings.resolution}
        onChange={updateSettings}
      />

      <div className="control-group">
        <label>Fit to page</label>
        <div className="segmented">
          <button
            type="button"
            className={settings.fit === 'fit' ? 'active' : ''}
            onClick={() => updateSettings({ fit: 'fit' as PaperFit })}
          >
            Fit
          </button>
          <button
            type="button"
            className={settings.fit === 'fill' ? 'active' : ''}
            onClick={() => updateSettings({ fit: 'fill' as PaperFit })}
          >
            Fill
          </button>
        </div>
      </div>

      <div className="button-group">
        <button type="button" className="primary" onClick={downloadSVG} disabled={!imageName}>
          Download SVG
        </button>
        <button
          type="button"
          className="secondary"
          onClick={randomizeSeed}
          title="New random variation"
        >
          🎲
        </button>
      </div>

      <details className="advanced">
        <summary>Advanced</summary>

        <details className="adv-group">
          <summary>Tone &amp; Density</summary>

          <div className="control-group">
            <label>
              Layers <span>{settings.layers}</span>
            </label>
            <input
              type="range" min="1" max="5" step="1"
              value={settings.layers}
              onChange={(e) => updateSettings({ layers: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              Shadow Spacing <span>{settings.minSpacing.toFixed(1)}px</span>
            </label>
            <input
              type="range" min="1.5" max="8" step="0.5"
              value={settings.minSpacing}
              onChange={(e) => updateSettings({ minSpacing: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Highlight Spacing <span>{settings.maxSpacing.toFixed(0)}px</span>
            </label>
            <input
              type="range" min="6" max="30" step="1"
              value={settings.maxSpacing}
              onChange={(e) => updateSettings({ maxSpacing: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              White Cutoff <span>{settings.whiteCutoff.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0" max="0.4" step="0.02"
              value={settings.whiteCutoff}
              onChange={(e) => updateSettings({ whiteCutoff: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Tone Gamma <span>{settings.toneGamma.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0.5" max="2.5" step="0.05"
              value={settings.toneGamma}
              onChange={(e) => updateSettings({ toneGamma: parseFloat(e.target.value) })}
            />
            <p className="paint-hint">Higher keeps midtones light, pushes ink into shadows.</p>
          </div>

          <div className="control-group">
            <label>
              Value Bands{' '}
              <span>{settings.valueBands < 2 ? 'off' : settings.valueBands}</span>
            </label>
            <input
              type="range" min="0" max="6" step="1"
              value={settings.valueBands}
              onChange={(e) => updateSettings({ valueBands: parseInt(e.target.value, 10) })}
            />
            <p className="paint-hint">
              Commit tone to a few big value shapes, like an artist&apos;s value plan.
            </p>
          </div>

          <div className="control-group">
            <label>
              Massing <span>{settings.valueBands < 2 ? 'needs value bands' : settings.massing.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.massing}
              disabled={settings.valueBands < 2}
              onChange={(e) => updateSettings({ massing: parseFloat(e.target.value) })}
            />
            <p className="paint-hint">
              Compose the value plan by role: swell ground behind the subject, commit lights and darks apart.
            </p>
          </div>

          <div className="control-group">
            <label>
              Hatch Patchiness <span>{settings.hatchPatchiness.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.hatchPatchiness}
              onChange={(e) => updateSettings({ hatchPatchiness: parseFloat(e.target.value) })}
            />
            <p className="paint-hint">
              Cross-hatch builds up in patches with gaps instead of a woven screen.
            </p>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.richBlacks}
                onChange={(e) => updateSettings({ richBlacks: e.target.checked })}
              />
              Rich blacks (deep shadows go solid)
            </label>
          </div>
        </details>

        <details className="adv-group">
          <summary>Marks &amp; Style</summary>

          <div className="control-group">
            <label>
              Hatch Angle <span>{settings.hatchAngle}°</span>
            </label>
            <input
              type="range" min="-90" max="90" step="5"
              value={settings.hatchAngle}
              onChange={(e) => updateSettings({ hatchAngle: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              Wobble <span>{settings.wobble.toFixed(1)}px</span>
            </label>
            <input
              type="range" min="0" max="3" step="0.1"
              value={settings.wobble}
              onChange={(e) => updateSettings({ wobble: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Texture Strokes <span>{settings.textureStrokes.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.textureStrokes}
              onChange={(e) => updateSettings({ textureStrokes: parseFloat(e.target.value) })}
            />
          </div>

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

          <div className="control-group">
            <label>
              Max Stroke Length{' '}
              <span>{settings.maxStrokeLength === 0 ? 'unlimited' : `${settings.maxStrokeLength}px`}</span>
            </label>
            <input
              type="range" min="0" max="80" step="4"
              value={settings.maxStrokeLength}
              onChange={(e) => updateSettings({ maxStrokeLength: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              Flow Smoothing <span>{settings.fieldSmoothing}</span>
            </label>
            <input
              type="range" min="2" max="12" step="1"
              value={settings.fieldSmoothing}
              onChange={(e) => updateSettings({ fieldSmoothing: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              Counterchange <span>{settings.counterchange.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.counterchange}
              onChange={(e) => updateSettings({ counterchange: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Silhouette Halo{' '}
              <span>{settings.contourHalo === 0 ? 'off' : `${settings.contourHalo.toFixed(1)}px`}</span>
            </label>
            <input
              type="range" min="0" max="6" step="0.2"
              value={settings.contourHalo}
              onChange={(e) => updateSettings({ contourHalo: parseFloat(e.target.value) })}
            />
          </div>

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
        </details>

        <details className="adv-group">
          <summary>Subject &amp; Focus</summary>

          <div className="control-group">
            <label>
              Detail Emphasis <span>{settings.detailEmphasis.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.detailEmphasis}
              onChange={(e) => updateSettings({ detailEmphasis: parseFloat(e.target.value) })}
            />
          </div>

          {focusPoints.length > 0 && (
            <>
              <div className="control-group">
                <label>
                  Focus Radius <span>{settings.focusRadiusPct}%</span>
                </label>
                <input
                  type="range" min="5" max="60" step="1"
                  value={settings.focusRadiusPct}
                  onChange={(e) =>
                    updateSettings({ focusRadiusPct: parseInt(e.target.value, 10) })
                  }
                />
              </div>

              <div className="control-group">
                <label>
                  Focus Strength <span>{settings.focusStrength.toFixed(2)}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={settings.focusStrength}
                  onChange={(e) => updateSettings({ focusStrength: parseFloat(e.target.value) })}
                />
              </div>

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
                <div className="control-group">
                  <label>
                    Mask Strength <span>{settings.maskStrength.toFixed(2)}</span>
                  </label>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={settings.maskStrength}
                    onChange={(e) => updateSettings({ maskStrength: parseFloat(e.target.value) })}
                  />
                </div>
              )}
            </>
          )}
        </details>

        <details className="adv-group">
          <summary>Scene Labels</summary>

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
        </details>

        <details className="adv-group">
          <summary>Portrait &amp; 3D Form</summary>

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
              <div className="control-group">
                <label>
                  Skin Lightening <span>{settings.skinLightening.toFixed(2)}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={settings.skinLightening}
                  onChange={(e) => updateSettings({ skinLightening: parseFloat(e.target.value) })}
                />
              </div>

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
              <div className="control-group">
                <label>
                  Form Strength <span>{settings.formStrength.toFixed(2)}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={settings.formStrength}
                  onChange={(e) => updateSettings({ formStrength: parseFloat(e.target.value) })}
                />
              </div>

              <div className="control-group">
                <label>
                  Depth Fade <span>{settings.depthIsolation.toFixed(2)}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={settings.depthIsolation}
                  onChange={(e) => updateSettings({ depthIsolation: parseFloat(e.target.value) })}
                />
              </div>

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
        </details>

        <details className="adv-group">
          <summary>Canvas &amp; Output</summary>

          <div className="control-group">
            <label>
              Margin <span>{settings.marginMm}mm</span>
            </label>
            <input
              type="range" min="0" max="40" step="1"
              value={settings.marginMm}
              onChange={(e) => updateSettings({ marginMm: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              Detail Resolution <span>{settings.workingSize}px</span>
            </label>
            <input
              type="range" min="400" max="1000" step="50"
              value={settings.workingSize}
              onChange={(e) => updateSettings({ workingSize: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="control-group">
            <label>
              Pen Width <span>{settings.penWidthMm}mm</span>
            </label>
            <input
              type="range" min="0.1" max="1.5" step="0.05"
              value={settings.penWidthMm}
              onChange={(e) => updateSettings({ penWidthMm: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>Stroke Color</label>
            <input
              type="text"
              value={settings.strokeColor}
              onChange={(e) => updateSettings({ strokeColor: e.target.value })}
            />
          </div>

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
        </details>
      </details>

    </div>
  );
}
