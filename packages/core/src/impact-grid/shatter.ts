import type { Point } from '../flow-lines.js';

/**
 * Sutherland–Hodgman against a single half-plane: keep the part of the closed
 * convex ring on the `(p - a) · n <= 0` side, interpolating crossing points.
 * Input and output rings repeat the first point at the end. A convex input
 * stays convex, so repeated chord splits only ever produce convex fragments.
 */
export function clipHalfPlane(poly: Point[], a: Point, n: Point): Point[] {
  if (poly.length < 4) return [];
  const open = poly.slice(0, -1);
  const out: Point[] = [];
  for (let i = 0; i < open.length; i++) {
    const p = open[i];
    const q = open[(i + 1) % open.length];
    const dp = (p.x - a.x) * n.x + (p.y - a.y) * n.y;
    const dq = (q.x - a.x) * n.x + (q.y - a.y) * n.y;
    if (dp <= 0) out.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  if (out.length < 3) return [];
  return [...out, { x: out[0].x, y: out[0].y }];
}

/** Shoelace area of a closed ring (absolute). */
export function ringArea(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    sum += poly[i].x * poly[i + 1].y - poly[i + 1].x * poly[i].y;
  }
  return Math.abs(sum) / 2;
}

function centroidOf(poly: Point[]): Point {
  let x = 0;
  let y = 0;
  const n = poly.length - 1;
  for (let i = 0; i < n; i++) {
    x += poly[i].x;
    y += poly[i].y;
  }
  return { x: x / n, y: y / n };
}

export interface FragmentOptions {
  /** Damage at the parent cell's centre (0..1). */
  f: number;
  /** Parent centre displacement — fragments inherit it before drifting. */
  dx: number;
  dy: number;
  radius: number;
  shatter: number;
  scatter: number;
  debris: number;
  /** 0..1 rubble fineness — subdivision depth, scaled up near the line. */
  crush: number;
  /** 0..1 drift along the line's direction of travel; also how hard the
   *  channel itself is swept clean. */
  sweep: number;
  /** Path tangent (unit, direction of travel) at the nearest point. */
  tx: number;
  ty: number;
  /** Which side of the path the parent cell sits on (±1) — the side debris
   *  escapes the channel toward. */
  side: number;
  /** Radial direction from the epicentre (unit) — glass slivers elongate
   *  along this. */
  rx: number;
  ry: number;
  /** Half-width of the swept-clean channel, px. */
  channel: number;
  /** Distance from the parent centre to the path, px. */
  d: number;
  /** True in the dust zone: finer cuts, smaller survivors, more loss. */
  dust: boolean;
  /** 0..1 downstream of the strike — the cascade cone widens with it. */
  cone: number;
  penWidth: number;
}

/**
 * Break one cell into convex shards and carry them off along the stroke:
 * 1..N chords split the cell (deeper near the line), then each shard drifts
 * predominantly ALONG the path's direction of travel — far enough, inside
 * the channel, to vacate it entirely (the line wipes its path clean, debris
 * cascades down the flow and piles along the flanks). Shards shear toward
 * the flow direction; the innermost may be pulverised away.
 */
