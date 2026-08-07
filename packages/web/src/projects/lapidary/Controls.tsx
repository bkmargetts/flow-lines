import type { LapidaryMode, LapidaryShapes, PenAssignment } from '@flow-lines/core';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { PresetPicker } from '../../components/controls/PresetPicker';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { Toggle } from '../../components/controls/Toggle';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import { CUSTOM_PALETTE, LAPIDARY_PALETTES } from './palettes';
import { LAPIDARY_WEB_PRESETS, getLapidaryPreset, randomLapidaryGenome } from './presets';
import { resolveLapidaryInks } from './render';
import type { LapidaryState, LapidaryTextureMix } from './types';

const PRESET_LABELS = Object.fromEntries(
  LAPIDARY_WEB_PRESETS.map((p) => [p.id, p.label])
) as Record<string, string>;

const MIX_LABELS: Record<LapidaryTextureMix, string> = {
  specimen: 'Specimen (lines · wavy · mottle · hatch)',
  geode: 'Geode (cross · stipple · paper band)',
  fortification: 'Fortification (concentric banding)',
  facet: 'Facet (hatch · lines · cross)',
  linework: 'Linework (lines & waves only)',
  tonal: 'Tonal (hatch · mottle · stipple)',
  shuffle: 'Shuffle (seeded deal)',
};

/** Sidebar controls for Lapidary. The arrangement (mode, bands, shape) is
 *  the identity; texture and seam knobs follow; per-band fine-tuning and the
 *  pen kit live in Advanced. */
export function LapidaryControls({ state, update }: ControlsProps<LapidaryState>) {
  const selectPreset = (id: string) => {
    const preset = getLapidaryPreset(id);
    update(preset ? { ...preset.state, preset: id } : { preset: id });
  };

  const inks = resolveLapidaryInks(state);
  const custom = state.palette === CUSTOM_PALETTE;

  return (
    <div className="controls">
      <h3 className="section-title">Lapidary</h3>

      <RandomiseButton
        onClick={() => update({ ...randomLapidaryGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a whole new specimen — or tune anything below."
      />

      <PresetPicker
        label="Look"
        info="A curated arrangement + texture deal. Seed, pen width and custom inks survive a switch."
        labels={PRESET_LABELS}
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

      <Toggle
        label="Background field"
        checked={state.field}
        onChange={(v) => update({ field: v })}
        disabled={state.mode === 'strata'}
      />

      <Slider label="Bands" value={state.bands} min={2} max={10} step={1} onChange={(v) => update({ bands: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Irregularity" value={state.irregularity} min={0} max={1} step={0.01} onChange={(v) => update({ irregularity: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Coverage" value={state.coverage} min={0.4} max={1} step={0.01} onChange={(v) => update({ coverage: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.mode === 'strata'} />
      <Slider label="Seam width" value={state.haloMm} min={0.8} max={5} step={0.1} onChange={(v) => update({ haloMm: v })} format={(v) => `${v.toFixed(1)}mm`} />

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

      <AdvancedSection>
        <AdvGroup title="Composition">
          <Slider label="Centre X" value={state.centerX} min={-0.5} max={0.5} step={0.01} onChange={(v) => update({ centerX: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.mode === 'strata'} />
          <Slider label="Centre Y" value={state.centerY} min={-0.5} max={0.5} step={0.01} onChange={(v) => update({ centerY: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.mode === 'strata'} />
        </AdvGroup>

        <AdvGroup title="Texture detail">
          <Slider label="Angle" value={state.angleDeg} min={0} max={180} step={1} onChange={(v) => update({ angleDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Angle drift" value={state.angleDriftDeg} min={0} max={60} step={1} onChange={(v) => update({ angleDriftDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Density contrast" value={state.densityContrast} min={0} max={1} step={0.01} onChange={(v) => update({ densityContrast: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Waviness" value={state.waviness} min={0} max={1} step={0.01} onChange={(v) => update({ waviness: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Patchiness" value={state.patchiness} min={0} max={1} step={0.01} onChange={(v) => update({ patchiness: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </AdvGroup>

        <AdvGroup title="Seams & pens">
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
          <Toggle label="Ink region outlines" checked={state.outlines} onChange={(v) => update({ outlines: v })} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.05} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>
      </AdvancedSection>

      <h3 className="section-title">Ink</h3>
      <label className="field">
        <span>Palette</span>
        <select value={state.palette} onChange={(e) => update({ palette: e.target.value })}>
          {LAPIDARY_PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.inks.length} pen{p.inks.length > 1 ? 's' : ''})
            </option>
          ))}
          <option value={CUSTOM_PALETTE}>Custom</option>
        </select>
      </label>
      {custom && (
        <>
          <Slider label="Pens" value={state.pens} min={1} max={4} step={1} onChange={(v) => update({ pens: v })} format={(v) => `${Math.round(v)}`} />
          <ColorField label={inks.length > 1 ? 'Pen 1' : 'Ink'} value={state.strokeColor} onChange={(v) => update({ strokeColor: v })} />
          {inks.length > 1 && (
            <ColorField label="Pen 2" value={state.ink2Color} onChange={(v) => update({ ink2Color: v })} />
          )}
          {inks.length > 2 && (
            <ColorField label="Pen 3" value={state.ink3Color} onChange={(v) => update({ ink3Color: v })} />
          )}
          {inks.length > 3 && (
            <ColorField label="Pen 4" value={state.ink4Color} onChange={(v) => update({ ink4Color: v })} />
          )}
        </>
      )}
    </div>
  );
}
