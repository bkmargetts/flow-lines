import type { Point } from '../flow-lines.js';

/**
 * Separation relaxation, adapted from the ribbons module: two hoses running
 * parallel closer than the sum of their radii (plus clearance) is physically
 * impossible — and it's exactly what lets a crossing occluder graze a
 * neighbour's edge lengthwise and shave it off. Points with a near-PARALLEL
 * foreign neighbour inside the pair's separation get pushed apart;
 * transversal proximity (a genuine crossing) is left for the weave.
 *
 * Differences from the ribbons original: open-path indexing (no wrap), the
 * minimum separation is per-pair (rA + rB + clearance — hoses have mixed
 * diameters), and each hose's first/last few points are pinned so edge exits
 * keep their off-page overshoot and cuff mouths keep their placement margin.
 */

const PIN = 3;

export function separateHoses(
  strands: Point[][],
  radii: number[],
  clearance: number,
  iterations: number
): void {
  let maxR = 0;
  for (const r of radii) maxR = Math.max(maxR, r);
  const cellSize = Math.max(4, 2 * maxR + clearance);
  const tangentOf = (pts: Point[], i: number): Point => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  };

  for (let it = 0; it < iterations; it++) {
    // Rebuild the hash each pass — points move.
    const buckets = new Map<string, [number, number][]>();
    for (let k = 0; k < strands.length; k++) {
      const pts = strands[k];
      for (let i = 0; i < pts.length; i++) {
        const key = `${Math.floor(pts[i].x / cellSize)},${Math.floor(pts[i].y / cellSize)}`;
        let arr = buckets.get(key);
        if (!arr) {
          arr = [];
          buckets.set(key, arr);
        }
        arr.push([k, i]);
      }
    }

    for (let k = 0; k < strands.length; k++) {
      const pts = strands[k];
      const n = pts.length;
      const stepLen = Math.max(1, approxStep(pts));
      const selfSep = 2 * radii[k] + clearance;
      const sameStrandGap = Math.ceil((0.75 * selfSep) / stepLen) + 4;

      // Pass 1: nearest near-parallel foreign neighbour per point — distance,
      // which side it sits on, and the would-be push.
      const dist = new Float64Array(n).fill(Infinity);
      const deficit = new Float64Array(n).fill(-Infinity);
      const side = new Int8Array(n);
      const pushX = new Float64Array(n);
      const pushY = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const t = tangentOf(pts, i);
        const cxx = Math.floor(p.x / cellSize);
        const cyy = Math.floor(p.y / cellSize);
        for (let gy = cyy - 1; gy <= cyy + 1; gy++) {
          for (let gx = cxx - 1; gx <= cxx + 1; gx++) {
            const arr = buckets.get(`${gx},${gy}`);
            if (!arr) continue;
            for (const [fk, fi] of arr) {
              const minSep = fk === k ? selfSep : radii[k] + radii[fk] + clearance;
              if (fk === k && Math.abs(fi - i) <= sameStrandGap) continue;
              const q = strands[fk][fi];
              const dx = p.x - q.x;
              const dy = p.y - q.y;
              const d = Math.hypot(dx, dy);
              if (d >= minSep || d < 1e-6) continue;
              // With per-pair separations, "nearest" is the deepest
              // violation, not the smallest distance.
              if (minSep - d <= deficit[i]) continue;
              const ft = tangentOf(strands[fk], fi);
              if (Math.abs(t.x * ft.x + t.y * ft.y) < 0.8) continue; // transversal
              dist[i] = d;
              deficit[i] = minSep - d;
              side[i] = t.x * dy - t.y * dx > 0 ? 1 : -1;
              const w = (minSep - d) / d;
              pushX[i] = dx * w * 0.35;
              pushY[i] = dy * w * 0.35;
            }
          }
        }
      }

      // Pass 2: repel only pure grazes. A side flip in the neighbourhood
      // means the pair genuinely crosses there — separation would just fight
      // the topology and shake the strand into wiggles; the occluder pass
      // owns crossings.
      const W = Math.max(3, Math.ceil(selfSep / (4 * stepLen)));
      const apX = new Float64Array(n);
      const apY = new Float64Array(n);
      for (let i = PIN; i < n - PIN; i++) {
        if (!isFinite(dist[i])) continue;
        let flip = false;
        for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W) && !flip; j++) {
          if (isFinite(dist[j]) && side[j] !== side[i]) flip = true;
        }
        if (flip) continue;
        // The raw push magnitude is (minSep−d)/d — it explodes as d→0, and
        // one giant displacement is a guaranteed kink. Deep violations get
        // out over a few iterations instead.
        const m = Math.hypot(pushX[i], pushY[i]);
        const cap = 0.6 * stepLen + 1.5;
        const sc = m > cap ? cap / m : 1;
        apX[i] = pushX[i] * sc;
        apY[i] = pushY[i] * sc;
      }
      // Smooth the applied-push field along the strand (two 1-2-1 passes):
      // per-point independent pushes — neighbours pushed by different
      // foreign strands, or a mask boundary switching the push off — write
      // a sawtooth into the centerline that the curvature clamp then has
      // to fight point by point. A coherent push field bends instead of
      // kinking.
      for (let pass = 0; pass < 2; pass++) {
        let prevX = apX[0];
        let prevY = apY[0];
        for (let i = 1; i < n - 1; i++) {
          const curX = apX[i];
          const curY = apY[i];
          apX[i] = 0.25 * prevX + 0.5 * curX + 0.25 * apX[i + 1];
          apY[i] = 0.25 * prevY + 0.5 * curY + 0.25 * apY[i + 1];
          prevX = curX;
          prevY = curY;
        }
      }
      for (let i = PIN; i < n - PIN; i++) {
        pts[i].x += apX[i];
        pts[i].y += apY[i];
      }
    }
  }
}

