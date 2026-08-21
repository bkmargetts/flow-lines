import { render, sheet, OUT } from './lab.mjs';
import { samplePlanePartition, levelCurves, hexOutline } from './arctic.mjs';

function fit(lines, W, H, pad = 40) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const l of lines) for (const p of l.points) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  return lines.map((l) => ({ ...l, points: l.points.map((p) => ({
    x: (p.x - x0) * s + (W - (x1 - x0) * s) / 2,
    y: (p.y - y0) * s + (H - (y1 - y0) * s) / 2,
  })) }));
}

const W = 900, H = 900;
const cases = [
  { label: 'a=b=c=40, uniform, 3000 sweeps', a: 40, b: 40, c: 40, sweeps: 3000, q: 1, seed: 7 },
  { label: 'a=b=c=60, uniform, 4000 sweeps', a: 60, b: 60, c: 60, sweeps: 4000, q: 1, seed: 11 },
  { label: 'a=60 b=30 c=45 (skew hexagon)', a: 60, b: 30, c: 45, sweeps: 4000, q: 1, seed: 3 },
];
const entries = [];
for (const cs of cases) {
  const t0 = Date.now();
  const pp = samplePlanePartition(cs);
  const raw = [...levelCurves(pp, { scale: 10 }), ...hexOutline(pp, { scale: 10 })];
  const lines = fit(raw, W, H);
  const name = 'arctic-' + cs.label.replace(/[^a-z0-9]+/gi, '-');
  const info = render(name, lines, W, H, { width: 1.1, pngWidth: 780 });
  entries.push({ png: info.png, label: `${cs.label} — ${info.strokes} strokes, ${info.segments} segs, ${(Date.now()-t0)/1000}s` });
  console.log(cs.label, JSON.stringify(info), `${(Date.now()-t0)/1000}s`);
}
console.log(sheet(`${OUT}/arctic.html`, entries, { cols: 3, title: 'Arctic limit shapes' }));
