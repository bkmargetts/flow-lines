// EXACT DIMER DENSITIES ON THE AZTEC DIAMOND, VIA KASTELEYN
//
// The question the pre-test asks is about the DENSITY FIELD, not about any one
// sample — so there is no need to sample at all. Every planar dimer model is
// exactly solvable (Kasteleyn 1961): orient the edges so that every face has an
// odd number of clockwise edges, and then
//
//     |det K| = the number of tilings,   P(edge (w,b)) = K(w,b) · K⁻¹(b,w).
//
// For the square lattice the orientation can be carried by a phase: weight 1 on
// horizontal edges and i on vertical ones gives every 4-cycle the right sign.
//
// This matters because the interesting case — the TWO-PERIODIC Aztec diamond,
// where edge weights alternate and the model gains a third "gas" phase between
// frozen and liquid — needs a weighted sampler I cannot verify here (the
// generalized-shuffling papers are unreachable from this sandbox). Kasteleyn
// sidesteps that entirely: it gives the exact expected density under ANY
// weighting, which is precisely what the tone pre-test consumes.
//
// It is also self-verifying. For uniform weights the Aztec diamond has exactly
// 2^{n(n+1)/2} tilings, so |det K| must hit that number on the nose — an exact
// check on the construction before a single density is trusted.

/** Cells of AD(n): unit squares (x,y) with |x+1/2| + |y+1/2| <= n. */
export function aztecCells(n) {
  const cells = [];
  for (let x = -n; x < n; x++) {
    for (let y = -n; y < n; y++) {
      if (Math.abs(x + 0.5) + Math.abs(y + 0.5) <= n) cells.push([x, y]);
    }
  }
  return cells;
}

/**
 * Build the (complex) Kasteleyn matrix.
 * `weight(x, y, horizontal)` returns the weight of the domino whose lower-left
 * cell is (x,y); horizontal means it also covers (x+1,y), else (x,y+1).
 */
export function buildKasteleyn(n, weight = () => 1) {
  const cells = aztecCells(n);
  const idx = new Map(cells.map(([x, y], i) => [`${x},${y}`, i]));
  const isWhite = ([x, y]) => (((x + y) % 2) + 2) % 2 === 0;
  const whites = [];
  const blacks = [];
  const wOf = new Map();
  const bOf = new Map();
  for (const c of cells) {
    if (isWhite(c)) { wOf.set(`${c[0]},${c[1]}`, whites.length); whites.push(c); }
    else { bOf.set(`${c[0]},${c[1]}`, blacks.length); blacks.push(c); }
  }
  if (whites.length !== blacks.length) throw new Error('AD(n) is not balanced — bug');
  const m = whites.length;
  const re = new Float64Array(m * m);
  const im = new Float64Array(m * m);
  const put = (w, b, r, i) => { re[w * m + b] = r; im[w * m + b] = i; };

  for (const [x, y] of cells) {
    const here = `${x},${y}`;
    // horizontal partner to the east
    const east = `${x + 1},${y}`;
    if (idx.has(east)) {
      const wgt = weight(x, y, true);
      // phase 1 on horizontal edges
      if (isWhite([x, y])) put(wOf.get(here), bOf.get(east), wgt, 0);
      else put(wOf.get(east), bOf.get(here), wgt, 0);
    }
    // vertical partner to the north
    const north = `${x},${y + 1}`;
    if (idx.has(north)) {
      const wgt = weight(x, y, false);
      // phase i on vertical edges — makes every face's sign product correct
      if (isWhite([x, y])) put(wOf.get(here), bOf.get(north), 0, wgt);
      else put(wOf.get(north), bOf.get(here), 0, wgt);
    }
  }
  return { re, im, m, whites, blacks, wOf, bOf, cells };
}

/**
 * Complex Gauss-Jordan: returns the inverse and log|det|. The matrix is dense
 * and m = n(n+1), so this is O(m³) — fine to n ≈ 30, which is far more than the
 * phase structure needs.
 */
