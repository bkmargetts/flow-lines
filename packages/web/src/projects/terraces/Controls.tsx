import type { LapidarySheetTone, LapidaryToneShape, PenAssignment } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { CUSTOM_PALETTE, LAPIDARY_PALETTES, randomLapidaryPalette } from '../lapidary/palettes';
import { TERRACES_WEB_PRESETS, getTerracesPreset, randomTerracesGenome } from './presets';
import { resolveTerracesInks } from './render';
import type { TerracesLineFlow, TerracesState, TerracesTextureMix } from './types';

const PRESET_LABELS = Object.fromEntries(
  TERRACES_WEB_PRESETS.map((p) => [p.id, p.label])
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

const MIX_LABELS: Record<TerracesTextureMix, string> = {
  fortification: 'Fortification (contour lamination)',
  linework: 'Linework (lines & waves only)',
  tonal: 'Tonal (hatch · mottle · stipple)',
  shuffle: 'Shuffle (seeded deal)',
};

/**
 * Sidebar controls for Terraces, laid out the lapidary way: flat named
 * sections (Strata → Faults → Marks → Ink) and one Advanced drawer at the
 * end for the fine texture/pen tuning.
 */
export function TerracesControls({ state, update }: ControlsProps<TerracesState>) {
  const selectPreset = (id: string) => {
    // Only real preset ids restore anything; 'custom' is a label, not a look.
    const preset = getTerracesPreset(id);
    if (preset) update({ ...preset.state, preset: preset.id });
  };

  const inks = resolveTerracesInks(state);
  const custom = state.palette === CUSTOM_PALETTE;

  // Editing any ink of a named palette forks to 'custom', pre-filled with the
  // palette's own colours so only the touched pen changes.
  const goCustom = (patch: Partial<TerracesState>) =>
    update({
      palette: CUSTOM_PALETTE,
      pens: inks.length,
      strokeColor: inks[0],
      ink2Color: inks[1] ?? inks[0],
      ink3Color: inks[2] ?? inks[inks.length - 1],
      ink4Color: inks[3] ?? inks[inks.length - 1],
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
    });
  };

  return (
    <div className="controls">
      <RandomiseButton
        onClick={() => update({ ...randomTerracesGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a whole new cross-section — or tune anything below."
      />

      <h3 className="section-title">Strata</h3>

      <PresetPicker
        label="Look"
        info="A curated bed stack + fault deal. Seed, pen width and custom inks survive a switch."
        labels={state.preset === 'custom' ? { ...PRESET_LABELS, custom: 'Custom' } : PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <Slider label="Beds" value={state.bands} min={2} max={10} step={1} onChange={(v) => update({ bands: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Irregularity" value={state.irregularity} min={0} max={1} step={0.01} onChange={(v) => update({ irregularity: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Stepped terraces" value={state.steppiness} min={0} max={1} step={0.01} onChange={(v) => update({ steppiness: v })} format={(v) => `${Math.round(v * 100)}%`} />

      <h3 className="section-title">Faults</h3>

      <Slider label="Faults" value={state.faults} min={0} max={6} step={1} onChange={(v) => update({ faults: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Throw" value={state.faultThrow} min={0} max={2} step={0.01} onChange={(v) => update({ faultThrow: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.faults === 0} />
      <Slider label="Incline" value={state.faultIncline} min={-1} max={1} step={0.01} onChange={(v) => update({ faultIncline: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.faults === 0} />

      <h3 className="section-title">Marks</h3>

      <label className="field">
        <span>Textures</span>
        <select
          value={state.textureMix}
          onChange={(e) => update({ textureMix: e.target.value as TerracesTextureMix })}
        >
          {Object.entries(MIX_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Line breaks</span>
        <select
          value={state.lineFlow}
          onChange={(e) => update({ lineFlow: e.target.value as TerracesLineFlow })}
        >
          <option value="broken">Broken — hand-fed dashes</option>
          <option value="flowing">Continuous — unbroken flowing lines</option>
          <option value="mixed">Mixed — dealt per bed</option>
        </select>
      </label>
      <Slider label="Line pitch" value={state.spacingMm} min={0.6} max={3} step={0.1} onChange={(v) => update({ spacingMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Seam width" value={state.haloMm} min={0.8} max={5} step={0.1} onChange={(v) => update({ haloMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <label className="field">
        <span>Shading</span>
        <select
          value={state.toneShape}
          onChange={(e) => update({ toneShape: e.target.value as LapidaryToneShape })}
        >
          <option value="seam">Seam — dark against the bed walls</option>
          <option value="core">Core — dark toward each centre</option>
          <option value="light">Light — one lit flank per bed</option>
          <option value="noise">Clouds — noisy tonal drift</option>
          <option value="none">Flat — constant pitch</option>
        </select>
      </label>
      <Slider label="Shading strength" value={state.toneStrength} min={0} max={1} step={0.01} onChange={(v) => update({ toneStrength: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.toneShape === 'none'} />
      <label className="field">
        <span>Sheet light</span>
        <select
          value={state.sheetTone}
          onChange={(e) => update({ sheetTone: e.target.value as LapidarySheetTone })}
        >
          <option value="none">None — each bed its own relief</option>
          <option value="light">Lit from one side</option>
          <option value="vignette">Vignette — bright centre, dark rim</option>
        </select>
      </label>
      <Slider label="Sheet light strength" value={state.sheetToneStrength} min={0} max={1} step={0.01} onChange={(v) => update({ sheetToneStrength: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.sheetTone === 'none'} />
      {(state.toneShape === 'light' || state.sheetTone === 'light') && (
        <Slider label="Light angle" value={state.lightAngleDeg} min={-180} max={180} step={1} onChange={(v) => update({ lightAngleDeg: v })} format={(v) => `${Math.round(v)}°`} />
      )}
      <Toggle label="Ink bed outlines" checked={state.outlines} onChange={(v) => update({ outlines: v })} />
      {state.outlines && (
        <Slider label="Outline weight" value={state.outlineEmphasis} min={1} max={3} step={1} onChange={(v) => update({ outlineEmphasis: v })} format={(v) => `${Math.round(v)} pass${Math.round(v) > 1 ? 'es' : ''}`} />
      )}

      <h3 className="section-title">Ink</h3>

      <PresetPicker
        label="Palette"
        info="A named pen set — the palette carries the pen count. Pick Custom (or edit any ink) to mix your own."
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
      {inks.length > 1 && (
        <label className="field">
          <span>Pen assignment</span>
          <select
            value={state.penAssignment}
            onChange={(e) => update({ penAssignment: e.target.value as PenAssignment })}
          >
            <option value="interleave">Interleave strokes</option>
            <option value="per-region">One pen per bed</option>
          </select>
        </label>
      )}

      <AdvancedSection>
        <AdvGroup title="Texture detail">
          <Slider label="Angle" value={state.angleDeg} min={0} max={180} step={1} onChange={(v) => update({ angleDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Angle drift" value={state.angleDriftDeg} min={0} max={60} step={1} onChange={(v) => update({ angleDriftDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Density contrast" value={state.densityContrast} min={0} max={1} step={0.01} onChange={(v) => update({ densityContrast: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Waviness" value={state.waviness} min={0} max={1} step={0.01} onChange={(v) => update({ waviness: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Patchiness" value={state.patchiness} min={0} max={1} step={0.01} onChange={(v) => update({ patchiness: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="End taper" value={state.taper} min={0} max={1} step={0.01} onChange={(v) => update({ taper: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Stroke jitter" value={state.jitterDeg} min={0} max={3} step={0.1} onChange={(v) => update({ jitterDeg: v })} format={(v) => `${v.toFixed(1)}°`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.05} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
