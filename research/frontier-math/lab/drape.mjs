// DRAPE — Chebyshev nets and the 2π obstruction.
//
// A Chebyshev net is a mesh of INEXTENSIBLE threads: every edge has the same
// length, in both families. It is the mathematical model of woven cloth, which
// cannot stretch along its warp or weft but can freely shear between them.
//
// The whole visual content is that shear. Let ω be the angle between the two
// thread families. On a curved surface ω obeys
//
//        ∂²ω / ∂u ∂v  =  −K sin ω
//
// so curvature FORCES the net to shear, and where ω closes up the threads bunch:
// local density goes as 1/sin ω. That is tone the geometry computes — nothing
// here shades anything.
//
// And it has a hard event. By the Hazzidakis formula the total curvature a
// single Chebyshev quad can absorb is bounded:
//
//        ∬_R K dA  =  ω₀₀ − ω_u0 − ω_0v + ω_uv   ∈  (−2π, 2π)
//
// Past 2π of enclosed curvature no Chebyshev net exists at all — a real cloth
// tears or must fold. The net does not degrade gracefully; it stops.
//
// DISCRETE CONSTRUCTION. In the plane the discrete condition is exactly the
// parallelogram rule: given three corners of a quad,
//     P(i+1,j+1) = P(i+1,j) + P(i,j+1) − P(i,j)
// preserves both edge lengths identically, so a planar net is fixed entirely by
// its two boundary threads and is FLAT — zero curvature, and therefore no
// shear worth drawing. The curvature has to come from somewhere, so the net is
// draped over a height field z = f(x,y) and drawn in plan view: the
// parallelogram guess is projected back onto the surface and corrected until
// both edge lengths are restored. Where the correction cannot converge, the
// net has run out of shear — that node is a tear, and tears are drawn.
import { rng } from './lab.mjs';

/** A relief of Gaussian domes and hollows — the curvature the net must absorb. */
export function makeRelief({ bumps = 5, seed = 1, W = 1, H = 1, amp = 0.22, radius = 0.2, cones = 0, coneSlope = 1.1 }) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < bumps; i++) {
    list.push({
      x: (0.15 + 0.7 * r()) * W,
      y: (0.15 + 0.7 * r()) * H,
      a: amp * (0.5 + r()) * (r() < 0.3 ? -1 : 1),
      s: radius * (0.6 + 0.8 * r()) * Math.min(W, H),
    });
  }
  // Cone points concentrate curvature into a single vertex instead of spreading
  // it smoothly: all of a cone's Gauss curvature sits at its apex as an atom of
  // angle deficit. That is what can actually exceed the Hazzidakis 2*pi bound
  // and force the net to tear — a smooth dome never does.
  const coneList = [];
  for (let i = 0; i < cones; i++) {
    coneList.push({ x: (0.25 + 0.5 * r()) * W, y: (0.25 + 0.5 * r()) * H, a: coneSlope * (r() < 0.5 ? -1 : 1) });
  }
  const f = (x, y) => {
    let z = 0;
    for (const b of list) {
      const d2 = (x - b.x) ** 2 + (y - b.y) ** 2;
      z += b.a * Math.exp(-d2 / (2 * b.s * b.s));
    }
    for (const c of coneList) {
      z += c.a * Math.hypot(x - c.x, y - c.y);
    }
    return z;
  };
  return { f, bumps: list, cones: coneList };
}

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);

/**
 * Place the fourth corner of a Chebyshev quad on the surface: start from the
 * planar parallelogram guess, drop it onto z = f(x,y), then Newton-correct in
 * the xy-plane until both edges are back to length h. Returns null when it will
 * not converge — the net has run out of shear there.
 */
