import { ColorField } from '../../components/ColorField';
import { AdvancedSection } from '../../components/controls/AdvancedSection';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { LandscapeState } from './types';
import { LANDSCAPE_PALETTES, CUSTOM_PALETTE } from './palettes';
import { LANDSCAPE_PRESETS, getLandscapePreset, randomLandscapeGenome } from './presets';

/** Sidebar controls for the Landscape Generator module. */
export function LandscapeGeneratorControls({ state, update }: ControlsProps<LandscapeState>) {
  const selectScene = (id: string) => {
    const preset = getLandscapePreset(id);
    update(preset ? { ...preset.state, scene: id } : { scene: id });
  };
  const surprise = () => {
    update({ ...randomLandscapeGenome(Math.random), seed: randomSeed() });
  };

  return (
    <div className="controls">
      <h3 className="section-title">Scene</h3>

      <div className="control-group">
        <div className="seed-input">
          <select value={state.scene} onChange={(e) => selectScene(e.target.value)} style={{ flex: 1 }}>
            {LANDSCAPE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={surprise} title="Surprise me">
            🎲
          </button>
        </div>
        <p className="paint-hint">Pick a scene, then tune anything below.</p>
      </div>

      <div className="control-group">
        <div className="seed-input">
          <label className="label-text" style={{ flex: 1 }}>Seed</label>
          <input
            type="number"
            value={state.seed}
            onChange={(e) => update({ seed: parseInt(e.target.value, 10) || 0 })}
            style={{ width: 110 }}
          />
          <button type="button" className="secondary" onClick={() => update({ seed: randomSeed() })} title="Random seed">
            🎲
          </button>
        </div>
      </div>

      <h3 className="section-title">Composition</h3>
      <Slider label="Horizon height" value={state.horizonFrac} min={0.15} max={0.8} step={0.01} onChange={(v) => update({ horizonFrac: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Horizon wobble" value={state.horizonWobbleMm} min={0} max={20} step={0.5} onChange={(v) => update({ horizonWobbleMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Toggle label="Water below the horizon" checked={state.hasWater} onChange={(v) => update({ hasWater: v })} />
      {state.hasWater && (
        <Slider label="Water depth" value={state.waterFrac} min={0.2} max={0.9} step={0.02} onChange={(v) => update({ waterFrac: v })} format={(v) => `${Math.round(v * 100)}%`} />
      )}
      <Slider label="Zoom" value={state.zoom} min={0.3} max={3} step={0.05} onChange={(v) => update({ zoom: v })} format={(v) => `${v.toFixed(2)}×`} />

      <h3 className="section-title">Sky &amp; sun</h3>
      <Slider label="Sky spacing" value={state.skyHatchSpacingMm} min={0.8} max={5} step={0.1} onChange={(v) => update({ skyHatchSpacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Toggle label="Sun / moon" checked={state.sun} onChange={(v) => update({ sun: v })} />
      {state.sun && (
        <>
          <Slider label="Sun across" value={state.sunXFrac} min={0.1} max={0.9} step={0.01} onChange={(v) => update({ sunXFrac: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Sun height" value={state.sunYFrac} min={0.08} max={0.6} step={0.01} onChange={(v) => update({ sunYFrac: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Sun size" value={state.sunRadiusMm} min={4} max={30} step={0.5} onChange={(v) => update({ sunRadiusMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <Slider label="Halo" value={state.sunHalo} min={0} max={1.5} step={0.05} onChange={(v) => update({ sunHalo: v })} format={(v) => v.toFixed(2)} />
          <Toggle label="Sun rays" checked={state.sunRays} onChange={(v) => update({ sunRays: v })} />
          <Toggle label="Draw rim (moon)" checked={state.moonRim} onChange={(v) => update({ moonRim: v })} />
          {state.hasWater && (
            <Toggle label="Water reflection" checked={state.reflection} onChange={(v) => update({ reflection: v })} />
          )}
        </>
      )}

      {state.hasWater && (
        <>
          <h3 className="section-title">Water</h3>
          <Slider label="Water spacing" value={state.waterHatchSpacingMm} min={0.8} max={5} step={0.1} onChange={(v) => update({ waterHatchSpacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <Slider label="Dash length" value={state.waterDashMm} min={2} max={30} step={0.5} onChange={(v) => update({ waterDashMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          <Slider label="Dash gap" value={state.waterGapMm} min={0.5} max={12} step={0.5} onChange={(v) => update({ waterGapMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          {state.reflection && state.sun && (
            <Slider label="Reflection width" value={state.reflectionWidthMm} min={2} max={30} step={0.5} onChange={(v) => update({ reflectionWidthMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
          )}
        </>
      )}

      <h3 className="section-title">{state.hasWater ? 'Land' : 'Ridges'}</h3>
      {!state.hasWater && (
        <Slider label="Ridge layers" value={state.ridgeCount} min={1} max={8} step={1} onChange={(v) => update({ ridgeCount: v })} />
      )}
      <Slider label="Ridge height" value={state.ridgeAmpMm} min={2} max={36} step={0.5} onChange={(v) => update({ ridgeAmpMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Hatch spacing" value={state.ridgeHatchSpacingMm} min={0.8} max={4} step={0.1} onChange={(v) => update({ ridgeHatchSpacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Peak sharpness" value={state.ridgeSharpness} min={0} max={1} step={0.05} onChange={(v) => update({ ridgeSharpness: v })} format={(v) => v.toFixed(2)} />
      <Toggle label="Form-following hatch (wraps the hill)" checked={state.formFollow} onChange={(v) => update({ formFollow: v })} />
      <Slider label="Hatch angle" value={state.ridgeHatchAngle} min={0} max={90} step={1} onChange={(v) => update({ ridgeHatchAngle: v })} format={(v) => `${v}°`} disabled={state.formFollow} />
      {!state.formFollow && (
        <Toggle label="Slope-following angle" checked={state.slopeFollow} onChange={(v) => update({ slopeFollow: v })} />
      )}

      <h3 className="section-title">Depth &amp; landforms</h3>
      {state.hasWater && (
        <Slider label="Headlands" value={state.headlands} min={0} max={5} step={1} onChange={(v) => update({ headlands: v })} />
      )}
      <Slider label="Foreground landform" value={state.foreground} min={0} max={1} step={0.05} onChange={(v) => update({ foreground: v })} format={(v) => (v < 0.01 ? 'off' : `${Math.round(v * 100)}%`)} />
      {state.foreground > 0.01 && (
        <div className="control-group">
          <label className="label-text">Foreground side</label>
          <select value={state.foregroundSide} onChange={(e) => update({ foregroundSide: e.target.value as LandscapeState['foregroundSide'] })}>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}

      <h3 className="section-title">Hatch craft</h3>
      <Slider label="Atmosphere (mist)" value={state.atmosphere} min={0} max={1} step={0.05} onChange={(v) => update({ atmosphere: v })} format={(v) => v.toFixed(2)} />
      <Slider label="Focal emphasis" value={state.focus} min={0} max={1} step={0.05} onChange={(v) => update({ focus: v })} format={(v) => v.toFixed(2)} />
      <Slider label="Tonal depth" value={state.toneContrast} min={0} max={1} step={0.05} onChange={(v) => update({ toneContrast: v })} format={(v) => v.toFixed(2)} />
      <Slider label="Cross-hatch (shadow)" value={state.crossHatch} min={0} max={2} step={1} onChange={(v) => update({ crossHatch: v })} />
      <Slider label="Patchiness" value={state.hatchPatchiness} min={0} max={1} step={0.05} onChange={(v) => update({ hatchPatchiness: v })} format={(v) => v.toFixed(2)} />
      <Slider label="Stroke break / taper" value={state.taper} min={0} max={1} step={0.05} onChange={(v) => update({ taper: v })} format={(v) => v.toFixed(2)} />

      <h3 className="section-title">Detail</h3>
      <Slider label="Clouds" value={state.clouds} min={0} max={1} step={0.05} onChange={(v) => update({ clouds: v })} format={(v) => (v < 0.01 ? 'off' : `${Math.round(v * 100)}%`)} />
      <Slider label="Trees" value={state.trees} min={0} max={12} step={1} onChange={(v) => update({ trees: v })} />
      {state.trees > 0 && (
        <div className="control-group">
          <label className="label-text">Tree style</label>
          <select value={state.treeStyle} onChange={(e) => update({ treeStyle: e.target.value as LandscapeState['treeStyle'] })}>
            <option value="mixed">Mixed</option>
            <option value="round">Round canopy</option>
            <option value="conifer">Conifer</option>
            <option value="scrub">Low scrub</option>
          </select>
        </div>
      )}
      <Slider label="Birds" value={state.birds} min={0} max={10} step={1} onChange={(v) => update({ birds: v })} />

      <h3 className="section-title">Rocks</h3>
      <Slider label="Rocks / islands" value={state.rocks} min={0} max={8} step={1} onChange={(v) => update({ rocks: v })} />
      {state.rocks > 0 && (
        <Slider label="Rock size" value={state.rockMaxSizeMm} min={4} max={36} step={0.5} onChange={(v) => update({ rockMaxSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      )}

      <h3 className="section-title">Ink</h3>
      <div className="control-group">
        <label className="label-text">Palette</label>
        <select value={state.palette} onChange={(e) => update({ palette: e.target.value })}>
          {LANDSCAPE_PALETTES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
          <option value={CUSTOM_PALETTE}>Custom…</option>
        </select>
      </div>
      {state.palette === CUSTOM_PALETTE && (
        <>
          <ColorField label="Sky ink" value={state.skyColor} onChange={(v) => update({ skyColor: v })} />
          <ColorField label="Water ink" value={state.waterColor} onChange={(v) => update({ waterColor: v })} />
          <ColorField label="Ridge ink" value={state.ridgeColor} onChange={(v) => update({ ridgeColor: v })} />
          <ColorField label="Contour ink" value={state.contourColor} onChange={(v) => update({ contourColor: v })} />
          <ColorField label="Rock ink" value={state.rockColor} onChange={(v) => update({ rockColor: v })} />
        </>
      )}

      <AdvancedSection>
        <Slider label="Sky tone (top)" value={state.skyToneTop} min={0} max={1} step={0.02} onChange={(v) => update({ skyToneTop: v })} format={(v) => v.toFixed(2)} />
        <Slider label="Sky tone (horizon)" value={state.skyToneHorizon} min={0} max={1} step={0.02} onChange={(v) => update({ skyToneHorizon: v })} format={(v) => v.toFixed(2)} />
        <Slider label="Horizon detail" value={state.horizonFreq} min={0.6} max={5} step={0.1} onChange={(v) => update({ horizonFreq: v })} format={(v) => v.toFixed(1)} />
        <Slider label="Ridge detail (octaves)" value={state.ridgeOctaves} min={1} max={6} step={1} onChange={(v) => update({ ridgeOctaves: v })} />
        <Slider label="Ridge roughness" value={state.ridgePersistence} min={0.3} max={0.75} step={0.05} onChange={(v) => update({ ridgePersistence: v })} format={(v) => v.toFixed(2)} />
        <Slider label="Ridge scale" value={state.ridgeFreq} min={0.6} max={5} step={0.1} onChange={(v) => update({ ridgeFreq: v })} format={(v) => v.toFixed(1)} />
        <Slider label="Rock spacing" value={state.rockHatchSpacingMm} min={0.8} max={3} step={0.1} onChange={(v) => update({ rockHatchSpacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} disabled={state.rocks < 1} />
        <Slider label="Pen width" value={state.penWidthMm} min={0.1} max={1} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        <Slider label="Wobble" value={state.wobbleMm} min={0} max={0.8} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        <Slider label="Sketchiness" value={state.sketch} min={0} max={1} step={0.05} onChange={(v) => update({ sketch: v })} format={(v) => v.toFixed(2)} />
        {state.sketch > 0 && (
          <div className="control-group">
            <label className="label-text">Sketch style</label>
            <select value={state.sketchStyle} onChange={(e) => update({ sketchStyle: e.target.value as LandscapeState['sketchStyle'] })}>
              <option value="loose">Loose</option>
              <option value="fine">Fine</option>
              <option value="gestural">Gestural</option>
              <option value="scratchy">Scratchy</option>
            </select>
          </div>
        )}
      </AdvancedSection>
    </div>
  );
}
