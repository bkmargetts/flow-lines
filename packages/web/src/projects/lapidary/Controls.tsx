import type {
  LapidaryMode,
  LapidaryShapes,
  LapidaryValueRhythm,
  PenAssignment,
  SpiralDirection,
  SpiralForm,
  SpiralJoin,
} from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { CUSTOM_PALETTE, LAPIDARY_PALETTES, randomLapidaryPalette } from './palettes';
import { LAPIDARY_WEB_PRESETS, getLapidaryPreset, randomLapidaryGenome } from './presets';
import { resolveLapidaryInks, resolveLapidaryVein } from './render';
import type { LapidaryState, LapidaryTextureMix } from './types';

const PRESET_LABELS = Object.fromEntries(
  LAPIDARY_WEB_PRESETS.map((p) => [p.id, p.label])
) as Record<string, string>;

const PALETTE_LABELS = {
  ...(Object.fromEntries(
    LAPIDARY_PALETTES.map((p) => [
      p.id,
      `${p.label} (${p.inks.length} pen${p.inks.length > 1 ? 's' : ''})`,
    ])
  ) as Record<string, string>),
  [CUSTOM_PALETTE]: 'Custom…',
};

const MIX_LABELS: Record<LapidaryTextureMix, string> = {
  specimen: 'Specimen (lines · wavy · mottle · hatch)',
  geode: 'Geode (cross · stipple · paper band)',
  fortification: 'Fortification (concentric banding)',
  facet: 'Facet (hatch · lines · cross)',
  ammonite: 'Ammonite (contour-led lamination)',
  linework: 'Linework (lines & waves only)',
  tonal: 'Tonal (hatch · mottle · stipple)',
  shuffle: 'Shuffle (seeded deal)',
};

/**
 * Sidebar controls for Lapidary, laid out the scene-generator way: flat named
 * sections (Stone → Marks → Ink) with mode-dependent knobs shown only when
 * their mode is active — a strata sheet never shows the coverage/centre knobs
 * it ignores, breccia is the only place the kintsugi controls appear — and
 * one Advanced drawer at the end for the fine texture/pen tuning.
 */
