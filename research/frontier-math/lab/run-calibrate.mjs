// Calibrate the density pre-test against a known-good and a known-bad drawing.
import { tonePreTest, reportRow, REPORT_HEADER } from './tone-test.mjs';
import { relax, domains } from './sandpile.mjs';
import { thin, straightRuns } from './vectorize.mjs';
import { rng, OUT } from './lab.mjs';
import { mkdirSync } from 'node:fs';

const core = await import('/home/user/flow-lines/packages/core/dist/index.js');
mkdirSync(OUT, { recursive: true });
const W = 900, H = 900, M = 40;
const rows = [];

// ---- KNOWN GOOD: Arctic, the module that works -----------------------------
for (const preset of ['dissolve', 'horizon', 'weave', 'brick']) {
  const r = core.generateArctic({ width: W, height: H, margin: M, seed: 20260821, preset });
  rows.push(tonePreTest(`GOOD arctic/${preset}`, r.lines, W, H, { dir: OUT }));
}

// ---- KNOWN BAD: the sandpile, cut on the drawing ---------------------------
const N = 420, MM = (W - 2 * M) / N;
for (const [label, k, seed, dom] of [
  ['facet', 34, 7, domains.ngon(N, N, 6, 0.2)],
  ['lattice', 14, 3, domains.rect(N, N)],
  ['crystal', 28, 5, domains.disk(N, N)],
]) {
  const r2 = rng(seed);
  const pts = [];
  let g = 0;
  while (pts.length < k && g++ < k * 400) {
    const x = (r2() * N) | 0, y = (r2() * N) | 0;
    if (dom(x, y)) pts.push([x, y]);
  }
  const sim = relax(N, N, dom, pts);
  const runs = straightRuns(thin(sim.dev, N, N), N, N, { tol: 2, minLen: 10 });
  const lines = runs.map(([a, b]) => ({
    points: [{ x: a[0] * MM + M, y: a[1] * MM + M }, { x: b[0] * MM + M, y: b[1] * MM + M }],
  }));
  rows.push(tonePreTest(`BAD  sandpile/${label}`, lines, W, H, { dir: OUT }));
}

// ---- Reference points: what a flat field and a hard split actually score ----
const flat = [];
for (let y = M; y < H - M; y += 6) flat.push({ points: [{ x: M, y }, { x: W - M, y }] });
rows.push(tonePreTest('REF  uniform hatching', flat, W, H, { dir: OUT }));

const split = [];
for (let y = M; y < H - M; y += 6) {
  split.push({ points: [{ x: M, y }, { x: W / 2, y }] });
  if (y % 30 < 6) split.push({ points: [{ x: W / 2, y }, { x: W - M, y }] });
}
rows.push(tonePreTest('REF  hard 5:1 density split', split, W, H, { dir: OUT }));

console.log(REPORT_HEADER);
console.log('-'.repeat(78));
for (const r of rows) console.log(reportRow(r));
