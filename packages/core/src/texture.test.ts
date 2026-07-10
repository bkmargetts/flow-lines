import { describe, it, expect } from 'vitest';
import { generateTexture, type TextureOptions, type TextureStyle } from './texture.js';

const base: TextureOptions = {
  width: 600,
  height: 800,
  margin: 40,
  pxPerMm: 3,
  style: 'hatch',
  spacingMm: 4,
  angleDeg: 45,
  scale: 1,
  jitter: 0.2,
  density: 0.5,
  crossHatch: false,
  seed: 7,
};

const STYLES: TextureStyle[] = ['hatch', 'grid', 'stipple', 'contours', 'shapes', 'dashes'];

function allPoints(lines: { points: { x: number; y: number }[] }[]) {
  return lines.flatMap((l) => l.points);
}

describe('generateTexture', () => {
  it('produces non-empty output for every style', () => {
    for (const style of STYLES) {
      const lines = generateTexture({ ...base, style });
      expect(lines.length, style).toBeGreaterThan(0);
    }
  });

  it('tags every stroke as the texture layer with a plottable polyline', () => {
    for (const style of STYLES) {
      const lines = generateTexture({ ...base, style });
      expect(lines.every((l) => l.layer === 'texture'), style).toBe(true);
      expect(lines.every((l) => l.points.length >= 2), style).toBe(true);
    }
  });

  it('is deterministic per seed', () => {
    for (const style of STYLES) {
      const a = generateTexture({ ...base, style });
      const b = generateTexture({ ...base, style });
      expect(JSON.stringify(a), style).toBe(JSON.stringify(b));
    }
  });

  it('varies with the seed for the randomized styles', () => {
    // grid is a regular lattice with no randomness — intentionally seed-stable.
    for (const style of ['hatch', 'stipple', 'contours', 'shapes', 'dashes'] as TextureStyle[]) {
      const a = generateTexture({ ...base, style });
      const c = generateTexture({ ...base, style, seed: 99 });
      expect(JSON.stringify(a), style).not.toBe(JSON.stringify(c));
    }
  });

  it('keeps every point inside the page margin', () => {
    for (const style of STYLES) {
      const lines = generateTexture({ ...base, style });
      for (const p of allPoints(lines)) {
        // Closed shapes/dots can round a hair past their centre clamp; allow 1px.
        expect(p.x, style).toBeGreaterThanOrEqual(base.margin - 1);
        expect(p.x, style).toBeLessThanOrEqual(base.width - base.margin + 1);
        expect(p.y, style).toBeGreaterThanOrEqual(base.margin - 1);
        expect(p.y, style).toBeLessThanOrEqual(base.height - base.margin + 1);
      }
    }
  });

  it('draws more hatch lines as spacing tightens', () => {
    const wide = generateTexture({ ...base, style: 'hatch', spacingMm: 8, jitter: 0 });
    const tight = generateTexture({ ...base, style: 'hatch', spacingMm: 2, jitter: 0 });
    expect(tight.length).toBeGreaterThan(wide.length);
  });

  it('scatters more stipple dots as density rises', () => {
    const sparse = generateTexture({ ...base, style: 'stipple', density: 0.2 });
    const dense = generateTexture({ ...base, style: 'stipple', density: 0.9 });
    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  it('lays more shapes as spacing tightens', () => {
    const wide = generateTexture({
      ...base,
      style: 'shapes',
      spacingMm: 10,
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0 },
    });
    const tight = generateTexture({
      ...base,
      style: 'shapes',
      spacingMm: 3,
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0 },
    });
    expect(tight.length).toBeGreaterThan(wide.length);
  });

  it('centres the shapes lattice in the drawable rect', () => {
    const lines = generateTexture({
      ...base,
      style: 'shapes',
      jitter: 0,
      spacingMm: 7,
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0 },
    });
    const pts = allPoints(lines);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    // The gap from the margin to the first/last mark should match on both
    // sides: the grid is centred, not flush to the top-left corner.
    const leftGap = minX - base.margin;
    const rightGap = base.width - base.margin - maxX;
    const topGap = minY - base.margin;
    const bottomGap = base.height - base.margin - maxY;
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(1);
    expect(Math.abs(topGap - bottomGap)).toBeLessThan(1);
  });

  it('packs shapes closer as overlap rises (same spacing)', () => {
    const none = generateTexture({
      ...base,
      style: 'shapes',
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0 },
    });
    const overlapped = generateTexture({
      ...base,
      style: 'shapes',
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0.6 },
    });
    expect(overlapped.length).toBeGreaterThan(none.length);
  });

  it('adds a perpendicular set with crossHatch', () => {
    const single = generateTexture({ ...base, style: 'hatch', crossHatch: false, jitter: 0 });
    const crossed = generateTexture({ ...base, style: 'hatch', crossHatch: true, jitter: 0 });
    expect(crossed.length).toBeGreaterThan(single.length);
  });

  describe('halo', () => {
    // A drawing stroke straight across the middle of the page.
    const avoid = [{ points: [{ x: 40, y: 400 }, { x: 560, y: 400 }] }];

    it('holds texture a clear-paper sliver off the drawing', () => {
      const haloPx = 6 * base.pxPerMm; // 6mm
      const lines = generateTexture({
        ...base,
        style: 'stipple',
        density: 0.9,
        avoid,
        haloMm: 6,
      });
      for (const p of allPoints(lines)) {
        // No texture point should sit within the halo band of the stroke (y=400).
        const dist = Math.abs(p.y - 400);
        // Only points whose x is over the stroke span are masked; check those.
        if (p.x >= 40 && p.x <= 560) {
          expect(dist).toBeGreaterThan(haloPx - 3);
        }
      }
    });

    it('is a no-op when haloMm is 0', () => {
      const off = generateTexture({ ...base, style: 'stipple', avoid, haloMm: 0 });
      const none = generateTexture({ ...base, style: 'stipple' });
      expect(JSON.stringify(off)).toBe(JSON.stringify(none));
    });
  });

  describe('dashes style', () => {
    // Zeroed organic knobs: straight dashes of exactly dashLengthMm on the row.
    const straight = {
      dashLengthMm: 6,
      gapMm: 3,
      wobbleMm: 0,
      curvatureMm: 0,
      sparsity: 0,
      flowDeg: 0,
      turbulence: 0,
      gradient: 0,
    };

    // Dashes with any endpoint near the rect edge may be margin-clipped, so
    // their chord no longer reflects the intended dash length.
    function fullDashes(lines: { points: { x: number; y: number }[] }[]) {
      const inset = 6;
      return lines.filter((l) =>
        [l.points[0], l.points[l.points.length - 1]].every(
          (p) =>
            p.x > base.margin + inset &&
            p.x < base.width - base.margin - inset &&
            p.y > base.margin + inset &&
            p.y < base.height - base.margin - inset
        )
      );
    }

    function chordLength(l: { points: { x: number; y: number }[] }) {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return Math.hypot(b.x - a.x, b.y - a.y);
    }

    function midpoint(l: { points: { x: number; y: number }[] }) {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function inkLength(lines: { points: { x: number; y: number }[] }[]) {
      let total = 0;
      for (const l of lines) {
        for (let i = 1; i < l.points.length; i++) {
          total += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
      }
      return total;
    }

    // Max perpendicular deviation of interior points from each line's chord.
    function maxChordDeviation(lines: { points: { x: number; y: number }[] }[]) {
      let max = 0;
      for (const l of lines) {
        const a = l.points[0];
        const b = l.points[l.points.length - 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1e-6) continue;
        for (const p of l.points) {
          const d = Math.abs(((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len);
          max = Math.max(max, d);
        }
      }
      return max;
    }

    it('breaks rows into many short dashes, never longer than the dash length', () => {
      const lines = generateTexture({ ...base, style: 'dashes', jitter: 0, dashes: straight });
      // Far more strokes than rows — the rows are broken, not continuous.
      const rowSpan = Math.hypot(base.width, base.height);
      const rows = Math.ceil(rowSpan / (base.spacingMm * base.pxPerMm));
      expect(lines.length).toBeGreaterThan(rows * 3);
      const maxChord = straight.dashLengthMm * base.pxPerMm + 1;
      for (const l of lines) {
        const a = l.points[0];
        const b = l.points[l.points.length - 1];
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(maxChord);
      }
    });

    it('keeps every dash on the shared direction', () => {
      const angleDeg = 30;
      const dx = Math.cos((angleDeg * Math.PI) / 180);
      const dy = Math.sin((angleDeg * Math.PI) / 180);
      const lines = generateTexture({
        ...base,
        style: 'dashes',
        angleDeg,
        jitter: 0,
        dashes: straight,
      });
      for (const l of lines) {
        const a = l.points[0];
        const b = l.points[l.points.length - 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 2) continue; // margin-clipped stub
        const dot = ((b.x - a.x) * dx + (b.y - a.y) * dy) / len;
        expect(Math.abs(dot)).toBeGreaterThan(0.99);
      }
    });

    it('is ruler-straight with the organic knobs zeroed, wavy with them on', () => {
      const flat = generateTexture({ ...base, style: 'dashes', jitter: 0, dashes: straight });
      expect(maxChordDeviation(flat)).toBeLessThan(0.01);
      const wavy = generateTexture({
        ...base,
        style: 'dashes',
        jitter: 0,
        dashes: { ...straight, wobbleMm: 1, curvatureMm: 2 },
      });
      expect(maxChordDeviation(wavy)).toBeGreaterThan(1);
    });

    it('thins coverage as sparsity rises', () => {
      const full = generateTexture({ ...base, style: 'dashes', dashes: { ...straight, sparsity: 0 } });
      const thin = generateTexture({
        ...base,
        style: 'dashes',
        dashes: { ...straight, sparsity: 0.7 },
      });
      expect(inkLength(thin)).toBeLessThan(inkLength(full) * 0.7);
      expect(inkLength(thin)).toBeGreaterThan(0);
    });

    it('holds the halo off the drawing', () => {
      const avoid = [{ points: [{ x: 40, y: 400 }, { x: 560, y: 400 }] }];
      const haloPx = 6 * base.pxPerMm;
      const lines = generateTexture({ ...base, style: 'dashes', avoid, haloMm: 6 });
      for (const p of allPoints(lines)) {
        if (p.x >= 40 && p.x <= 560) expect(Math.abs(p.y - 400)).toBeGreaterThan(haloPx - 3);
      }
    });

    it('works without a dashes sub-object (built-in defaults)', () => {
      const lines = generateTexture({ ...base, style: 'dashes' });
      expect(lines.length).toBeGreaterThan(0);
    });

    it('flow drifts dash directions, bounded by flowDeg', () => {
      const angleDeg = 0;
      const flowDeg = 45;
      const lines = fullDashes(
        generateTexture({
          ...base,
          style: 'dashes',
          angleDeg,
          jitter: 0,
          dashes: { ...straight, flowDeg },
        })
      );
      const flowRad = (flowDeg * Math.PI) / 180;
      let maxDrift = 0;
      for (const l of lines) {
        const a = l.points[0];
        const b = l.points[l.points.length - 1];
        const drift = Math.abs(Math.atan2(b.y - a.y, b.x - a.x));
        const folded = Math.min(drift, Math.PI - drift); // direction is unsigned
        expect(folded).toBeLessThanOrEqual(flowRad + 0.02);
        maxDrift = Math.max(maxDrift, folded);
      }
      // The field genuinely drifts — it isn't stuck on the base angle.
      expect(maxDrift).toBeGreaterThan(0.1);
    });

    it('turbulence varies dash length in patches across the page', () => {
      const calm = fullDashes(
        generateTexture({ ...base, style: 'dashes', jitter: 0, dashes: straight })
      );
      const lens = calm.map(chordLength);
      const spreadCalm = Math.max(...lens) - Math.min(...lens);
      expect(spreadCalm).toBeLessThan(0.1);

      const churned = fullDashes(
        generateTexture({
          ...base,
          style: 'dashes',
          jitter: 0,
          dashes: { ...straight, turbulence: 1 },
        })
      );
      // Lengths genuinely vary…
      const churnedLens = churned.map(chordLength);
      expect(Math.max(...churnedLens) / Math.min(...churnedLens)).toBeGreaterThan(1.3);
      // …and spatially: mean lengths differ across patch-sized cells (the
      // turbulence field's wavelength is ~200px at this page size).
      const cols = 3;
      const rows = 4;
      const cells: number[][] = Array.from({ length: cols * rows }, () => []);
      for (const l of churned) {
        const m = midpoint(l);
        const ci = Math.min(cols - 1, Math.floor((m.x / base.width) * cols));
        const cj = Math.min(rows - 1, Math.floor((m.y / base.height) * rows));
        cells[cj * cols + ci].push(chordLength(l));
      }
      const means = cells
        .filter((c) => c.length >= 5)
        .map((c) => c.reduce((s, x) => s + x, 0) / c.length);
      expect(means.length).toBeGreaterThan(3);
      expect(Math.max(...means) / Math.min(...means)).toBeGreaterThan(1.1);
    });

    it('gradient sweeps dash length down the page and flips with sign', () => {
      const bandMeans = (gradient: number) => {
        const lines = fullDashes(
          generateTexture({
            ...base,
            style: 'dashes',
            angleDeg: 0,
            jitter: 0,
            dashes: { ...straight, gradient },
          })
        );
        const bands: number[][] = [[], [], []];
        for (const l of lines) {
          const m = midpoint(l);
          const bi = Math.min(2, Math.floor(((m.y - base.margin) / (base.height - 2 * base.margin)) * 3));
          bands[bi].push(chordLength(l));
        }
        return bands.map((b) => b.reduce((s, x) => s + x, 0) / b.length);
      };
      const down = bandMeans(1);
      expect(down[2]).toBeGreaterThan(down[0] * 1.2);
      const up = bandMeans(-1);
      expect(up[0]).toBeGreaterThan(up[2] * 1.2);
    });
  });

  describe('grating style', () => {
    const avoid = [{ points: [{ x: 40, y: 400 }, { x: 560, y: 400 }] }];
    const grating = {
      colorCount: 3,
      lineLengthPct: 1,
      phaseDriftAlongMm: 0,
      phaseDriftAcrossMm: 1.5,
      phaseNoiseAmpMm: 0.6,
      phaseNoiseScale: 0.01,
      wobbleAmpMm: 0,
      wobbleWavelengthMm: 30,
      edgeSmoothMm: 0,
    };

    it('emits one texture-NN layer per ink, all plottable', () => {
      const lines = generateTexture({ ...base, style: 'grating', grating });
      expect(lines.length).toBeGreaterThan(0);
      const layers = new Set(lines.map((l) => l.layer));
      expect(layers.has('texture-00')).toBe(true);
      expect(layers.has('texture-02')).toBe(true);
      for (const l of lines) {
        expect(l.layer?.startsWith('texture-')).toBe(true);
        expect(l.points.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('returns nothing when grating options are missing', () => {
      expect(generateTexture({ ...base, style: 'grating' })).toHaveLength(0);
    });

    it('holds the halo off the drawing', () => {
      const haloPx = 6 * base.pxPerMm;
      const lines = generateTexture({
        ...base,
        style: 'grating',
        grating,
        avoid,
        haloMm: 6,
      });
      for (const p of allPoints(lines)) {
        if (p.x >= 40 && p.x <= 560) expect(Math.abs(p.y - 400)).toBeGreaterThan(haloPx - 3);
      }
    });
  });
});