export function LapidaryControls({ state, update }: ControlsProps<LapidaryState>) {
  const selectPreset = (id: string) => {
    // Only real preset ids restore anything; 'custom' is a label, not a look.
    const preset = getLapidaryPreset(id);
    if (preset) update({ ...preset.state, preset: preset.id });
  };

  const inks = resolveLapidaryInks(state);
  const vein = resolveLapidaryVein(state);
  const custom = state.palette === CUSTOM_PALETTE;

  // Editing any ink of a named palette forks to 'custom', pre-filled with the
  // palette's own colours so only the touched pen changes.
  const goCustom = (patch: Partial<LapidaryState>) =>
    update({
      palette: CUSTOM_PALETTE,
      pens: inks.length,
      strokeColor: inks[0],
      ink2Color: inks[1] ?? inks[0],
      ink3Color: inks[2] ?? inks[inks.length - 1],
      ink4Color: inks[3] ?? inks[inks.length - 1],
      veinColor: vein,
      ...patch,
    });

  const inventPalette = () => {
    const pal = randomLapidaryPalette(Math.random);
    update({
      palette: CUSTOM_PALETTE,
      pens: pal.inks.length,
      strokeColor: pal.inks[0],
      ink2Color: pal.inks[1] ?? pal.inks[0],
      ink3Color: pal.inks[2] ?? pal.inks[pal.inks.length - 1],
      ink4Color: pal.inks[3] ?? pal.inks[pal.inks.length - 1],
      veinColor: pal.vein,
    });
  };

  const strata = state.mode === 'strata';
  const breccia = state.mode === 'breccia';
  const spiral = state.mode === 'spiral';

  return (
    <div className="controls">
      <RandomiseButton
        onClick={() => update({ ...randomLapidaryGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a whole new specimen — or tune anything below."
      />

      <h3 className="section-title">Stone</h3>

      <PresetPicker
        label="Look"
        info="A curated arrangement + texture deal. Seed, pen width and custom inks survive a switch."
        labels={state.preset === 'custom' ? { ...PRESET_LABELS, custom: 'Custom' } : PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <label className="field">
        <span>Arrangement</span>
        <select
          value={state.mode}
          onChange={(e) => update({ mode: e.target.value as LapidaryMode })}
        >
          <option value="agate">Agate — concentric bands</option>
          <option value="breccia">Breccia — scattered fragments</option>
          <option value="strata">Strata — horizontal beds</option>
          <option value="spiral">Spiral — winding ribbon</option>
        </select>
      </label>

      <label className="field">
        <span>Shapes</span>
        <select
          value={state.shapes}
          onChange={(e) => update({ shapes: e.target.value as LapidaryShapes })}
        >
          <option value="organic">Organic blobs</option>
          <option value="angular">Angular facets</option>
          <option value="mixed">Mixed (seeded deal)</option>
        </select>
      </label>

      <Slider label={spiral ? 'Turns' : 'Bands'} value={state.bands} min={2} max={10} step={1} onChange={(v) => update({ bands: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Irregularity" value={state.irregularity} min={0} max={1} step={0.01} onChange={(v) => update({ irregularity: v })} format={(v) => `${Math.round(v * 100)}%`} />
      {!strata && (
        <>
          <Slider label="Coverage" value={state.coverage} min={0.4} max={1} step={0.01} onChange={(v) => update({ coverage: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Toggle label="Background field" checked={state.field} onChange={(v) => update({ field: v })} />
        </>
      )}
      {strata && (
        <Slider label="Faults" value={state.faults} min={0} max={4} step={1} onChange={(v) => update({ faults: v })} format={(v) => `${Math.round(v)}`} />
      )}
      {spiral && (
        <>
          <label className="field">
            <span>Spiral form</span>
            <select
              value={state.spiralForm}
              onChange={(e) => update({ spiralForm: e.target.value as SpiralForm })}
            >
              <option value="circular">Circular coil</option>
              <option value="rectangular">Rectangular coil</option>
              <option value="page">Page — full-bleed, the sheet is the coil</option>
            </select>
          </label>
          <label className="field">
            <span>Direction</span>
            <select
              value={state.spiralDirection}
              onChange={(e) => update({ spiralDirection: e.target.value as SpiralDirection })}
            >
              <option value="inward">Inward — winds to the centre</option>
              <option value="outward">Outward — unwinds from it</option>
            </select>
          </label>
          <label className="field">
            <span>Pattern join</span>
            <select
              value={state.spiralJoin}
              onChange={(e) => update({ spiralJoin: e.target.value as SpiralJoin })}
            >
              <option value="cells">Subdivided — carved seams</option>
              <option value="blend">Blended — patterns morph</option>
            </select>
          </label>
          <Slider label="Ribbon width" value={state.spiralWidth} min={0.15} max={1} step={0.01} onChange={(v) => update({ spiralWidth: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Taper" value={state.spiralTaper} min={-1} max={1} step={0.01} onChange={(v) => update({ spiralTaper: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Width pulse" value={state.spiralPulse} min={0} max={1} step={0.01} onChange={(v) => update({ spiralPulse: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </>
      )}

      <h3 className="section-title">Value</h3>

      <Slider
        label="Value structure"
        value={state.valueStructure}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ valueStructure: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <label className="field">
        <span>Tonal rhythm</span>
        <select
          value={state.valueRhythm}
          onChange={(e) => update({ valueRhythm: e.target.value as LapidaryValueRhythm })}
        >
          <option value="auto">Auto — seeded pick</option>
          <option value="dark-core">Dark core — weight sinks to the centre</option>
          <option value="dark-rim">Dark rim — a vignette</option>
          <option value="alternating">Alternating — banded agate</option>
          <option value="ramp">Ramp — light walks to dark</option>
          <option value="flat">Flat — no ladder</option>
        </select>
      </label>
      <Toggle
        label="Hold a paper band"
        checked={state.paperBand}
        onChange={(v) => update({ paperBand: v })}
      />
      <Slider label="Band gradation" value={state.gradation} min={0} max={1} step={0.01} onChange={(v) => update({ gradation: v })} format={(v) => `${Math.round(v * 100)}%`} />

      <h3 className="section-title">Marks</h3>

      <label className="field">
        <span>Textures</span>
        <select
          value={state.textureMix}
          onChange={(e) => update({ textureMix: e.target.value as LapidaryTextureMix })}
        >
          {Object.entries(MIX_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <Slider label="Line pitch" value={state.spacingMm} min={0.6} max={3} step={0.1} onChange={(v) => update({ spacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Seam width" value={state.haloMm} min={0.8} max={5} step={0.1} onChange={(v) => update({ haloMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Toggle label="Ink region outlines" checked={state.outlines} onChange={(v) => update({ outlines: v })} />
      {state.outlines && (
        <Slider label="Keyline weight" value={state.outlineWeight} min={0} max={1} step={0.01} onChange={(v) => update({ outlineWeight: v })} format={(v) => `${Math.round(v * 100)}%`} />
      )}
      {breccia && (
        <Toggle label="Kintsugi veins" checked={state.veins} onChange={(v) => update({ veins: v })} />
      )}

      <h3 className="section-title">Ink</h3>

      <PresetPicker
        label="Palette"
        info="A named pen set — the palette carries the pen count and the vein accent. Pick Custom (or edit any ink) to mix your own."
        labels={PALETTE_LABELS}
        value={state.palette}
        onChange={(id) => (id === CUSTOM_PALETTE && !custom ? goCustom({}) : update({ palette: id }))}
      />
      <div className="control-group">
        <button
          type="button"
          className="secondary"
          style={{ width: '100%' }}
          onClick={inventPalette}
          title="Deal a brand-new pen set — seeded ink-plausible colours, not from the named list"
        >
          🎨 Invent a palette
        </button>
      </div>
      {custom && (
        <Slider label="Pens" value={state.pens} min={1} max={4} step={1} onChange={(v) => update({ pens: v })} format={(v) => `${Math.round(v)}`} />
      )}
      {(['strokeColor', 'ink2Color', 'ink3Color', 'ink4Color'] as const)
        .slice(0, inks.length)
        .map((field, i) => (
          <ColorField
            key={field}
            label={inks.length > 1 ? `Pen ${i + 1}` : 'Ink'}
            value={inks[i]}
            onChange={(v) => (custom ? update({ [field]: v }) : goCustom({ [field]: v }))}
          />
        ))}
      {breccia && state.veins && (
        <ColorField
          label="Vein ink"
          value={vein}
          onChange={(v) => (custom ? update({ veinColor: v }) : goCustom({ veinColor: v }))}
        />
      )}
      {inks.length > 1 && (
        <label className="field">
          <span>Pen assignment</span>
          <select
            value={state.penAssignment}
            onChange={(e) => update({ penAssignment: e.target.value as PenAssignment })}
          >
            <option value="interleave">Interleave strokes</option>
            <option value="per-region">One pen per region</option>
          </select>
        </label>
      )}

      <AdvancedSection>
        {!strata && (
          <AdvGroup title="Composition">
            <Slider label="Centre X" value={state.centerX} min={-0.5} max={0.5} step={0.01} onChange={(v) => update({ centerX: v })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Centre Y" value={state.centerY} min={-0.5} max={0.5} step={0.01} onChange={(v) => update({ centerY: v })} format={(v) => `${Math.round(v * 100)}%`} />
          </AdvGroup>
        )}

        <AdvGroup title="Texture detail">
          <Slider label="Angle" value={state.angleDeg} min={0} max={180} step={1} onChange={(v) => update({ angleDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Angle drift" value={state.angleDriftDeg} min={0} max={60} step={1} onChange={(v) => update({ angleDriftDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Angle quantum" value={state.angleQuantumDeg} min={0} max={45} step={1} onChange={(v) => update({ angleQuantumDeg: v })} format={(v) => (v > 0 ? `${Math.round(v)}°` : 'free')} />
          <Slider label="Density contrast" value={state.densityContrast} min={0} max={1} step={0.01} onChange={(v) => update({ densityContrast: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Waviness" value={state.waviness} min={0} max={1} step={0.01} onChange={(v) => update({ waviness: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Patchiness" value={state.patchiness} min={0} max={1} step={0.01} onChange={(v) => update({ patchiness: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.05} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          {inks.length > 1 && (
            <Slider label="Misregistration" value={state.misregistration} min={0} max={1} step={0.01} onChange={(v) => update({ misregistration: v })} format={(v) => `${Math.round(v * 100)}%`} />
          )}
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
