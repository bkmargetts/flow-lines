import { ColorField } from '../../components/ColorField';
import { AdvancedSection } from '../../components/controls/AdvancedSection';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { PlanetState } from './types';
import { PLANET_PALETTES, CUSTOM_PALETTE } from './palettes';
import { PLANET_PRESETS, getPlanetPreset, randomPlanetGenome } from './presets';

/** Sidebar controls for the Planet Generator module. */
export function PlanetGeneratorControls({ state, update }: ControlsProps<PlanetState>) {
  const t = state.planetType;
  const isTerrestrial = t === 'terrestrial' || t === 'ice' || t === 'lava';
  const isGas = t === 'gas-giant' || t === 'ringed';
  const isRocky = t === 'moon' || t === 'barren' || t === 'asteroid';
  const isSmallBody = t === 'asteroid' || t === 'comet';
  const isStar = t === 'star';

  const selectType = (id: string) => {
    const preset = getPlanetPreset(id);
    update(preset ? preset.state : { planetType: id as PlanetState['planetType'] });
  };
  const surprise = () => {
    update({ ...randomPlanetGenome(Math.random), seed: randomSeed() });
  };

  return (
    <div className="controls">
      <h3 className="section-title">Planet</h3>

      <div className="control-group">
        <div className="seed-input">
          <select value={t} onChange={(e) => selectType(e.target.value)} style={{ flex: 1 }}>
            {PLANET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={surprise} title="Surprise me">
            🎲
          </button>
        </div>
        <p className="paint-hint">Pick a world, then tune anything below.</p>
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

      <Slider label="Size" value={state.radiusFrac} min={0.3} max={0.95} step={0.01} onChange={(v) => update({ radiusFrac: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Zoom" value={state.zoom} min={0.3} max={3} step={0.05} onChange={(v) => update({ zoom: v })} format={(v) => `${v.toFixed(2)}×`} />

      <h3 className="section-title">Composition</h3>
      <div className="control-group">
        <label className="label-text">Layout</label>
        <select value={state.layout} onChange={(e) => update({ layout: e.target.value as PlanetState['layout'] })}>
          <option value="single">Single planet</option>
          <option value="phases">Phase strip</option>
          <option value="comparison">Size comparison</option>
          <option value="orbital">Orbital diagram</option>
        </select>
      </div>
      {state.layout !== 'single' && (
        <Slider label="Bodies" value={state.layoutCount} min={2} max={12} step={1} onChange={(v) => update({ layoutCount: v })} />
      )}

      <h3 className="section-title">Light</h3>
      <Slider label="Direction" value={state.lightAngle} min={-180} max={180} step={1} onChange={(v) => update({ lightAngle: v })} format={(v) => `${v}°`} />
      <Slider label="Elevation" value={state.lightElevation} min={0} max={90} step={1} onChange={(v) => update({ lightElevation: v })} format={(v) => `${v}°`} />
      <Slider label="Ambient" value={state.ambient} min={0} max={1} step={0.02} onChange={(v) => update({ ambient: v })} format={(v) => v.toFixed(2)} />
      <Slider label="Limb darkening" value={state.limbDarkening} min={0} max={1} step={0.05} onChange={(v) => update({ limbDarkening: v })} format={(v) => v.toFixed(2)} />

      <h3 className="section-title">Surface</h3>
      {isTerrestrial && t === 'terrestrial' && (
        <Slider label="Ocean" value={state.ocean} min={0} max={1} step={0.02} onChange={(v) => update({ ocean: v })} format={(v) => `${Math.round(v * 100)}%`} />
      )}
      {isRocky && (
        <Slider label="Dark plains" value={state.mareAmount} min={0} max={1} step={0.02} onChange={(v) => update({ mareAmount: v })} format={(v) => `${Math.round(v * 100)}%`} />
      )}
      {!isStar && (
        <>
          <Slider label="Terrain scale" value={state.terrainScale} min={0.6} max={3.5} step={0.05} onChange={(v) => update({ terrainScale: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Contrast" value={state.terrainContrast} min={0.6} max={2.5} step={0.05} onChange={(v) => update({ terrainContrast: v })} format={(v) => v.toFixed(2)} />
          <Toggle label="Trace coastlines / edges" checked={state.coastlines} onChange={(v) => update({ coastlines: v })} />
        </>
      )}
      {t === 'lava' && (
        <>
          <Slider label="Fissure width" value={state.lavaFissureWidth} min={0.04} max={0.3} step={0.01} onChange={(v) => update({ lavaFissureWidth: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Ember glow" value={state.lavaGlow} min={0} max={1} step={0.05} onChange={(v) => update({ lavaGlow: v })} format={(v) => v.toFixed(2)} />
        </>
      )}
      {!isStar && (
        <Toggle label="Ice caps" checked={state.iceCaps} onChange={(v) => update({ iceCaps: v })} />
      )}
      {state.iceCaps && !isStar && (
        <Slider label="Cap latitude" value={state.capLatitude} min={20} max={85} step={1} onChange={(v) => update({ capLatitude: v })} format={(v) => `${v}°`} />
      )}

      {isGas && (
        <>
          <h3 className="section-title">Bands</h3>
          <Toggle label="Banded zones" checked={state.bands} onChange={(v) => update({ bands: v })} />
          <Slider label="Band count" value={state.bandCount} min={3} max={20} step={1} onChange={(v) => update({ bandCount: v })} disabled={!state.bands} />
          <Slider label="Turbulence" value={state.bandTurbulence} min={0} max={1.2} step={0.05} onChange={(v) => update({ bandTurbulence: v })} disabled={!state.bands} format={(v) => v.toFixed(2)} />
          <Slider label="Storms" value={state.storms} min={0} max={4} step={1} onChange={(v) => update({ storms: v })} />
          <Slider label="Storm size" value={state.stormSize} min={0.4} max={2} step={0.1} onChange={(v) => update({ stormSize: v })} disabled={state.storms < 1} format={(v) => `${v.toFixed(1)}×`} />
          <Slider label="Oblateness" value={state.oblateness} min={0} max={0.15} step={0.005} onChange={(v) => update({ oblateness: v })} format={(v) => v.toFixed(3)} />
        </>
      )}

      <h3 className="section-title">Hatching</h3>
      <Slider label="Spacing" value={state.hatchSpacingMm} min={0.8} max={4} step={0.1} onChange={(v) => update({ hatchSpacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Cross-hatch layers" value={state.crossHatchLayers} min={1} max={5} step={1} onChange={(v) => update({ crossHatchLayers: v })} />
      <Slider label="Stipple" value={state.stipple} min={0} max={1} step={0.05} onChange={(v) => update({ stipple: v })} format={(v) => v.toFixed(2)} />

      {(isGas || isRocky) && (
        <>
          <h3 className="section-title">Rings</h3>
          <Toggle label="Rings" checked={state.rings} onChange={(v) => update({ rings: v })} />
          {state.rings && (
            <>
              <Slider label="Tilt" value={state.ringTilt} min={2} max={45} step={1} onChange={(v) => update({ ringTilt: v })} format={(v) => `${v}°`} />
              <Slider label="Yaw" value={state.ringYaw} min={-45} max={45} step={1} onChange={(v) => update({ ringYaw: v })} format={(v) => `${v}°`} />
              <Slider label="Bands" value={state.ringCount} min={2} max={14} step={1} onChange={(v) => update({ ringCount: v })} />
              <Slider label="Density" value={state.ringDensity} min={1} max={8} step={1} onChange={(v) => update({ ringDensity: v })} />
              <Slider label="Gap" value={state.ringGap} min={0} max={0.5} step={0.02} onChange={(v) => update({ ringGap: v })} format={(v) => v.toFixed(2)} />
              <Toggle label="Cast shadow on rings" checked={state.ringShadow} onChange={(v) => update({ ringShadow: v })} />
            </>
          )}
        </>
      )}

      {isSmallBody && (
        <>
          <h3 className="section-title">{t === 'comet' ? 'Comet' : 'Asteroid'}</h3>
          <Slider label="Lumpiness" value={state.lumpiness} min={0} max={0.25} step={0.01} onChange={(v) => update({ lumpiness: v })} format={(v) => v.toFixed(2)} />
          {t === 'comet' && (
            <>
              <Slider label="Tail length" value={state.tailLength} min={2} max={9} step={0.5} onChange={(v) => update({ tailLength: v })} format={(v) => `${v.toFixed(1)}×`} />
              <Slider label="Tail spread" value={state.tailSpread} min={10} max={60} step={2} onChange={(v) => update({ tailSpread: v })} format={(v) => `${v}°`} />
            </>
          )}
        </>
      )}

      {(isRocky || t === 'comet') && (
        <>
          <h3 className="section-title">Craters</h3>
          <Toggle label="Craters" checked={state.craters} onChange={(v) => update({ craters: v })} />
          {state.craters && (
            <>
              <Slider label="Count" value={state.craterCount} min={0} max={200} step={5} onChange={(v) => update({ craterCount: v })} />
              <Slider label="Max size" value={state.craterMaxR} min={0.03} max={0.3} step={0.01} onChange={(v) => update({ craterMaxR: v })} format={(v) => v.toFixed(2)} />
              <Toggle label="Central peaks + ejecta rays" checked={state.craterDetail} onChange={(v) => update({ craterDetail: v })} />
            </>
          )}
        </>
      )}

      {!isStar && (
        <>
          <h3 className="section-title">Relief</h3>
          <Slider label="Terminator emphasis" value={state.terminatorEmphasis} min={0} max={1} step={0.05} onChange={(v) => update({ terminatorEmphasis: v })} format={(v) => v.toFixed(2)} />
          {t === 'terrestrial' && (
            <>
              <Toggle label="Mountain hachures" checked={state.mountains} onChange={(v) => update({ mountains: v })} />
              <Toggle label="Clouds" checked={state.clouds} onChange={(v) => update({ clouds: v })} />
              <Slider label="Rivers" value={state.rivers} min={0} max={12} step={1} onChange={(v) => update({ rivers: v })} />
            </>
          )}
          {isRocky && (
            <Slider label="Rilles (channels)" value={state.rilles} min={0} max={8} step={1} onChange={(v) => update({ rilles: v })} />
          )}
        </>
      )}

      <h3 className="section-title">Scene</h3>
      <Toggle label="Starfield" checked={state.starfield} onChange={(v) => update({ starfield: v })} />
      {state.starfield && (
        <Slider label="Stars" value={state.starCount} min={0} max={400} step={10} onChange={(v) => update({ starCount: v })} />
      )}
      <Slider label="Atmosphere / corona" value={state.atmosphere} min={0} max={3} step={1} onChange={(v) => update({ atmosphere: v })} />
      {!isStar && state.atmosphere > 0 && (
        <div className="control-group">
          <label className="label-text">Atmosphere style</label>
          <select value={state.atmosphereStyle} onChange={(e) => update({ atmosphereStyle: e.target.value as PlanetState['atmosphereStyle'] })}>
            <option value="rings">Glow rings</option>
            <option value="haze">Broken haze</option>
          </select>
        </div>
      )}
      {!isStar && (
        <>
          <Toggle label="Aurora" checked={state.aurora} onChange={(v) => update({ aurora: v })} />
          {state.aurora && (
            <>
              <Slider label="Aurora latitude" value={state.auroraLatitude} min={55} max={85} step={1} onChange={(v) => update({ auroraLatitude: v })} format={(v) => `${v}°`} />
              <Slider label="Aurora intensity" value={state.auroraIntensity} min={0} max={1} step={0.05} onChange={(v) => update({ auroraIntensity: v })} format={(v) => v.toFixed(2)} />
            </>
          )}
        </>
      )}
      <Toggle label="Companion moon" checked={state.moon} onChange={(v) => update({ moon: v })} />
      {state.moon && (
        <>
          <Slider label="Moon distance" value={state.moonDist} min={1.3} max={3} step={0.05} onChange={(v) => update({ moonDist: v })} format={(v) => `${v.toFixed(2)}×`} />
          <Slider label="Moon angle" value={state.moonAngle} min={-180} max={180} step={1} onChange={(v) => update({ moonAngle: v })} format={(v) => `${v}°`} />
          <Slider label="Moon size" value={state.moonRadiusFrac} min={0.1} max={0.6} step={0.02} onChange={(v) => update({ moonRadiusFrac: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Toggle label="Eclipse (moon shadow)" checked={state.eclipse} onChange={(v) => update({ eclipse: v })} />
        </>
      )}

      <h3 className="section-title">Plate</h3>
      <Toggle label="Graticule (lat/long)" checked={state.graticule} onChange={(v) => update({ graticule: v })} />
      {state.graticule && (
        <Slider label="Graticule spacing" value={state.graticuleSpacingDeg} min={10} max={45} step={5} onChange={(v) => update({ graticuleSpacingDeg: v })} format={(v) => `${v}°`} />
      )}
      {!isStar && (
        <>
          <Toggle label="Feature labels" checked={state.featureLabels} onChange={(v) => update({ featureLabels: v })} />
          {state.featureLabels && (
            <Slider label="Label count" value={state.labelCount} min={2} max={12} step={1} onChange={(v) => update({ labelCount: v })} />
          )}
        </>
      )}
      {state.layout === 'orbital' && (
        <>
          <Toggle label="Orbit labels" checked={state.orbitLabels} onChange={(v) => update({ orbitLabels: v })} />
          <Toggle label="Asteroid belt" checked={state.asteroidBelt} onChange={(v) => update({ asteroidBelt: v })} />
        </>
      )}
      <Toggle label="Graduated frame" checked={state.plateFrame} onChange={(v) => update({ plateFrame: v })} />
      <Toggle label="Scale bar" checked={state.scaleBar} onChange={(v) => update({ scaleBar: v })} />
      <div className="control-group">
        <label className="label-text">Title</label>
        <input type="text" value={state.plateTitle} placeholder="e.g. TERRA INCOGNITA" onChange={(e) => update({ plateTitle: e.target.value })} />
      </div>
      <div className="control-group">
        <label className="label-text">Caption</label>
        <input type="text" value={state.plateCaption} placeholder="e.g. PLATE I" onChange={(e) => update({ plateCaption: e.target.value })} />
      </div>

      <h3 className="section-title">Ink</h3>
      <div className="control-group">
        <label className="label-text">Palette</label>
        <select value={state.palette} onChange={(e) => update({ palette: e.target.value })}>
          {PLANET_PALETTES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
          <option value={CUSTOM_PALETTE}>Custom…</option>
        </select>
      </div>
      {state.palette === CUSTOM_PALETTE && (
        <>
          <ColorField label="Limb ink" value={state.limbColor} onChange={(v) => update({ limbColor: v })} />
          <ColorField label="Hatch ink" value={state.hatchColor} onChange={(v) => update({ hatchColor: v })} />
          <ColorField label="Feature ink" value={state.featureColor} onChange={(v) => update({ featureColor: v })} />
          <ColorField label="Accent ink (rings / stars)" value={state.accentColor} onChange={(v) => update({ accentColor: v })} />
        </>
      )}

      <AdvancedSection>
        <Slider label="Terrain detail (octaves)" value={state.terrainDetail} min={1} max={7} step={1} onChange={(v) => update({ terrainDetail: v })} />
        <Slider label="Persistence" value={state.persistence} min={0.3} max={0.8} step={0.05} onChange={(v) => update({ persistence: v })} format={(v) => v.toFixed(2)} />
        <Slider label="Light weight" value={state.lightWeight} min={0} max={1} step={0.05} onChange={(v) => update({ lightWeight: v })} format={(v) => v.toFixed(2)} />
        <Slider label="Albedo weight" value={state.albedoWeight} min={0} max={1} step={0.05} onChange={(v) => update({ albedoWeight: v })} format={(v) => v.toFixed(2)} />
        <Slider label="Cap raggedness" value={state.capRaggedness} min={0} max={1} step={0.05} onChange={(v) => update({ capRaggedness: v })} format={(v) => v.toFixed(2)} disabled={!state.iceCaps} />
        <Slider label="Ring inner" value={state.ringInner} min={1.05} max={2} step={0.05} onChange={(v) => update({ ringInner: v })} format={(v) => `${v.toFixed(2)}×`} disabled={!state.rings} />
        <Slider label="Ring outer" value={state.ringOuter} min={1.4} max={3} step={0.05} onChange={(v) => update({ ringOuter: v })} format={(v) => `${v.toFixed(2)}×`} disabled={!state.rings} />
        <Slider label="Crater min size" value={state.craterMinR} min={0.01} max={0.1} step={0.005} onChange={(v) => update({ craterMinR: v })} format={(v) => v.toFixed(3)} disabled={!state.craters} />
        <Slider label="Pen width" value={state.penWidthMm} min={0.1} max={1} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        <Slider label="Wobble" value={state.wobbleMm} min={0} max={0.8} step={0.02} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        <Slider label="Sketchiness" value={state.sketch} min={0} max={1} step={0.05} onChange={(v) => update({ sketch: v })} format={(v) => v.toFixed(2)} />
        {state.sketch > 0 && (
          <div className="control-group">
            <label className="label-text">Sketch style</label>
            <select value={state.sketchStyle} onChange={(e) => update({ sketchStyle: e.target.value as PlanetState['sketchStyle'] })}>
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
