// Does the two-periodic Aztec diamond actually show a THIRD phase?
// Answered from exact Kasteleyn densities — no sampler needed.
import { dominoProbabilities } from './kasteleyn.mjs';
import { writePNG } from './raster.mjs';
import { OUT } from './lab.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const n = 30;

/** Ink density if we ink ONE domino class, as the 'dissolve' preset does. */
function classDensity(probs, n) {
  const S = 2 * n;
  const grid = new Float64Array(S * S).fill(NaN);
  for (let x = -n; x < n; x++) {
    for (let y = -n; y < n; y++) {
      const k = `${x},${y},h`;
      if (!probs.has(k)) continue;
      // 'N' class = horizontal domino whose parity (x+y+n) is even
      if ((((x + y + n) % 2) + 2) % 2 !== 0) continue;
      grid[(y + n) * S + (x + n)] = probs.get(k).p;
    }
  }
  return { grid, S };
}

function heat(path, { grid, S }, scale = 7) {
  return writePNG(path, S * scale, S * scale, (px, py) => {
    const v = grid[((py / scale) | 0) * S + ((px / scale) | 0)];
    if (!Number.isFinite(v)) return [255, 255, 255];
    const t = Math.round(255 * (1 - Math.max(0, Math.min(1, v))));
    return [t, t, t];
  });
}

/** Histogram of the density inside the disordered core — a third phase should
 *  show up as a third mode, not just a spread. */
function modes({ grid, S }, n) {
  const vals = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = grid[y * S + x];
    if (!Number.isFinite(v)) continue;
    // restrict to the inscribed circle — the disordered region
    const dx = x - n, dy = y - n;
    if (Math.hypot(dx, dy) > n * 0.62) continue;
    vals.push(v);
  }
  const bins = new Array(10).fill(0);
  for (const v of vals) bins[Math.min(9, Math.max(0, Math.floor(v * 10)))]++;
  return bins.map((b) => Math.round((100 * b) / vals.length));
}

const cases = [
  ['uniform (a=1)', () => 1],
  // Two-periodic: weight `a` on a 2x2 block pattern of faces, 1 elsewhere.
  ...[0.6, 0.35, 0.2].map((a) => [
    `two-periodic a=${a}`,
    (x, y) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 + 2) % 2 === 0 ? a : 1,
  ]),
];

console.log(`AD(${n}) exact densities — histogram of P(inked class) in the core, % per 0.1 bin\n`);
console.log('case'.padEnd(22) + '  0  .1  .2  .3  .4  .5  .6  .7  .8  .9');
for (const [label, w] of cases) {
  const t0 = Date.now();
  const { probs, logDet } = dominoProbabilities(n, (x, y) => w(x, y));
  const d = classDensity(probs, n);
  heat(`${OUT}/kast-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, d);
  const h = modes(d, n);
  console.log(label.padEnd(22) + h.map((v) => String(v).padStart(4)).join('') +
    `   log|det|=${logDet.toFixed(2)}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