function fourthCorner(f, p, a, b, h, iters = 24) {
  // planar guess, lifted to the surface
  let x = a[0] + b[0] - p[0];
  let y = a[1] + b[1] - p[1];
  for (let it = 0; it < iters; it++) {
    const q = [x, y, f(x, y)];
    const da = len3(sub3(q, a)) - h;
    const db = len3(sub3(q, b)) - h;
    if (Math.abs(da) < 1e-6 * h && Math.abs(db) < 1e-6 * h) return q;
    // numerical Jacobian of (|q-a|, |q-b|) in (x, y)
    const e = h * 1e-4;
    const gx = [x + e, y, f(x + e, y)];
    const gy = [x, y + e, f(x, y + e)];
    const j11 = (len3(sub3(gx, a)) - h - da) / e;
    const j12 = (len3(sub3(gy, a)) - h - da) / e;
    const j21 = (len3(sub3(gx, b)) - h - db) / e;
    const j22 = (len3(sub3(gy, b)) - h - db) / e;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-12) return null;
    x -= (j22 * da - j12 * db) / det;
    y -= (-j21 * da + j11 * db) / det;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  }
  return null;
}

/**
 * Drape a Chebyshev net over the relief from a seed corner, marching outward.
 * Returns the node grid (nulls where the net tore) plus the shear angle at each
 * node — the quantity the drawing's tone comes from.
 */
export function drapeNet({ f, n = 60, h = 0.02, origin = [0.5, 0.5], angle = 0, spread = Math.PI / 2 }) {
  const P = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(null));
  const o = [origin[0], origin[1], f(origin[0], origin[1])];
  P[0][0] = o;
  // The two boundary threads: geodesic-ish walks, stepped on the surface.
  const march = (dir) => {
    const out = [o];
    let cur = o;
    for (let i = 1; i <= n; i++) {
      let x = cur[0] + h * Math.cos(dir);
      let y = cur[1] + h * Math.sin(dir);
      for (let it = 0; it < 20; it++) {
        const q = [x, y, f(x, y)];
        const d = len3(sub3(q, cur)) - h;
        if (Math.abs(d) < 1e-7) break;
        const s = 1 - d / Math.max(1e-9, len3(sub3(q, cur)));
        x = cur[0] + (x - cur[0]) * s;
        y = cur[1] + (y - cur[1]) * s;
      }
      cur = [x, y, f(x, y)];
      out.push(cur);
    }
    return out;
  };
  const rowU = march(angle);
  const rowV = march(angle + spread);
  for (let i = 0; i <= n; i++) P[i][0] = rowU[i];
  for (let j = 0; j <= n; j++) P[0][j] = rowV[j];

  let tears = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= n; j++) {
      const p = P[i - 1][j - 1];
      const a = P[i][j - 1];
      const b = P[i - 1][j];
      if (!p || !a || !b) { P[i][j] = null; continue; }
      const q = fourthCorner(f, p, a, b, h);
      if (!q) { P[i][j] = null; tears++; continue; }
      P[i][j] = q;
    }
  }

  // Shear angle at each node — density in the drawing goes as 1/sin(omega).
  const omega = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(NaN));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = P[i][j], a = P[i + 1][j], b = P[i][j + 1];
      if (!p || !a || !b) continue;
      const u = sub3(a, p), v = sub3(b, p);
      const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      omega[i][j] = Math.acos(Math.max(-1, Math.min(1, dot / (len3(u) * len3(v)))));
    }
  }
  return { P, omega, n, tears };
}

/** Both thread families in plan view, as page-space polylines. */
export function netLines({ P, n }, { W, H, margin = 0, scale = 1, ox = 0, oy = 0 }) {
  const lines = [];
  const map = (q) => ({ x: margin + (q[0] * scale + ox) * (W - 2 * margin), y: margin + (q[1] * scale + oy) * (H - 2 * margin) });
  const push = (run) => { if (run.length > 1) lines.push({ points: run.map(map) }); };
  for (let i = 0; i <= n; i++) {
    let run = [];
    for (let j = 0; j <= n; j++) {
      if (P[i][j]) run.push(P[i][j]);
      else { push(run); run = []; }
    }
    push(run);
  }
  for (let j = 0; j <= n; j++) {
    let run = [];
    for (let i = 0; i <= n; i++) {
      if (P[i][j]) run.push(P[i][j]);
      else { push(run); run = []; }
    }
    push(run);
  }
  return lines;
}