export function shatterCell(
  cell: Point[],
  extent: number,
  o: FragmentOptions,
  rng: () => number
): Point[][] {
  const cuts = Math.max(
    1,
    Math.min(7, 1 + (o.dust ? 2 : 0) + Math.floor(o.crush * (1.5 + 2.5 * o.f) + rng() * 0.5))
  );
  let fragments: Point[][] = [cell];
  const centre = centroidOf(cell);
  const radialAngle = Math.atan2(o.ry, o.rx);
  // Near the channel the material smears along the stroke — slivers run
  // with the flow (motion streaks); farther out, glass breaks radially
  // from the strike.
  const primaryAngle = o.d < o.radius * 0.8 ? Math.atan2(o.ty, o.tx) : radialAngle;
  for (let c = 0; c < cuts; c++) {
    const px = centre.x + (2 * rng() - 1) * 0.5 * extent;
    const py = centre.y + (2 * rng() - 1) * 0.5 * extent;
    // Most cuts run along the primary direction (long thin slivers), the
    // rest cross them.
    const alpha =
      rng() < 0.6
        ? primaryAngle + (2 * rng() - 1) * (Math.PI / 12)
        : primaryAngle + Math.PI / 2 + (2 * rng() - 1) * (Math.PI / 6);
    const n = { x: -Math.sin(alpha), y: Math.cos(alpha) };
    const next: Point[][] = [];
    for (const frag of fragments) {
      const a = clipHalfPlane(frag, { x: px, y: py }, n);
      const b = clipHalfPlane(frag, { x: px, y: py }, { x: -n.x, y: -n.y });
      if (a.length >= 4) next.push(a);
      if (b.length >= 4) next.push(b);
    }
    fragments = next;
  }

  const minArea = o.dust
    ? (1.2 * o.penWidth) * (1.2 * o.penWidth)
    : (2 * o.penWidth) * (2 * o.penWidth);
  const debris = o.dust ? Math.min(1, o.debris + 0.35) : o.debris;
  const out: Point[][] = [];
  for (const frag of fragments) {
    if (ringArea(frag) < minArea) continue;
    // Pulverised: the closest shards lose mass entirely — though some leave
    // a tiny speck of litter where they would have landed.
    if ((o.dust || o.d < o.channel) && rng() < debris * Math.max(o.f, 0.6)) {
      if (rng() < 0.5) {
        // Litter trails DOWN the wake: heavy-tailed distance along the
        // travel direction with a slight sideways escape off the channel —
        // the graded confetti thinning downstream of the reference strokes.
        const g0 = centroidOf(frag);
        const rr = rng();
        const along = o.sweep * o.radius * (0.15 + 0.85 * rr * rr);
        const aside = o.side * (o.channel * 0.6 + 0.2 * o.scatter * o.radius * rng());
        const sx = g0.x + o.tx * along - o.ty * aside;
        const sy = g0.y + o.ty * along + o.tx * aside;
        const r = o.penWidth * (0.5 + 0.6 * rng());
        const a0 = rng() * Math.PI * 2;
        out.push([
          { x: sx + r * Math.cos(a0), y: sy + r * Math.sin(a0) },
          { x: sx + r * Math.cos(a0 + 2.3), y: sy + r * Math.sin(a0 + 2.3) },
          { x: sx + r * Math.cos(a0 + 4.4), y: sy + r * Math.sin(a0 + 4.4) },
          { x: sx + r * Math.cos(a0), y: sy + r * Math.sin(a0) },
        ]);
      }
      continue;
    }
    const g = centroidOf(frag);
    // Drift along the direction of travel — heavy-tailed so the cascade
    // spreads: most shards travel a moderate way, a few fly far.
    const r1 = rng();
    let drift = o.sweep * o.radius * Math.pow(o.f, 1.5) * (0.2 + 0.8 * r1 * r1);
    if (o.dust) drift *= 1.4;
    // Channel clearing: shards born inside the channel escape SIDEWAYS to
    // just past its rim — so cleared material piles up along the flanks in
    // a bow-wave instead of streaming down the pipe.
    const rim = o.d < o.channel ? (o.channel - o.d) * (1.05 + 0.55 * rng()) : 0;
    // The cascade also sprays radially from the strike, dust hardest, and
    // the cone widens downstream of the impact — an explosion, not a pipe.
    const spread =
      (o.dust ? 0.45 : 0.3) * (1 + 0.9 * o.cone) * o.scatter * o.radius * o.f * o.f * rng();
    const gx = g.x + o.dx + drift * o.tx - rim * o.side * o.ty + spread * o.rx;
    const gy = g.y + o.dy + drift * o.ty + rim * o.side * o.tx + spread * o.ry;
    // Shear toward the flow: shards leave aligned with the sweep — the
    // random spin stays small so the debris reads as motion, not tumble.
    const flowAngle = Math.atan2(o.ty, o.tx);
    const shearTo = ((flowAngle % Math.PI) + Math.PI) % Math.PI;
    const spin =
      (shearTo - Math.PI / 2) * 0.5 * o.sweep * o.f +
      (2 * rng() - 1) * ((10 + 26 * o.shatter) * Math.PI / 180) * o.f;
    const cosR = Math.cos(spin);
    const sinR = Math.sin(spin);
    const shrink = 0.95 - 0.1 * o.f;
    // Near the channel, shards stretch along the travel direction and thin
    // across it — the smeared slivers of the reference plates.
    const streak = o.d < o.radius * 0.8 ? o.sweep * o.f : 0;
    const et = 1 + 0.35 * streak;
    const en = 1 - 0.22 * streak;
    out.push(
      frag.map((p) => {
        const lx = (p.x - g.x) * shrink;
        const ly = (p.y - g.y) * shrink;
        const tc = (lx * o.tx + ly * o.ty) * et;
        const nc = (-lx * o.ty + ly * o.tx) * en;
        const sx = tc * o.tx - nc * o.ty;
        const sy = tc * o.ty + nc * o.tx;
        return { x: gx + sx * cosR - sy * sinR, y: gy + sx * sinR + sy * cosR };
      })
    );
  }
  return out;
}
