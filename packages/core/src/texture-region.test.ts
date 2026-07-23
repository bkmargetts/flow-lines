import { describe, expect, it } from 'vitest';
import { compileTextureRegion, type TextureRegionOptions } from './texture-region.js';

const RECT = { x0: 40, y0: 40, x1: 760, y1: 1040 };
const PX_PER_MM = 3.78;

const BASE: TextureRegionOptions = {
  frame: 'organic',
  coverage: 0.8,
  irregularity: 0.5,
  offsetX: 0,
  offsetY: 0,
  patches: 1,
  fade: 0,
  falloff: 0,
};

/** Sample the field on a uniform grid covering the rect plus a border. */
function grid(step = 16): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let y = RECT.y0 - 20; y <= RECT.y1 + 20; y += step) {
    for (let x = RECT.x0 - 20; x <= RECT.x1 + 20; x += step) {
      pts.push({ x, y });
    }
  }
  return pts;
}

describe('compileTextureRegion', () => {
  it('is inert (null) for the rect frame with no falloff', () => {
    expect(compileTextureRegion({ ...BASE, frame: 'rect' }, RECT, PX_PER_MM, 7)).toBeNull();
    expect(
      compileTextureRegion({ ...BASE, frame: 'rect', fade: 0.8 }, RECT, PX_PER_MM, 7)
    ).toBeNull();
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = compileTextureRegion(BASE, RECT, PX_PER_MM, 42)!;
    const b = compileTextureRegion(BASE, RECT, PX_PER_MM, 42)!;
    const c = compileTextureRegion(BASE, RECT, PX_PER_MM, 43)!;
    let differs = false;
    for (const p of grid()) {
      expect(a.inside(p.x, p.y)).toBe(b.inside(p.x, p.y));
      expect(a.depth01(p.x, p.y)).toBe(b.depth01(p.x, p.y));
      if (a.inside(p.x, p.y) !== c.inside(p.x, p.y)) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('stays inside the margin rect even at full coverage and irregularity', () => {
    for (const seed of [1, 2, 3, 42]) {
      const f = compileTextureRegion(
        { ...BASE, coverage: 1, irregularity: 1, offsetX: 0.5, offsetY: -0.5 },
        RECT,
        PX_PER_MM,
        seed
      )!;
      for (const p of grid(8)) {
        if (f.inside(p.x, p.y)) {
          expect(p.x).toBeGreaterThanOrEqual(RECT.x0);
          expect(p.x).toBeLessThanOrEqual(RECT.x1);
          expect(p.y).toBeGreaterThanOrEqual(RECT.y0);
          expect(p.y).toBeLessThanOrEqual(RECT.y1);
        }
      }
    }
  });

  it('covers most of the frame at high coverage, less at low coverage', () => {
    const count = (coverage: number): number => {
      const f = compileTextureRegion({ ...BASE, coverage }, RECT, PX_PER_MM, 5)!;
      return grid().filter((p) => f.inside(p.x, p.y)).length;
    };
    expect(count(1)).toBeGreaterThan(count(0.6));
    expect(count(0.6)).toBeGreaterThan(count(0.3));
    expect(count(0.3)).toBeGreaterThan(0);
  });

  it('depth01 is 0 outside and increases from boundary to centre along a ray', () => {
    const f = compileTextureRegion(BASE, RECT, PX_PER_MM, 9)!;
    const cx = (RECT.x0 + RECT.x1) / 2;
    const cy = (RECT.y0 + RECT.y1) / 2;
    expect(f.depth01(RECT.x0 - 10, cy)).toBe(0);
    // Walk from a boundary-adjacent point toward the centre: depth never drops.
    for (const angle of [0, 0.9, 2.1, 3.3, 4.6, 5.5]) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let prev = -1;
      for (let t = 1; t >= 0; t -= 0.02) {
        const x = cx + dx * t * 400;
        const y = cy + dy * t * 400;
        if (!f.inside(x, y)) {
          prev = -1;
          continue;
        }
        const d = f.depth01(x, y);
        expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = d;
      }
      expect(prev).toBeGreaterThan(0.9); // centre of a centred single patch is deep
    }
  });

  it('fade keeps clear a subset of inside, always clear beyond the band, thinner with more fade', () => {
    const clearCount = (fade: number): number => {
      const f = compileTextureRegion({ ...BASE, fade }, RECT, PX_PER_MM, 11)!;
      let n = 0;
      for (const p of grid(8)) {
        const c = f.clear(p.x, p.y);
        if (c) {
          n++;
          expect(f.inside(p.x, p.y)).toBe(true);
        }
        const band = 0.08 + 0.35 * fade;
        if (f.inside(p.x, p.y) && f.depth01(p.x, p.y) >= band) expect(c).toBe(true);
      }
      return n;
    };
    const hard = clearCount(0);
    expect(clearCount(0.4)).toBeLessThan(hard);
    expect(clearCount(1)).toBeLessThan(clearCount(0.4));
  });

  it('fade 0 and falloff 0 degenerate to the hard containment test', () => {
    const f = compileTextureRegion(BASE, RECT, PX_PER_MM, 13)!;
    for (const p of grid()) {
      expect(f.clear(p.x, p.y)).toBe(f.inside(p.x, p.y));
    }
  });

  it('falloff thins the outer region more than the core, for both frames', () => {
    for (const frame of ['organic', 'rect'] as const) {
      const f = compileTextureRegion({ ...BASE, frame, falloff: 0.8 }, RECT, PX_PER_MM, 17)!;
      let outerClear = 0;
      let outerTotal = 0;
      let innerClear = 0;
      let innerTotal = 0;
      for (const p of grid(8)) {
        if (!f.inside(p.x, p.y)) continue;
        const d = f.depth01(p.x, p.y);
        if (d < 0.25) {
          outerTotal++;
          if (f.clear(p.x, p.y)) outerClear++;
        } else if (d > 0.75) {
          innerTotal++;
          if (f.clear(p.x, p.y)) innerClear++;
        }
      }
      expect(outerTotal).toBeGreaterThan(0);
      expect(innerTotal).toBeGreaterThan(0);
      expect(outerClear / outerTotal).toBeLessThan(innerClear / innerTotal);
    }
  });

  it('multiple patches form separate regions, all inside the margins', () => {
    const f = compileTextureRegion(
      { ...BASE, patches: 3, coverage: 0.7 },
      RECT,
      PX_PER_MM,
      21
    )!;
    // Coarse occupancy grid → flood fill → count connected components.
    const step = 12;
    const cols = Math.ceil((RECT.x1 - RECT.x0) / step) + 1;
    const rows = Math.ceil((RECT.y1 - RECT.y0) / step) + 1;
    const occ = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (f.inside(RECT.x0 + i * step, RECT.y0 + j * step)) occ[j * cols + i] = 1;
      }
    }
    let components = 0;
    const stack: number[] = [];
    for (let s = 0; s < occ.length; s++) {
      if (occ[s] !== 1) continue;
      components++;
      stack.push(s);
      occ[s] = 2;
      while (stack.length) {
        const idx = stack.pop()!;
        const ci = idx % cols;
        const cj = (idx - ci) / cols;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue;
          const nidx = nj * cols + ni;
          if (occ[nidx] === 1) {
            occ[nidx] = 2;
            stack.push(nidx);
          }
        }
      }
    }
    expect(components).toBeGreaterThanOrEqual(2);
  });
});