function approxStep(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len / Math.max(1, pts.length - 1);
}

/**
 * Post-relaxation curvature clamp: the pushes are unbounded in principle and
 * can locally re-tighten a bend past the growth cap, which would fold the
 * ±r edge offsets into cusps. Vertices whose turn exceeds the cap are eased
 * toward their neighbours' midpoint; a couple of sweeps settles it.
 */
/**
 * Hard curvature enforcement by turn redistribution: walk the polyline,
 * clamp each vertex's heading change to the cap, and carry the excess
 * turn into the following vertices until it is spent. Total winding is
 * preserved, so nothing downstream rotates — a spike relaxes into a legal
 * arc in place. The tiny endpoint drift that remains is folded back as a
 * linear ramp along the arc (which adds ~zero curvature), keeping exits
 * and cuff mouths exactly where they were placed.
 *
 * This exists because the eased-midpoint clamp below is curve-shortening
 * flow: enough sweeps to kill a hard spike also contract the section into
 * a hairball. Redistribution cannot contract — segment lengths are kept.
 */
export function enforceCurvature(pts: Point[], kappaMax: number): void {
  const n = pts.length;
  if (n < 3) return;
  const lens = new Float64Array(n - 1);
  const heads = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    lens[i] = Math.hypot(dx, dy);
    heads[i] = Math.atan2(dy, dx);
  }
  const endX = pts[n - 1].x;
  const endY = pts[n - 1].y;
  const wrap = (a: number): number => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };
  // Clamped heading pursuit: the rebuilt heading chases the original
  // per-segment headings at a bounded turn rate. After a clamp the lag
  // θ−heads carries the un-spent excess implicitly, so the following
  // vertices keep turning at the cap until the path realigns — the spike
  // relaxes into a legal arc and the downstream shape is untouched.
  let theta = heads[0];
  let x = pts[0].x + Math.cos(theta) * lens[0];
  let y = pts[0].y + Math.sin(theta) * lens[0];
  pts[1].x = x;
  pts[1].y = y;
  for (let i = 1; i < n - 1; i++) {
    const want = wrap(heads[i] - theta);
    const maxTurn = kappaMax * ((lens[i - 1] + lens[i]) / 2);
    const d = Math.max(-maxTurn, Math.min(maxTurn, want));
    theta += d;
    x += Math.cos(theta) * lens[i];
    y += Math.sin(theta) * lens[i];
    pts[i + 1].x = x;
    pts[i + 1].y = y;
  }
  const ex = endX - x;
  const ey = endY - y;
  let total = 0;
  for (let i = 0; i < n - 1; i++) total += lens[i];
  if (total > 1e-9) {
    let acc = 0;
    for (let i = 1; i < n; i++) {
      acc += lens[i - 1];
      pts[i].x += (ex * acc) / total;
      pts[i].y += (ey * acc) / total;
    }
  }
}

export function clampCurvature(pts: Point[], kappaMax: number, sweeps: number): void {
  for (let s = 0; s < sweeps; s++) {
    for (let i = 1; i < pts.length - 1; i++) {
      const ax = pts[i].x - pts[i - 1].x;
      const ay = pts[i].y - pts[i - 1].y;
      const bx = pts[i + 1].x - pts[i].x;
      const by = pts[i + 1].y - pts[i].y;
      const la = Math.hypot(ax, ay);
      const lb = Math.hypot(bx, by);
      if (la < 1e-9 || lb < 1e-9) continue;
      const cross = ax * by - ay * bx;
      const dot = ax * bx + ay * by;
      const turn = Math.abs(Math.atan2(cross, dot));
      const maxTurn = kappaMax * ((la + lb) / 2);
      if (turn <= maxTurn) continue;
      pts[i].x = pts[i].x * 0.5 + (pts[i - 1].x + pts[i + 1].x) * 0.25;
      pts[i].y = pts[i].y * 0.5 + (pts[i - 1].y + pts[i + 1].y) * 0.25;
    }
  }
}