export function invertComplex(reIn, imIn, m) {
  const a = Float64Array.from(reIn);
  const b = Float64Array.from(imIn);
  const ir = new Float64Array(m * m);
  const ii = new Float64Array(m * m);
  for (let i = 0; i < m; i++) ir[i * m + i] = 1;
  let logDet = 0;
  let detArg = 0;

  for (let col = 0; col < m; col++) {
    // partial pivot on modulus
    let piv = col;
    let best = -1;
    for (let r = col; r < m; r++) {
      const mag = a[r * m + col] ** 2 + b[r * m + col] ** 2;
      if (mag > best) { best = mag; piv = r; }
    }
    if (best <= 1e-300) throw new Error('Kasteleyn matrix is singular');
    if (piv !== col) {
      for (let k = 0; k < m; k++) {
        [a[col * m + k], a[piv * m + k]] = [a[piv * m + k], a[col * m + k]];
        [b[col * m + k], b[piv * m + k]] = [b[piv * m + k], b[col * m + k]];
        [ir[col * m + k], ir[piv * m + k]] = [ir[piv * m + k], ir[col * m + k]];
        [ii[col * m + k], ii[piv * m + k]] = [ii[piv * m + k], ii[col * m + k]];
      }
      detArg += Math.PI; // row swap flips the sign
    }
    const pr = a[col * m + col];
    const pi = b[col * m + col];
    const pm = pr * pr + pi * pi;
    logDet += 0.5 * Math.log(pm);
    detArg += Math.atan2(pi, pr);
    // scale the pivot row by 1/pivot
    const kr = pr / pm;
    const ki = -pi / pm;
    for (let k = 0; k < m; k++) {
      const xr = a[col * m + k], xi = b[col * m + k];
      a[col * m + k] = xr * kr - xi * ki;
      b[col * m + k] = xr * ki + xi * kr;
      const yr = ir[col * m + k], yi = ii[col * m + k];
      ir[col * m + k] = yr * kr - yi * ki;
      ii[col * m + k] = yr * ki + yi * kr;
    }
    // eliminate the column from every other row
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const fr = a[r * m + col], fi = b[r * m + col];
      if (fr === 0 && fi === 0) continue;
      for (let k = 0; k < m; k++) {
        const xr = a[col * m + k], xi = b[col * m + k];
        a[r * m + k] -= fr * xr - fi * xi;
        b[r * m + k] -= fr * xi + fi * xr;
        const yr = ir[col * m + k], yi = ii[col * m + k];
        ir[r * m + k] -= fr * yr - fi * yi;
        ii[r * m + k] -= fr * yi + fi * yr;
      }
    }
  }
  return { ir, ii, logDet, detArg };
}

/**
 * Exact probability of every domino, under any weighting.
 * Returns a map from "x,y,h" to its probability, plus log|det K| so the caller
 * can check it against the known tiling count.
 */
export function dominoProbabilities(n, weight = () => 1) {
  const K = buildKasteleyn(n, weight);
  const { re, im, m, wOf, bOf, cells, whites, blacks } = K;
  const inv = invertComplex(re, im, m);
  const probs = new Map();
  const idx = new Set(cells.map(([x, y]) => `${x},${y}`));

  const record = (x, y, horiz) => {
    const here = `${x},${y}`;
    const other = horiz ? `${x + 1},${y}` : `${x},${y + 1}`;
    if (!idx.has(other)) return;
    const white = wOf.has(here) ? here : other;
    const black = wOf.has(here) ? other : here;
    const wi = wOf.get(white);
    const bi = bOf.get(black);
    // K(w,b)
    const kr = re[wi * m + bi];
    const ki = im[wi * m + bi];
    // K^{-1}(b,w) — inverse is indexed [black][white]
    const vr = inv.ir[bi * m + wi];
    const vi = inv.ii[bi * m + wi];
    // P = K(w,b) * K^-1(b,w); imaginary part must vanish
    const pr = kr * vr - ki * vi;
    const pi = kr * vi + ki * vr;
    probs.set(`${x},${y},${horiz ? 'h' : 'v'}`, { p: pr, imag: pi });
  };

  for (const [x, y] of cells) { record(x, y, true); record(x, y, false); }
  void whites; void blacks;
  return { probs, logDet: inv.logDet, m, cells };
}
