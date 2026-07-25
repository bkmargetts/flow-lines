import { describe, it, expect } from 'vitest';
import { LANDSCAPE_PRESETS, getLandscapePreset, randomLandscapeGenome } from './presets';
import { defaultLandscapeState, type LandscapeState } from './types';
import { renderLandscape } from './render';
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

describe('landscape presets', () => {
  it('every preset renders to a non-trivial, plottable scene', () => {
    for (const preset of LANDSCAPE_PRESETS) {
      const state: LandscapeState = { ...defaultLandscapeState, ...preset.state, seed: 5 };
      const out = renderLandscape(state, env());
      expect(out.lines.length).toBeGreaterThan(20);
      // sky hatch and a silhouette contour are always present
      expect(out.lines.some((l) => l.layer === 'sky')).toBe(true);
      expect(out.lines.some((l) => l.layer === 'contour' || l.layer === 'horizon')).toBe(true);
      for (const ln of out.lines) {
        for (const p of ln.points) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
        }
      }
    }
  });

  it('getLandscapePreset returns each known scene and null otherwise', () => {
    expect(getLandscapePreset('coastal-sunset')?.state.hasWater).toBe(true);
    expect(getLandscapePreset('misty-ranges')?.state.hasWater).toBe(false);
    expect(getLandscapePreset('nope')).toBeNull();
  });

  it('random genomes are deterministic per RNG and stay plottable', () => {
    // Seeded LCG so the test itself is deterministic.
    let s = 1234;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 8; i++) {
      const genome = randomLandscapeGenome(rng);
      const state: LandscapeState = { ...defaultLandscapeState, ...genome, seed: 99 };
      const out = renderLandscape(state, env());
      expect(out.lines.length).toBeGreaterThan(0);
    }
  });
});
