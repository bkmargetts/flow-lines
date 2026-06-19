import { describe, it, expect } from 'vitest';
import {
  generatePhysarum,
  stepPhysarum,
  type PhysarumAgents,
  type PhysarumStepParams,
} from './physarum.js';

/** Pull every point of every line flat, for bounds/equality checks */
function allPoints(lines: { points: { x: number; y: number }[] }[]) {
  return lines.flatMap((l) => l.points);
}

const STEP: PhysarumStepParams = {
  sensorAngle: Math.PI / 8,
  sensorDistance: 6,
  rotationAngle: Math.PI / 4,
  stepSize: 1,
  depositAmount: 5,
  decay: 0.1,
  diffuseRate: 0.5,
};

describe('stepPhysarum', () => {
  it('deposits trail where agents walk', () => {
    const cols = 32;
    const rows = 32;
    const n = cols * rows;
    const trail = new Float32Array(n);
    const scratch = new Float32Array(n);
    const agents: PhysarumAgents = {
      x: Float32Array.from([8, 16, 24]),
      y: Float32Array.from([8, 16, 24]),
      h: Float32Array.from([0, 1, 2]),
    };
    let s = 1;
    const random = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
    stepPhysarum(agents, trail, scratch, cols, rows, STEP, random);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += trail[i];
    expect(sum).toBeGreaterThan(0);
  });

  it('decays an isolated trail toward zero with no deposits', () => {
    const cols = 16;
    const rows = 16;
    const n = cols * rows;
    const trail = new Float32Array(n);
    const scratch = new Float32Array(n);
    trail[8 * cols + 8] = 100;
    // No agents → nothing deposited; diffuse + decay only.
    const agents: PhysarumAgents = { x: new Float32Array(0), y: new Float32Array(0), h: new Float32Array(0) };
    const random = () => 0.5;
    let before = 0;
    for (let i = 0; i < n; i++) before += trail[i];
    for (let s = 0; s < 30; s++) stepPhysarum(agents, trail, scratch, cols, rows, STEP, random);
    let after = 0;
    for (let i = 0; i < n; i++) after += trail[i];
    expect(after).toBeLessThan(before);
  });

  it('keeps agents in bounds across a toroidal wrap', () => {
    const cols = 20;
    const rows = 20;
    const n = cols * rows;
    const trail = new Float32Array(n);
    const scratch = new Float32Array(n);
    // An agent at the right edge heading +x must wrap to the left, not run off.
    const agents: PhysarumAgents = {
      x: Float32Array.from([19.7]),
      y: Float32Array.from([10]),
      h: Float32Array.from([0]),
    };
    const random = () => 0.5;
    for (let s = 0; s < 5; s++) stepPhysarum(agents, trail, scratch, cols, rows, STEP, random);
    expect(agents.x[0]).toBeGreaterThanOrEqual(0);
    expect(agents.x[0]).toBeLessThan(cols);
    expect(agents.y[0]).toBeGreaterThanOrEqual(0);
    expect(agents.y[0]).toBeLessThan(rows);
    expect(Number.isNaN(agents.x[0])).toBe(false);
    expect(Number.isNaN(agents.y[0])).toBe(false);
  });
});

describe('generatePhysarum', () => {
  // Small grid / short run / few agents keeps the suite fast.
  const base = {
    width: 600,
    height: 600,
    seed: 7,
    gridCols: 90,
    steps: 120,
    agentCount: 1500,
    preset: 'network' as const,
  };

  it('is deterministic for the same options and seed', () => {
    const a = generatePhysarum(base);
    const b = generatePhysarum(base);
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    expect(a.lines.length).toBeGreaterThan(0);
  });

  it('produces different compositions for different seeds', () => {
    const a = generatePhysarum({ ...base, seed: 1 });
    const b = generatePhysarum({ ...base, seed: 2 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('produces different compositions for different presets', () => {
    const a = generatePhysarum({ ...base, preset: 'network' });
    const b = generatePhysarum({ ...base, preset: 'denseWeb' });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('produces non-empty plottable lines of at least two points', () => {
    const r = generatePhysarum(base);
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.lines.every((l) => l.points.length >= 2)).toBe(true);
  });

  it('keeps every mark inside the page margin', () => {
    const margin = 40;
    const r = generatePhysarum({ ...base, margin });
    for (const pt of allPoints(r.lines)) {
      expect(pt.x).toBeGreaterThanOrEqual(margin - 5);
      expect(pt.x).toBeLessThanOrEqual(base.width - margin + 5);
      expect(pt.y).toBeGreaterThanOrEqual(margin - 5);
      expect(pt.y).toBeLessThanOrEqual(base.height - margin + 5);
    }
  });

  it('reports the requested page size and seed', () => {
    const r = generatePhysarum(base);
    expect(r.width).toBe(600);
    expect(r.height).toBe(600);
    expect(r.seed).toBe(7);
  });

  it('returns an empty-but-valid result when the grid cannot fit', () => {
    const r = generatePhysarum({ ...base, margin: 299 });
    expect(r.lines).toEqual([]);
    expect(r.width).toBe(600);
  });

  it('tags strokes with core / mid / rim layers', () => {
    const r = generatePhysarum(base);
    const layers = new Set(r.lines.map((l) => l.layer));
    expect([...layers].every((l) => l === 'core' || l === 'mid' || l === 'rim')).toBe(true);
  });

  it('draws bold core marks for the field styles', () => {
    for (const style of ['hatch', 'dual'] as const) {
      const r = generatePhysarum({ ...base, style });
      expect(r.lines.some((l) => l.pen === 'bold')).toBe(true);
    }
  });

  it('traces near-closed loops for the contour style', () => {
    const r = generatePhysarum({ ...base, style: 'contour', wobble: 0 });
    const cellPx = 600 / base.gridCols;
    const closed = r.lines.some((l) => {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return Math.hypot(a.x - b.x, a.y - b.y) < cellPx * 4;
    });
    expect(closed).toBe(true);
  });

  it('yields open trajectories for the paths style', () => {
    const r = generatePhysarum({ ...base, style: 'paths', wobble: 0 });
    expect(r.lines.length).toBeGreaterThan(0);
    const cellPx = 600 / base.gridCols;
    // Path-tracing should leave some genuinely open strokes (start far from end),
    // unlike contour-tracing whose loops close.
    const open = r.lines.some((l) => {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return Math.hypot(a.x - b.x, a.y - b.y) > cellPx * 6;
    });
    expect(open).toBe(true);
  });

  describe('art style', () => {
    it('toggling art style changes the composition', () => {
      const art = generatePhysarum({ ...base, artStyle: true });
      const faithful = generatePhysarum({ ...base, artStyle: false });
      expect(JSON.stringify(art.lines)).not.toBe(JSON.stringify(faithful.lines));
    });
  });
});
