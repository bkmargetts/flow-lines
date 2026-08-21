// Evenly-spaced streamlines (Jobard & Lefer 1997) over an arbitrary traced
// curve source. Points are committed only when a line FINISHES, so a line can
// never terminate against itself; new seeds are offered perpendicular to
// existing lines at the separation distance, which is what makes the spacing
// read as deliberate hatching rather than scattered noise.
export function evenlySpaced({ traceBoth, seeds0, dsep, dtest = 0.5, bounds, maxLines = 4000 }) {
  const cell = dsep;
  const buckets = new Map();
  const bkey = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const commit = (pts) => {
    for (const p of pts) {
      const k = bkey(p[0], p[1]);
      let b = buckets.get(k); if (!b) buckets.set(k, (b = []));
      b.push(p);
    }
  };
  const tooClose = (p, r) => {
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell);
    const r2 = r * r;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const b = buckets.get(`${cx + dx},${cy + dy}`);
      if (!b) continue;
      for (const q of b) {
        const ex = q[0] - p[0], ey = q[1] - p[1];
        if (ex * ex + ey * ey < r2) return true;
      }
    }
    return false;
  };
  const lines = [];
  const queue = [...seeds0];
  while (queue.length && lines.length < maxLines) {
    const s = queue.shift();
    if (Math.abs(s[0]) > bounds || Math.abs(s[1]) > bounds) continue;
    if (tooClose(s, dsep)) continue;
    const pts = traceBoth(s, (p) => tooClose(p, dsep * dtest));
    if (!pts || pts.length < 12) continue;
    commit(pts);
    lines.push(pts);
    // offer new seeds perpendicular to this line, both sides
    const stride = Math.max(1, Math.round(dsep / 0.004));
    for (let i = stride; i < pts.length - 1; i += stride) {
      const a = pts[i - 1], b = pts[i + 1];
      const tx = b[0] - a[0], ty = b[1] - a[1];
      const L = Math.hypot(tx, ty) || 1;
      const nx = -ty / L, ny = tx / L;
      queue.push([pts[i][0] + nx * dsep, pts[i][1] + ny * dsep]);
      queue.push([pts[i][0] - nx * dsep, pts[i][1] - ny * dsep]);
    }
  }
  return lines;
}
