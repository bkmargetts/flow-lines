// Mark strategies over one exact Aztec tiling. Same mathematics, different ink.
const S = 6;
const P = (x, y) => ({ x: x * S, y: -y * S });

/** Domino type from position parity — the four classes the arctic theorem separates. */
export function typeOf(d, n) {
  const p = (((d.x + d.y + n) % 2) + 2) % 2;
  return d.h ? (p === 0 ? 'N' : 'S') : (p === 0 ? 'E' : 'W');
}

/** One segment along each domino's long axis. */
export function spines({ dominoes, n }, { only = null } = {}) {
  const out = [];
  for (const d of dominoes) {
    const t = typeOf(d, n);
    if (only && !only.includes(t)) continue;
    // full domino length, so collinear neighbours share an endpoint and weld
    const a = d.h ? P(d.x, d.y + 0.5) : P(d.x + 0.5, d.y);
    const b = d.h ? P(d.x + 2, d.y + 0.5) : P(d.x + 0.5, d.y + 2);
    out.push({ points: [a, b], t });
  }
  return out;
}

/** Spines, with collinear touching spines welded into one long stroke.
 *  Long-range order in the frozen corners becomes long continuous rules;
 *  the liquid region stays broken dashes. */
export function weldedSpines(T, opts = {}) {
  const segs = spines(T, opts);
  const k = (p) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
  const ends = new Map();
  for (const s of segs) for (const p of [s.points[0], s.points[1]]) {
    const kk = k(p); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(s);
  }
  const used = new Set(); const out = [];
  const horiz = (s) => Math.abs(s.points[0].y - s.points[1].y) < 1e-9;
  for (const s of segs) {
    if (used.has(s)) continue;
    used.add(s);
    let pts = [s.points[0], s.points[1]];
    for (const end of [0, 1]) {
      let grow = true;
      while (grow) {
        grow = false;
        const tip = end === 0 ? pts[0] : pts[pts.length - 1];
        for (const c of ends.get(k(tip)) || []) {
          if (used.has(c) || horiz(c) !== horiz(s)) continue;
          const other = k(c.points[0]) === k(tip) ? c.points[1] : c.points[0];
          used.add(c);
          if (end === 0) pts.unshift(other); else pts.push(other);
          grow = true; break;
        }
      }
    }
    out.push({ points: pts, t: s.t });
  }
  return out;
}
