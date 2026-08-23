import type { PenAssignment } from '@flow-lines/core';
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
import {
  LIFE_TERRACES_WEB_PRESETS,
  getLifeTerracesPreset,
  randomLifeTerracesGenome,
} from './presets';
import { resolveLifeTerracesInks } from './render';
import type { LifeTerracesState } from './types';

const PRESET_LABELS = Object.fromEntries(
  LIFE_TERRACES_WEB_PRESETS.map((p) => [p.id, p.label])
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

/**
 * Sidebar controls for Life Terraces: Simulation → Terraces → Laminae → Ink,
 * with the present's tuning and pen finish in the Advanced drawer.
 */
export function LifeTerracesControls({ state, update }: ControlsProps<LifeTerracesState>) {
  const selectPreset = (id: string) => {
    // Only real preset ids restore anything; 'custom' is a label, not a look.
    const preset = getLifeTerracesPreset(id);
    if (preset) update({ ...preset.state, preset: preset.id });
  };

  const inks = resolveLifeTerracesInks(state);
  const custom = state.palette === CUSTOM_PALETTE;

  // Editing any ink of a named palette forks to 'custom', pre-filled with the
  // palette's own colours so only the touched pen changes.
  const goCustom = (patch: Partial<LifeTerracesState>) =>
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
        onClick={() => update({ ...randomLifeTerracesGenome(Math.random), seed: randomSeed() })}
        hint="One roll for a whole new terraced exposure — or tune anything below."
      />

      <h3 className="section-title">Simulation</h3>

      <PresetPicker
        label="Look"
        info="A curated sim + terrace deal. Seed, pen width and custom inks survive a switch."
        labels={state.preset === 'custom' ? { ...PRESET_LABELS, custom: 'Custom' } : PRESET_LABELS}
        value={state.preset}
        onChange={selectPreset}
      />

      <SeedControl seed={state.seed} onChange={(seed) => update({ seed })} />

      <Slider label="Detonations" value={state.seedCount} min={1} max={8} step={1} onChange={(v) => update({ seedCount: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Generations" value={state.generations} min={100} max={800} step={10} onChange={(v) => update({ generations: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Memory" value={state.decay} min={0.8} max={0.99} step={0.01} onChange={(v) => update({ decay: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Cell size" value={state.cellSizeMm} min={1} max={4} step={0.1} onChange={(v) => update({ cellSizeMm: v })} format={(v) => `${v.toFixed(1)}mm`} />

      <h3 className="section-title">Terraces</h3>

      <Slider label="Levels" value={state.levels} min={2} max={8} step={1} onChange={(v) => update({ levels: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Seam width" value={state.seamMm} min={0.3} max={3} step={0.1} onChange={(v) => update({ seamMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
      <Slider label="Faults" value={state.faults} min={0} max={4} step={1} onChange={(v) => update({ faults: v })} format={(v) => `${Math.round(v)}`} />
      <Slider label="Throw" value={state.faultThrow} min={0} max={2} step={0.01} onChange={(v) => update({ faultThrow: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.faults === 0} />
      <Toggle label="Ink level boundaries" checked={state.outlines} onChange={(v) => update({ outlines: v })} />
      {state.outlines && (
        <Slider label="Outline weight" value={state.outlineEmphasis} min={1} max={3} step={1} onChange={(v) => update({ outlineEmphasis: v })} format={(v) => `${Math.round(v)} pass${Math.round(v) > 1 ? 'es' : ''}`} />
      )}

      <h3 className="section-title">Laminae</h3>

      <Slider label="Line pitch" value={state.spacing} min={0.4} max={2} step={0.05} onChange={(v) => update({ spacing: v })} format={(v) => `${v.toFixed(2)} cells`} />
      <Slider label="Stroke length" value={state.strokeLength} min={6} max={80} step={1} onChange={(v) => update({ strokeLength: v })} format={(v) => `${Math.round(v)} cells`} />
      <Toggle label="Flowing laminae" checked={state.continuous} onChange={(v) => update({ continuous: v })} />
      <Slider label="End taper" value={state.taper} min={0} max={1} step={0.01} onChange={(v) => update({ taper: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.continuous} />
      <Slider label="Waviness" value={state.waviness} min={0} max={1} step={0.01} onChange={(v) => update({ waviness: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Density contrast" value={state.densityContrast} min={0} max={1} step={0.01} onChange={(v) => update({ densityContrast: v })} format={(v) => `${Math.round(v * 100)}%`} />

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
            <option value="per-region">One pen per level</option>
            <option value="interleave">Interleave strokes</option>
          </select>
        </label>
      )}

      <AdvancedSection>
        <AdvGroup title="Exposure field">
          <Slider label="Trail lift" value={state.gamma} min={0.25} max={0.9} step={0.01} onChange={(v) => update({ gamma: v })} format={(v) => v.toFixed(2)} />
          <Slider label="Paper cutoff" value={state.faintThreshold} min={0.04} max={0.2} step={0.01} onChange={(v) => update({ faintThreshold: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Off-centre" value={state.offCenter} min={0} max={1} step={0.01} onChange={(v) => update({ offCenter: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={state.seedCount > 1} />
        </AdvGroup>

        <AdvGroup title="Present">
          <Toggle label="Traced core mass" checked={state.massCore} onChange={(v) => update({ massCore: v })} />
          <Slider label="Hatch angle" value={state.hatchAngle} min={-90} max={90} step={1} onChange={(v) => update({ hatchAngle: v })} format={(v) => `${Math.round(v)}°`} disabled={!state.massCore} />
          <Slider label="Cross-hatch" value={state.crossHatchAmount} min={0} max={1} step={0.01} onChange={(v) => update({ crossHatchAmount: v })} format={(v) => `${Math.round(v * 100)}%`} disabled={!state.massCore} />
          <Slider label="Residue size" value={state.residueMaxCells} min={2} max={14} step={1} onChange={(v) => update({ residueMaxCells: v })} format={(v) => `${Math.round(v)} cells`} />
          <Slider label="Halo" value={state.haloMm} min={0.3} max={3} step={0.1} onChange={(v) => update({ haloMm: v })} format={(v) => `${v.toFixed(1)}mm`} />
        </AdvGroup>

        <AdvGroup title="Pen & finish">
          <Slider label="Pen width" value={state.penWidthMm} min={0.15} max={1.2} step={0.05} onChange={(v) => update({ penWidthMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
          <Slider label="Wobble" value={state.wobbleMm} min={0} max={1.2} step={0.05} onChange={(v) => update({ wobbleMm: v })} format={(v) => `${v.toFixed(2)}mm`} />
        </AdvGroup>
      </AdvancedSection>
    </div>
  );
}
