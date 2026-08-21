// Plot-budget comparison: naive extraction vs one tuned to an A3 pen budget.
import { render, sheet, OUT, rng } from './lab.mjs';
import { relax, domains } from './sandpile.mjs';
import { thin, straightRuns } from './vectorize.mjs';
const N = 701, MM = 267 / N, S = 1200;
const entries = [];
const dom = domains.ngon(N, N, 6, 0.2);
const pts = []; { const r = rng(13); let g = 0;
  while (pts.length < 80 && g++ < 40000) { const x = (r() * N) | 0, y = (r() * N) | 0; if (dom(x, y)) pts.push([x, y]); } }
const rr = relax(N, N, dom, pts);
const sk = thin(rr.dev, N, N);
for (const [id, label, opt] of [
  ['mm-naive', 'tol 1.1 / minLen 4 — 50% of segments under 3mm at A3', { tol: 1.1, minLen: 4 }],
  ['mm-budget', 'tol 2.0 / minLen 10 — 3% under 3mm, median 12mm', { tol: 2.0, minLen: 10 }],
  ['mm-strict', 'tol 2.0 / minLen 20 — 0% under 3mm, median 19mm', { tol: 2.0, minLen: 20 }],
]) {
  const runs = straightRuns(sk, N, N, opt);
  const k = (S - 60) / N;
  const lines = runs.map(([a, b]) => ({ points: [{ x: a[0] * k + 30, y: a[1] * k + 30 }, { x: b[0] * k + 30, y: b[1] * k + 30 }] }));
  const info = await render(id, lines, S, S, { width: 1.0, pngWidth: 700 });
  const mm = runs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) * MM).sort((x, y) => x - y);
  entries.push({ png: info.png, label: `${label} — ${runs.length} segments` });
  console.log(id.padEnd(11), String(runs.length).padStart(4), 'segments, median', mm[mm.length >> 1].toFixed(1) + 'mm');
}
console.log(sheet(`${OUT}/sp-mm.html`, entries, { cols: 3, title: 'A3 segment budget' }));
