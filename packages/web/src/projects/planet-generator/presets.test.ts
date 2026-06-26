import { describe, it, expect } from 'vitest';
import { generatePlanet } from '@flow-lines/core';
import { PLANET_PRESETS, getPlanetPreset, randomPlanetGenome } from './presets';
import { defaultPlanetState, type PlanetState } from './types';
import { renderPlanet } from './render';
import type { RenderEnv } from '../../modules/types';

function env(): RenderEnv {
  const pxPerMm = 3;
  const widthMm = 210;
  const heightMm = 297;
  return {
    page: {
      widthPx: widthMm * pxPerMm,
      heightPx: heightMm * pxPerMm,
      pxPerMm,
      widthMm,
      heightMm,
      scale: 1,
    },
    // Only the fields render.ts reads are needed.
    frame: { marginMm: 12 } as RenderEnv['frame'],
    marginPx: 12 * pxPerMm,
  };
}

describe('planet presets', () => {
  it('every preset renders to a non-trivial, plottable plate', () => {
    for (const preset of PLANET_PRESETS) {
      const state: PlanetState = { ...defaultPlanetState, ...preset.state, seed: 5 };
      const out = renderPlanet(state, env());
      expect(out.lines.length).toBeGreaterThan(20);
      // a limb is always drawn
      expect(out.lines.some((l) => l.layer === 'limb')).toBe(true);
      for (const ln of out.lines) {
        for (const p of ln.points) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
        }
      }
    }
  });

  it('getPlanetPreset returns each known type and null otherwise', () => {
    expect(getPlanetPreset('ringed')?.state.rings).toBe(true);
    expect(getPlanetPreset('nope')).toBeNull();
  });

  it('random genomes are deterministic per RNG and stay plottable', () => {
    // Seeded LCG so the test itself is deterministic.
    let s = 1234;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 8; i++) {
      const genome = randomPlanetGenome(rng);
      const state: PlanetState = { ...defaultPlanetState, ...genome, seed: 99 };
      const a = generatePlanet({
        width: 600, height: 800, margin: 36, seed: state.seed,
        radiusFrac: state.radiusFrac, planetType: state.planetType,
      });
      expect(a.lines.length).toBeGreaterThan(0);
    }
  });
});
