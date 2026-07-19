import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { BotanicalState } from './types';
import { BOTANICAL_PALETTES, CUSTOM_PALETTE } from './palettes';
import { BOTANICAL_PRESETS, getBotanicalPreset, randomBotanicalGenome } from './presets';

/** Sidebar controls for the Botanical Generator module. */
export function BotanicalGeneratorControls({ state, update }: ControlsProps<BotanicalState>) {
  // The paint tool seeds roots (seeding=painted) or defines the fill region
  // (composition=fill, shape=painted).
  const painting = state.seeding === 'painted' || (state.composition === 'fill' && state.fillShape === 'painted') || state.composition === 'guide';

  const selectSpecies = (id: string) => {
    const preset = getBotanicalPreset(id);
    update({ species: id, ...(preset ? preset.state : {}) });
  };
  const surprise = () => {
    // A coherent random genome: a species cross plus randomised page elements
    // (palette, vessel, ground, stem count) so every press varies everything,
    // not just the foliage.
    update({ species: 'custom', ...randomBotanicalGenome(Math.random), seed: randomSeed() });
  };

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll crosses a whole new plant and re-dresses the page — or tune anything below." />

      <h3 className="section-title">Species</h3>

      <div className="control-group">
        <div className="seed-input">
          <select value={state.species} onChange={(e) => selectSpecies(e.target.value)} style={{ flex: 1 }}>
            {BOTANICAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </div>
        <p className="paint-hint">A starting plant — tweak anything below; sliders fine-tune from here.</p>
      </div>

      <h3 className="section-title">Growth</h3>

      <div className="control-group">
        <label className="label-text">Composition</label>
        <select
          value={state.composition}
          onChange={(e) => update({ composition: e.target.value as BotanicalState['composition'] })}
        >
          <option value="specimen">Specimen (designed sprig)</option>
          <option value="wreath">Wreath / garland</option>
          <option value="border">Border / frame</option>
          <option value="bouquet">Bouquet</option>
          <option value="trellis">Trellis (climbers)</option>
          <option value="fill">Fill a shape</option>
          <option value="guide">Along a drawn line</option>
          <option value="free">Free (from roots)</option>
        </select>
        <p className="paint-hint">
          {state.composition === 'specimen'
            ? 'One designed specimen: a master gesture sweeping to a focal point, with white space.'
            : state.composition === 'fill'
              ? 'Growth colonises and fills the chosen shape.'
              : state.composition === 'guide'
                ? 'Draw a line on the canvas and the plant grows along it — a letter, a shape, a flourish.'
                : state.composition === 'free'
                  ? 'Grow freely from the roots below.'
                  : 'A composed botanical arrangement.'}
        </p>
      </div>

      {state.composition === 'trellis' && (
        <div className="control-group">
          <label className="label-text">Support</label>
          <select value={state.support} onChange={(e) => update({ support: e.target.value as BotanicalState['support'] })}>
            <option value="none">None</option>
            <option value="lattice">Lattice panel</option>
            <option value="arch">Arch</option>
            <option value="obelisk">Obelisk</option>
          </select>
          <p className="paint-hint">A drawn garden support the climbers wrap.</p>
        </div>
      )}

      {(state.composition === 'bouquet' || state.composition === 'specimen') && (
        <div className="control-group">
          <label className="label-text">Vessel</label>
          <select value={state.vessel} onChange={(e) => update({ vessel: e.target.value as BotanicalState['vessel'] })}>
            <option value="none">None</option>
            <option value="vase">Vase</option>
            <option value="urn">Urn</option>
            <option value="amphora">Amphora</option>
            <option value="bud-vase">Bud vase</option>
            <option value="pot">Pot (terracotta)</option>
            <option value="jar">Jar</option>
            <option value="mason-jar">Mason jar</option>
            <option value="bowl">Bowl</option>
          </select>
          <p className="paint-hint">A drawn container the stems rise out of, shaded as a rounded form.</p>
        </div>
      )}

      <div className="control-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={state.groundLine} onChange={(e) => update({ groundLine: e.target.checked })} />
          Ground line
        </label>
      </div>

      <Slider
        label="Negative space"
        value={state.negativeSpace}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ negativeSpace: v })}
        format={(v) => v.toFixed(2)}
      />
      <p className="paint-hint">Notan: holds one region of the page clear and swells the mass elsewhere.</p>

      <Slider
        label="Tonal massing"
        value={state.tonalMassing}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ tonalMassing: v })}
        format={(v) => v.toFixed(2)}
      />
      <p className="paint-hint">Light-driven value massing: foliage gathers and hatches heavier on the shadow side (away from the light angle), opening the lit side.</p>

      <Slider
        label="Value bands"
        value={state.valueBands}
        min={0}
        max={6}
        step={1}
        onChange={(v) => update({ valueBands: v })}
        format={(v) => (v < 2 ? 'smooth' : String(v))}
        disabled={state.tonalMassing <= 0}
      />
      <p className="paint-hint">Posterize the massing into a few committed value masses (3–4 is the sweet spot); smooth = continuous.</p>

      <Slider
        label="Zoom"
        value={state.zoom}
        min={0.3}
        max={3}
        step={0.05}
        onChange={(v) => update({ zoom: v })}
        format={(v) => `${v.toFixed(2)}×`}
      />

      {state.composition === 'fill' && (
        <div className="control-group">
          <label className="label-text">Shape</label>
          <select value={state.fillShape} onChange={(e) => update({ fillShape: e.target.value as BotanicalState['fillShape'] })}>
            <option value="heart">Heart</option>
            <option value="circle">Circle</option>
            <option value="oval">Oval</option>
            <option value="diamond">Diamond</option>
            <option value="painted">Painted region</option>
          </select>
          {state.fillShape === 'painted' && (
            <p className="paint-hint">Draw a closed outline with the paint tool below to define the region.</p>
          )}
        </div>
      )}

      <div className="control-group">
        <label className="label-text">Model</label>
        <div className="paint-controls">
          <button
            type="button"
            className={state.mode === 'growth' ? 'primary active' : 'secondary'}
            onClick={() => update({ mode: 'growth' })}
          >
            Climbing
          </button>
          <button
            type="button"
            className={state.mode === 'colonization' ? 'primary active' : 'secondary'}
            onClick={() => update({ mode: 'colonization' })}
          >
            Colonize
          </button>
        </div>
        <p className="paint-hint">
          {state.mode === 'growth'
            ? 'Stems meander and branch upward — the classic climbing habit.'
            : 'Branches grow to fill the page — a space-filling ivy/venation network.'}
        </p>
      </div>

      <div className="control-group">
        <label className="label-text">Roots from</label>
        <select
          value={state.seeding}
          onChange={(e) => update({ seeding: e.target.value as BotanicalState['seeding'] })}
        >
          <option value="scatter">Random scatter</option>
          <option value="edges">Frame edges (climbing)</option>
          <option value="point">Single point (centre-bottom)</option>
          <option value="painted">Painted points</option>
        </select>
      </div>

      {painting ? (
        <div className="paint-section">
          <div className="control-group">
            <div className="paint-controls">
              <button
                type="button"
                className={state.drawMode ? 'primary active' : 'primary'}
                onClick={() => update({ drawMode: !state.drawMode })}
              >
                {state.drawMode ? 'Stop Painting' : 'Paint Roots'}
              </button>
              {state.maskPath.length > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => update({ maskPath: [] })}
                >
                  Clear ({state.maskPath.length})
                </button>
              )}
            </div>
            <p className="paint-hint">
              {state.drawMode
                ? 'Click or drag on the canvas to place roots.'
                : state.maskPath.length > 0
                  ? `${state.maskPath.length} roots placed.`
                  : 'Paint where the stems should sprout from.'}
            </p>
          </div>
        </div>
      ) : (
        <Slider
          label="Roots"
          value={state.seedCount}
          min={1}
          max={40}
          step={1}
          onChange={(v) => update({ seedCount: v })}
        />
      )}

      <h3 className="section-title">Elements</h3>

      <Slider
        label="Density"
        value={state.density}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ density: v })}
        format={(v) => v.toFixed(2)}
      />

      <div className="control-group">
        <label className="label-text">Season</label>
        <select value={state.season} onChange={(e) => update({ season: e.target.value as BotanicalState['season'] })}>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="autumn">Autumn</option>
          <option value="winter">Winter</option>
        </select>
        <p className="paint-hint">Shifts foliage only (palette stays your choice). Winter goes bare as strength rises.</p>
      </div>
      <Slider
        label="Season Strength"
        value={state.seasonStrength}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ seasonStrength: v })}
        format={(v) => v.toFixed(2)}
      />

      <div className="control-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={state.leaves} onChange={(e) => update({ leaves: e.target.checked })} />
          Leaves
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={state.tendrils} onChange={(e) => update({ tendrils: e.target.checked })} />
          Tendrils
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={state.flowers} onChange={(e) => update({ flowers: e.target.checked })} />
          Flowers
        </label>
      </div>

      <h3 className="section-title">Stem body</h3>

      <Slider
        label="Stem Width"
        value={state.stemWidthMm}
        min={0.3}
        max={8}
        step={0.1}
        onChange={(v) => update({ stemWidthMm: v })}
        format={(v) => `${v}mm`}
      />

      <div className="control-group">
        <label className="label-text">Fill</label>
        <select value={state.stemFill} onChange={(e) => update({ stemFill: e.target.value as BotanicalState['stemFill'] })}>
          <option value="shaded">Shaded tube (botanical)</option>
          <option value="solid">Solid</option>
          <option value="outline">Hollow outline</option>
          <option value="highlight">Solid + highlight</option>
        </select>
      </div>

      {state.leaves && (
        <>
          <div className="control-group">
            <label className="label-text">Leaf style</label>
            <select value={state.leafStyle} onChange={(e) => update({ leafStyle: e.target.value as BotanicalState['leafStyle'] })}>
              <option value="shaded">Shaded (veins + form)</option>
              <option value="veined">Outline + veins</option>
              <option value="outline">Outline only</option>
              <option value="solid">Solid</option>
            </select>
          </div>
          <div className="control-group">
            <label className="label-text">Leaf type</label>
            <select value={state.leafType} onChange={(e) => update({ leafType: e.target.value as BotanicalState['leafType'] })}>
              <option value="ovate">Ovate</option>
              <option value="lance">Lance</option>
              <option value="cordate">Cordate (heart)</option>
              <option value="lobed">Lobed</option>
              <option value="serrate">Serrated</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div className="control-group">
            <label className="label-text">Leaf arrangement</label>
            <select value={state.leafArrangement} onChange={(e) => update({ leafArrangement: e.target.value as BotanicalState['leafArrangement'] })}>
              <option value="simple">Simple (one blade)</option>
              <option value="pinnate">Pinnate (leaflets on a rachis)</option>
              <option value="bipinnate">Bipinnate (fern frond)</option>
              <option value="palmate">Palmate (radiating)</option>
              <option value="trifoliate">Trifoliate (three)</option>
            </select>
          </div>
          {state.leafArrangement !== 'simple' && state.leafArrangement !== 'trifoliate' && (
            <Slider
              label="Leaflets"
              value={state.leafletCount}
              min={3}
              max={11}
              step={1}
              onChange={(v) => update({ leafletCount: Math.round(v) })}
            />
          )}
          <div className="control-group">
            <label className="label-text">Phyllotaxis</label>
            <select value={state.phyllotaxis} onChange={(e) => update({ phyllotaxis: e.target.value as BotanicalState['phyllotaxis'] })}>
              <option value="alternate">Alternate</option>
              <option value="opposite">Opposite (pairs)</option>
              <option value="whorled">Whorled (ring)</option>
              <option value="spiral">Spiral (golden angle)</option>
            </select>
          </div>
          {state.phyllotaxis === 'whorled' && (
            <Slider
              label="Leaves per node"
              value={state.whorlCount}
              min={2}
              max={6}
              step={1}
              onChange={(v) => update({ whorlCount: Math.round(v) })}
            />
          )}
          <label className="checkbox-label">
            <input type="checkbox" checked={state.veins} onChange={(e) => update({ veins: e.target.checked })} />
            Veins
          </label>
        </>
      )}

      {state.flowers && (
        <>
          <div className="control-group">
            <label className="label-text">Flower type</label>
            <select value={state.flowerType} onChange={(e) => update({ flowerType: e.target.value as BotanicalState['flowerType'] })}>
              <option value="rose">Rose (5-petal)</option>
              <option value="daisy">Daisy (composite)</option>
              <option value="bell">Bell</option>
              <option value="bud">Bud</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div className="control-group">
            <label className="label-text">Inflorescence</label>
            <select value={state.inflorescence} onChange={(e) => update({ inflorescence: e.target.value as BotanicalState['inflorescence'] })}>
              <option value="none">Single bloom</option>
              <option value="raceme">Raceme (hanging spike)</option>
              <option value="umbel">Umbel (radiating)</option>
              <option value="spike">Spike (stalkless)</option>
              <option value="corymb">Corymb (flat-topped)</option>
            </select>
          </div>
          {state.inflorescence !== 'none' && (
            <Slider
              label="Florets"
              value={state.floretCount}
              min={3}
              max={16}
              step={1}
              onChange={(v) => update({ floretCount: Math.round(v) })}
            />
          )}
        </>
      )}

      <div className="control-group">
        <label className="label-text">Fruit</label>
        <select value={state.fruitType} onChange={(e) => update({ fruitType: e.target.value as BotanicalState['fruitType'] })}>
          <option value="none">None</option>
          <option value="berry">Berries</option>
          <option value="grape">Grapes</option>
          <option value="rosehip">Rosehips</option>
          <option value="pod">Pods</option>
          <option value="catkin">Catkins</option>
        </select>
      </div>
      {state.fruitType !== 'none' && (
        <Slider
          label="Fruit frequency"
          value={state.fruitProb}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ fruitProb: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      )}
      <label className="checkbox-label">
        <input type="checkbox" checked={state.thorns} onChange={(e) => update({ thorns: e.target.checked })} />
        Thorns
      </label>
      {state.thorns && (
        <Slider
          label="Thorn density"
          value={state.thornProb}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ thornProb: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      )}
      <label className="checkbox-label">
        <input type="checkbox" checked={state.dewdrops} onChange={(e) => update({ dewdrops: e.target.checked })} />
        Dewdrops
      </label>
      {state.dewdrops && (
        <Slider
          label="Dewdrop frequency"
          value={state.dewdropProb}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ dewdropProb: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      )}

      <h3 className="section-title">Form &amp; light</h3>

      <div className="control-group">
        <label className="label-text">Tube shading</label>
        <select value={state.stemShade} onChange={(e) => update({ stemShade: e.target.value as BotanicalState['stemShade'] })}>
          <option value="along">Along the stem</option>
          <option value="cross">Cross-hatch</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="control-group">
        <label className="label-text">Stem texture</label>
        <select value={state.stemTexture} onChange={(e) => update({ stemTexture: e.target.value as BotanicalState['stemTexture'] })}>
          <option value="none">Smooth</option>
          <option value="bark">Bark (woody)</option>
        </select>
        <p className="paint-hint">Broken striations on thick canes — old wood reads differently from new growth.</p>
      </div>

      <Slider
        label="Light Angle"
        value={state.lightAngle}
        min={-180}
        max={180}
        step={5}
        onChange={(v) => update({ lightAngle: v })}
        format={(v) => `${v}°`}
      />
      <Slider
        label="Shading"
        value={state.shadeDensity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ shadeDensity: v })}
        format={(v) => v.toFixed(2)}
      />
      <div className="control-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={state.occlude} onChange={(e) => update({ occlude: e.target.checked })} />
          Solid overlap (hide covered lines)
        </label>
        <p className="paint-hint">Elements are opaque — those in front hide whatever they cover.</p>
      </div>
      {state.occlude && (
        <Slider
          label="Cast Shadow"
          value={state.castShadow}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ castShadow: v })}
          format={(v) => v.toFixed(2)}
        />
      )}
      <div className="control-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={state.avoidOverlap} onChange={(e) => update({ avoidOverlap: e.target.checked })} />
          Avoid overlap (growth)
        </label>
        <p className="paint-hint">Stems stop short of geometry they'd grow into.</p>
      </div>
      <Slider
        label="Sketchiness"
        value={state.sketch}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ sketch: v })}
        format={(v) => v.toFixed(2)}
      />
      {state.sketch > 0 && (
        <div className="control-group">
          <label className="label-text">Sketch style</label>
          <select value={state.sketchStyle} onChange={(e) => update({ sketchStyle: e.target.value as BotanicalState['sketchStyle'] })}>
            <option value="loose">Loose</option>
            <option value="fine">Fine</option>
            <option value="gestural">Gestural</option>
            <option value="scratchy">Scratchy</option>
          </select>
        </div>
      )}

      <h3 className="section-title">Style</h3>

      <div className="control-group">
        <label className="label-text">Palette</label>
        <select value={state.palette} onChange={(e) => update({ palette: e.target.value })}>
          {BOTANICAL_PALETTES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
          <option value={CUSTOM_PALETTE}>Custom…</option>
        </select>
      </div>

      {state.palette === CUSTOM_PALETTE && (
        <>
          <ColorField label="Stem / tendril ink" value={state.strokeColor} onChange={(strokeColor) => update({ strokeColor })} />
          {state.leaves && (
            <ColorField label="Leaf ink" value={state.leafColor} onChange={(leafColor) => update({ leafColor })} />
          )}
          {state.flowers && (
            <ColorField label="Flower ink" value={state.flowerColor} onChange={(flowerColor) => update({ flowerColor })} />
          )}
        </>
      )}

      <Slider
        label="Pen Width"
        value={state.penWidthMm}
        min={0.1}
        max={1.5}
        step={0.05}
        onChange={(v) => update({ penWidthMm: v })}
        format={(v) => `${v}mm`}
      />

      <h3 className="section-title">Seed</h3>
      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <AdvancedSection>
        <AdvGroup title="Climbing growth" open={state.mode === 'growth'}>
          <Slider label="Step Length" value={state.stepLengthMm} min={0.5} max={6} step={0.5} onChange={(v) => update({ stepLengthMm: v })} format={(v) => `${v}mm`} />
          <Slider label="Max Length" value={state.maxLengthMm} min={20} max={300} step={5} onChange={(v) => update({ maxLengthMm: v })} format={(v) => `${v}mm`} />
          <Slider label="Curl" value={state.curl} min={0} max={1.5} step={0.05} onChange={(v) => update({ curl: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Noise Scale" value={state.noiseScale} min={0.001} max={0.02} step={0.001} onChange={(v) => update({ noiseScale: v })} format={(v) => v.toFixed(3)} />
          <Slider label="Climb (gravitropism)" value={state.gravitropism} min={0} max={1} step={0.05} onChange={(v) => update({ gravitropism: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Branchiness" value={state.branchProb} min={0} max={0.2} step={0.005} onChange={(v) => update({ branchProb: v })} format={(v) => v.toFixed(3)} />
          <Slider label="Max Branch Depth" value={state.maxDepth} min={0} max={8} step={1} onChange={(v) => update({ maxDepth: v })} />
        </AdvGroup>

        <AdvGroup title="Colonization" open={state.mode === 'colonization'}>
          <Slider label="Attractors" value={state.attractorCount} min={50} max={1500} step={50} onChange={(v) => update({ attractorCount: v })} />
          <Slider label="Reach" value={state.attractorRadiusMm} min={5} max={80} step={1} onChange={(v) => update({ attractorRadiusMm: v })} format={(v) => `${v}mm`} />
          <Slider label="Kill Radius" value={state.killRadiusMm} min={1} max={20} step={0.5} onChange={(v) => update({ killRadiusMm: v })} format={(v) => `${v}mm`} />
        </AdvGroup>

        <AdvGroup title="Stem taper">
          <Slider label="Taper" value={state.taper} min={0} max={1} step={0.05} onChange={(v) => update({ taper: v })} format={(v) => v.toFixed(2)} />
        </AdvGroup>

        <AdvGroup title="Decoration detail">
          <Slider label="Leaf Size" value={state.leafSizeMm} min={1} max={20} step={0.5} onChange={(v) => update({ leafSizeMm: v })} format={(v) => `${v}mm`} />
          <Slider label="Leaf Width" value={state.leafWidthRatio} min={0.2} max={1} step={0.05} onChange={(v) => update({ leafWidthRatio: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Leaf Spacing" value={state.leafSpacingMm} min={2} max={30} step={1} onChange={(v) => update({ leafSpacingMm: v })} format={(v) => `${v}mm`} />
          <Slider label="Tendril Chance" value={state.tendrilProb} min={0} max={1} step={0.05} onChange={(v) => update({ tendrilProb: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Flower Chance" value={state.flowerProb} min={0} max={1} step={0.05} onChange={(v) => update({ flowerProb: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Flower Size" value={state.flowerSizeMm} min={1} max={15} step={0.5} onChange={(v) => update({ flowerSizeMm: v })} format={(v) => `${v}mm`} />
        </AdvGroup>

        <AdvGroup title="Hand">
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={2} step={0.05} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v}mm`} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
