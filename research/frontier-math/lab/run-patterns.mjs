// Which 2-periodic edge weighting actually produces the gas phase?
// Exact Kasteleyn densities as the oracle; sweep patterns and look for an
// interior region whose density differs from BOTH the frozen corner and the
// liquid bulk.
import { dominoProbabilities } from './kasteleyn.mjs';
import { writePNG } from './raster.mjs';
import { OUT } from './lab.mjs';

const n = 30, a = 0.25;
const m2 = (v) => ((v % 2) + 2) % 2;

const PATTERNS = {
  'block2x2':  (x, y) => m2(Math.floor(x / 2) + Math.floor(y / 2)) === 0 ? a : 1,
  'xy-parity': (x, y) => m2(x) === m2(y) ? a : 1,
  'x-only':    (x) => (m2(x) === 0 ? a : 1),
  'orient':    (x, y, h) => (h ? (m2(y) === 0 ? a : 1) : (m2(x) === 0 ? a : 1)),
  'diag4':     (x, y) => (((x + y) % 4) + 4) % 4 < 2 ? a : 1,
  'orient-xy': (x, y, h) => (h ? (m2(x + y) === 0 ? a : 1) : (m2(x + y) === 1 ? a : 1)),
};

function field(probs, n) {
  const S = 2 * n, grid = new Float64Array(S * S).fill(NaN);
  for (let x = -n; x < n; x++) for (let y = -n; y < n; y++) {
    const k = `${x},${y},h`;
    if (!probs.has(k) || m2(x + y + n) !== 0) continue;
    grid[(y + n) * S + (x + n)] = probs.get(k).p;
  }
  return { grid, S };
}

/** Smooth over the 2-periodic checker so we see PHASES, not the sublattice. */
function smooth({ grid, S }, r = 3) {
  const out = new Float64Array(S * S).fill(NaN);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0, c = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const v = grid[(y + dy) * S + (x + dx)];
      if (Number.isFinite(v)) { s += v; c++; }
    }
    if (c > 4) out[y * S + x] = s / c;
  }
  return { grid: out, S };
}

const heat = (p, { grid, S }, k = 7) => writePNG(p, S * k, S * k, (px, py) => {
  const v = grid[((py / k) | 0) * S + ((px / k) | 0)];
  if (!Number.isFinite(v)) return [255, 255, 255];
  const t = Math.round(255 * (1 - Math.max(0, Math.min(1, v))));
  return [t, t, t];
});

console.log(`AD(${n}), a=${a} — smoothed density along the vertical centre line (frozen pole -> centre)\n`);
for (const [name, w] of Object.entries(PATTERNS)) {
  const { probs } = dominoProbabilities(n, w);
  const sm = smooth(field(probs, n));
  heat(`${OUT}/pat-${name}.png`, sm);
  // profile from the frozen south pole up through the centre
  const prof = [];
  for (let y = 2 * n - 3; y > 2; y -= Math.round((2 * n) / 12)) {
    const v = sm.grid[y * sm.S + n];
    prof.push(Number.isFinite(v) ? v.toFixed(2) : ' -- ');
  }
  console.log(name.padEnd(12), prof.join(' '));
}
