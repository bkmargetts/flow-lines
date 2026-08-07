import { FlowLine, Point } from '../flow-lines.js';
import { hatchPolygon } from '../hearts/heart.js';
import { emitStroke, Craft } from '../landscape/hatching.js';
import { pointInPolygon } from '../lib/polyline.js';
import { createNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { Region } from './layout.js';

/** Safety valve per region — a hostile spacing knob must not hang the page. */
const REGION_LINE_CAP = 40000;

/** Uncapped densify: background lines span the whole sheet, and the
 *  hand-drawn pass needs samples every few px along them (the landscape
 *  `densifySegment` caps at 40 points, which starves wobble on long runs). */
function densify(a: Point, b: Point, step: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.round(len / step));
  const pts: Point[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts[i] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return pts;
}

function push(out: FlowLine[], points: Point[]): void {
  if (out.length >= REGION_LINE_CAP) return;
  if (points.length >= 2) out.push({ points });
}

/** Fill result: `ink` is drawn; `phantom` only joins the avoid union so a
 *  'blank' band still reserves its paper against deeper layers. */
export interface RegionFill {
  ink: FlowLine[];
  phantom: FlowLine[];
}

/** Split one straight hatch run by a predicate sampled every `step` px,
 *  emitting kept sub-runs through `emit`. `edgeBand` always keeps the run's
 *  first and last stretch — run ends sit on the polygon boundary, and holes
 *  eating into the silhouette would shred the crisp seam edge that the whole
 *  layered look depends on. Used by the patchy gate and the cross-hatch's
 *  second family. */
function gatedRun(
  a: Point,
  b: Point,
  step: number,
  keep: (x: number, y: number) => boolean,
  minLen: number,
  edgeBand: number,
  emit: (s: Point, e: Point) => void
): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-6) return;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const n = Math.max(1, Math.ceil(len / step));
  let runStart: number | null = null;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    const x = a.x + ux * t;
    const y = a.y + uy * t;
    if (t < edgeBand || t > len - edgeBand || keep(x, y)) {
      if (runStart === null) runStart = t;
    } else if (runStart !== null) {
      if (t - runStart >= minLen) {
        emit({ x: a.x + ux * runStart, y: a.y + uy * runStart }, { x, y });
      }
      runStart = null;
    }
  }
  if (runStart !== null && len - runStart >= minLen) {
    emit({ x: a.x + ux * runStart, y: a.y + uy * runStart }, b);
  }
}

/**
 * Fill one region's polygon with its resolved texture. All strokes come back
 * with no layer tag — the carve pass assigns pens after clipping, so the
 * interleave counter only counts strokes that survive.
 */
export function fillRegion(region: Region): RegionFill {
  const t = region.tex;
  const poly = region.poly;
  const rng = makeRandom(t.seed);
  const noise = createNoise(subSeed(t.seed, 1));
  const ink: FlowLine[] = [];
  const step = 6;

  // The patchy gate: hand-sized low-frequency holes (the landscape
  // makePatchMask idiom — a floor keeps the holes hand-sized even at very
  // tight pitch, or they shrink to stroke-sized flecks that read as
  // dropout, not mottling).
  const patchScale = Math.max(24, t.spacing * 16);
  const patchCut = -1 + t.patchiness * 1.6;
  const patchKeep = (x: number, y: number): boolean =>
    noise.noise2D(x / patchScale, y / patchScale) > patchCut;

  const craft: Craft = { rng, taper: 0.45, jitter: 0.012, subStep: step };
  const emitTapered = (a: Point, b: Point): void => {
    if (ink.length >= REGION_LINE_CAP) return;
    emitStroke(ink, a, b, '', craft);
  };

  // Long ruled lines break into hand-fed dashes with small pen-lift gaps
  // at irregular heights (the reference's airy background field); short
  // runs — a core band, sliver spans — stay whole. Shared by 'lines' and
  // the contour fallback on regions with no silhouette geometry.
  const fillLines = (): void => {
    const dashMin = t.spacing * 22;
    for (const run of hatchPolygon(poly, t.angleRad, t.spacing, t.phase)) {
      const len = Math.hypot(run[1].x - run[0].x, run[1].y - run[0].y);
      if (len <= dashMin) {
        push(ink, densify(run[0], run[1], step));
        continue;
      }
      const ux = (run[1].x - run[0].x) / len;
      const uy = (run[1].y - run[0].y) / len;
      let s = 0;
      let guard = 0;
      while (s < len - 2 && guard++ < 200) {
        const e = Math.min(len, s + t.spacing * (14 + 18 * rng()));
        push(
          ink,
          densify(
            { x: run[0].x + ux * s, y: run[0].y + uy * s },
            { x: run[0].x + ux * e, y: run[0].y + uy * e },
            step
          )
        );
        s = e + 1.8 + rng() * 2;
      }
    }
  };

  // The 'lines' hand-fed dashing applied to an arbitrary polyline: walk the
  // arc length, lift the pen briefly at irregular intervals. Closed loops
  // start at a seeded phase so the lift gaps don't stack radially across
  // nested contour loops.
  const dashPolyline = (pts: Point[], closed: boolean): void => {
    if (pts.length < 2) return;
    const cum: number[] = new Array(pts.length);
    cum[0] = 0;
    for (let i = 1; i < pts.length; i++) {
      cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    const total = cum[pts.length - 1];
    if (total <= t.spacing * 22) {
      push(ink, pts);
      return;
    }
    // Slice the arc-length window [sa, sb] out of the polyline.
    const at = (s: number): Point => {
      let i = 1;
      while (i < pts.length - 1 && cum[i] < s) i++;
      const span = cum[i] - cum[i - 1] || 1;
      const f = (s - cum[i - 1]) / span;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
      };
    };
    const slice = (sa: number, sb: number): Point[] => {
      const out: Point[] = [at(sa)];
      for (let i = 0; i < pts.length; i++) {
        if (cum[i] > sa && cum[i] < sb) out.push(pts[i]);
      }
      out.push(at(sb));
      return out;
    };
    const phase = closed ? total * rng() : 0;
    let s = 0;
    let guard = 0;
    while (s < total - 2 && guard++ < 200) {
      const e = Math.min(total, s + t.spacing * (14 + 18 * rng()));
      const sa = (s + phase) % total;
      const sb = (e + phase) % total;
      if (sa < sb) {
        push(ink, slice(sa, sb));
      } else {
        // The phase-shifted dash wraps the loop seam: emit both halves.
        if (total - sa > 2) push(ink, slice(sa, total));
        if (sb > 2) push(ink, slice(0, sb));
      }
      s = e + 1.8 + rng() * 2;
    }
  };

  switch (t.kind) {
    case 'blank': {
      // Coarse phantom coverage: sampled tighter than the halo radius so the
      // disc-stamped mask is solid across the whole band.
      const phantom = hatchPolygon(poly, t.angleRad, Math.max(2, t.spacing), 0.5).map(
        (run): FlowLine => ({ points: run })
      );
      return { ink: [], phantom };
    }

    case 'lines': {
      fillLines();
      break;
    }

    case 'contour': {
      // Concentric banding: loops that follow the region's own silhouette —
      // the fortification-agate mark. Offsets happen in table space, where an
      // inward offset of these star-shaped blobs can never self-intersect;
      // near the core, partially collapsed loops surface as open crescents,
      // exactly how real agate banding closes out. Regions without silhouette
      // geometry (the background field) fall back to ruled lines.
      const pitch = t.spacing;
      const lambda = Math.max(36, pitch * 16);
      // Waviness cap stays below half the pitch so neighbouring loops never
      // touch; one shared page-space field keeps them undulating together.
      const amp = t.waviness * Math.min(pitch * 0.35, lambda * 0.1);
      const wave = (pts: Point[], dir: (p: Point) => Point): Point[] =>
        amp <= 0
          ? pts
          : pts.map((p) => {
              const d = amp * noise.fbm(p.x / lambda, p.y / lambda, 2, 0.5, 2);
              const u = dir(p);
              return { x: p.x + u.x * d, y: p.y + u.y * d };
            });
      const densifyRun = (pts: Point[]): Point[] => {
        const out: Point[] = [];
        for (let i = 1; i < pts.length; i++) {
          const seg = densify(pts[i - 1], pts[i], 4);
          if (out.length > 0) seg.shift();
          out.push(...seg);
        }
        return out;
      };

      if (region.radial) {
        const { cx, cy, rx, ry, table } = region.radial;
        const n = table.length;
        const baseLen = new Float64Array(n);
        let maxR = 0;
        for (let j = 0; j < n; j++) {
          const theta = (j / n) * Math.PI * 2;
          baseLen[j] = Math.hypot(Math.cos(theta) * rx, Math.sin(theta) * ry) || 1e-6;
          maxR = Math.max(maxR, table[j] * baseLen[j]);
        }
        const radialDir = (p: Point): Point => {
          const len = Math.hypot(p.x - cx, p.y - cy) || 1;
          return { x: (p.x - cx) / len, y: (p.y - cy) / len };
        };
        const pointAt = (j: number, inset: number): Point => {
          const theta = (j / n) * Math.PI * 2;
          const g = table[j] - inset / baseLen[j];
          return { x: cx + Math.cos(theta) * rx * g, y: cy + Math.sin(theta) * ry * g };
        };
        const maxLoops = Math.ceil(maxR / pitch);
        for (let k = 1; k <= maxLoops && ink.length < REGION_LINE_CAP; k++) {
          const inset = k * pitch;
          const alive: boolean[] = new Array(n);
          let anyAlive = false;
          let allAlive = true;
          for (let j = 0; j < n; j++) {
            alive[j] = table[j] * baseLen[j] - inset >= pitch * 0.5;
            anyAlive ||= alive[j];
            allAlive &&= alive[j];
          }
          if (!anyAlive) break;
          if (allAlive) {
            const pts: Point[] = [];
            for (let j = 0; j < n; j++) pts.push(pointAt(j, inset));
            pts.push({ ...pts[0] });
            dashPolyline(wave(densifyRun(pts), radialDir), true);
            continue;
          }
          // Contiguous alive arcs (circular): each surfaces as an open run.
          for (let j = 0; j < n; j++) {
            if (!alive[j] || alive[(j - 1 + n) % n]) continue;
            const arc: Point[] = [];
            for (let m = j; alive[m % n] && arc.length < n; m++) {
              arc.push(pointAt(m % n, inset));
            }
            if (arc.length >= 3) dashPolyline(wave(densifyRun(arc), radialDir), false);
          }
        }
        break;
      }

      if (region.strataBand) {
        // Onion-skin lamination between the band's bounding curves: interior
        // curves only — the boundaries themselves are the seam edges.
        const { top, bottom } = region.strataBand;
        let gap = 0;
        for (let i = 0; i < top.length; i++) gap += bottom[i].y - top[i].y;
        gap /= top.length;
        const rows = Math.max(1, Math.round(gap / pitch));
        const down = (): Point => ({ x: 0, y: 1 });
        for (let r = 1; r < rows && ink.length < REGION_LINE_CAP; r++) {
          const f = r / rows;
          const pts = top.map((p, i) => ({
            x: p.x,
            y: p.y + (bottom[i].y - p.y) * f,
          }));
          dashPolyline(wave(densifyRun(pts), down), false);
        }
        break;
      }

      fillLines();
      break;
    }

    case 'crystal': {
      // Druzy lining: tapered rays radiating from the region centre toward
      // the silhouette, with jittered reach — the length scatter is the
      // sparkle. On a non-innermost band the carve clips the fan's middle
      // out, leaving spikes fringing the annulus wall for free. Regions
      // without silhouette geometry fall back to ruled lines.
      if (!region.radial) {
        fillLines();
        break;
      }
      const { cx, cy, rx, ry, table } = region.radial;
      const n = table.length;
      let rAvg = 0;
      for (let j = 0; j < n; j++) {
        const theta = (j / n) * Math.PI * 2;
        rAvg += table[j] * Math.hypot(Math.cos(theta) * rx, Math.sin(theta) * ry);
      }
      rAvg /= n;
      const tableAt = (theta: number): number => {
        const f = ((theta / (Math.PI * 2)) * n + n) % n;
        const j = Math.floor(f);
        return table[j] + (table[(j + 1) % n] - table[j]) * (f - j);
      };
      const rays = Math.round(
        Math.min(600, Math.max(16, (Math.PI * 2 * rAvg) / (t.spacing * 1.15)))
      );
      for (let i = 0; i < rays && ink.length < REGION_LINE_CAP; i++) {
        const theta = ((i + (rng() - 0.5) * 0.6) / rays) * Math.PI * 2;
        const g = tableAt(theta);
        const ex = Math.cos(theta) * rx;
        const ey = Math.sin(theta) * ry;
        const s0 = g * (0.06 + 0.3 * rng());
        // Every ~4th ray reaches the wall so the band edge reads lined.
        const s1 = g * (i % 4 === 0 ? 0.97 : 0.55 + 0.4 * rng());
        if (s1 <= s0) continue;
        const tip = { x: cx + ex * s1, y: cy + ey * s1 };
        emitTapered({ x: cx + ex * s0, y: cy + ey * s0 }, tip);
        // Occasional chevron tip: the angular termination of a crystal face.
        if (rng() < 0.3) {
          const len = Math.hypot(ex, ey) * (s1 - s0) || 1;
          const ux = (ex * (s1 - s0)) / len;
          const uy = (ey * (s1 - s0)) / len;
          const wing = t.spacing * 0.8;
          const spreadA = (20 * Math.PI) / 180;
          const back = (a: number): Point => ({
            x: tip.x - (ux * Math.cos(a) - uy * Math.sin(a)) * wing,
            y: tip.y - (ux * Math.sin(a) + uy * Math.cos(a)) * wing,
          });
          push(ink, [back(spreadA), tip, back(-spreadA)]);
        }
      }
      break;
    }

    case 'hatch': {
      for (const run of hatchPolygon(poly, t.angleRad, t.spacing, t.phase)) {
        emitTapered(run[0], run[1]);
      }
      break;
    }

    case 'patchy': {
      const minLen = t.spacing * 1.5;
      const edge = t.spacing * 2.5;
      for (const run of hatchPolygon(poly, t.angleRad, t.spacing, t.phase)) {
        gatedRun(run[0], run[1], Math.min(8, patchScale / 4), patchKeep, minLen, edge, emitTapered);
      }
      break;
    }

    case 'cross': {
      for (const run of hatchPolygon(poly, t.angleRad, t.spacing, t.phase)) {
        emitTapered(run[0], run[1]);
      }
      // Second family at a shallow offset (a woven 90° grid reads mechanical),
      // lightly gated so the weave builds up in worked patches.
      const ang2 = t.angleRad + (32 * Math.PI) / 180;
      const gate = (x: number, y: number): boolean =>
        noise.noise2D(x / patchScale + 41.7, y / patchScale) > -1 + Math.max(0.25, t.patchiness) * 1.2;
      const minLen = t.spacing * 1.5;
      for (const run of hatchPolygon(poly, ang2, t.spacing * 1.25, 1 - t.phase)) {
        gatedRun(run[0], run[1], Math.min(8, patchScale / 4), gate, minLen, 0, emitTapered);
      }
      break;
    }

    case 'wavy': {
      // Deform first, clip after: the family is generated across the
      // polygon's bounding box, bent by ONE page-space fBm field (adjacent
      // lines wave coherently, like combed hair), and only then cut to the
      // silhouette — deforming clipped runs would fuzz the blob edge, and
      // the crisp silhouette is the whole point of the halo seam.
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      for (const p of poly) {
        if (p.x < bx0) bx0 = p.x;
        if (p.y < by0) by0 = p.y;
        if (p.x > bx1) bx1 = p.x;
        if (p.y > by1) by1 = p.y;
      }
      const box: Point[] = [
        { x: bx0, y: by0 },
        { x: bx1, y: by0 },
        { x: bx1, y: by1 },
        { x: bx0, y: by1 },
      ];
      // Amplitude rides the wavelength, not the pitch: tightly pitched wavy
      // lines still need visible waves (the reference's combed ring swings
      // several pitches wide), and one shared page-space field keeps
      // neighbours combing together.
      const lambda = Math.max(36, t.spacing * 16);
      const amp = t.waviness * lambda * 0.16;
      const minKeep = t.spacing * 0.8;
      for (const run of hatchPolygon(box, t.angleRad, t.spacing, t.phase)) {
        const base = densify(run[0], run[1], 4);
        const dx = run[1].x - run[0].x;
        const dy = run[1].y - run[0].y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        let kept: Point[] = [];
        const flush = (): void => {
          if (kept.length >= 2) {
            let l = 0;
            for (let i = 1; i < kept.length; i++) {
              l += Math.hypot(kept[i].x - kept[i - 1].x, kept[i].y - kept[i - 1].y);
            }
            if (l >= minKeep) push(ink, kept);
          }
          kept = [];
        };
        for (const p of base) {
          const d = amp * noise.fbm(p.x / lambda, p.y / lambda, 2, 0.5, 2);
          const q = { x: p.x + nx * d, y: p.y + ny * d };
          if (pointInPolygon(poly, q.x, q.y)) kept.push(q);
          else flush();
        }
        flush();
      }
      break;
    }

    case 'stipple': {
      const pitch = t.spacing;
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      for (const p of poly) {
        if (p.x < bx0) bx0 = p.x;
        if (p.y < by0) by0 = p.y;
        if (p.x > bx1) bx1 = p.x;
        if (p.y > by1) by1 = p.y;
      }
      for (let gy = by0 + pitch / 2; gy <= by1; gy += pitch) {
        for (let gx = bx0 + pitch / 2; gx <= bx1; gx += pitch) {
          const x = gx + (rng() - 0.5) * pitch * 0.8;
          const y = gy + (rng() - 0.5) * pitch * 0.8;
          const ang = rng() * Math.PI * 2;
          // Tick half-length rides the pitch (≈0.35-0.65 px at the default
          // stipple pitch) so dots keep their weight on big sheets instead of
          // staying sub-pixel while everything else scales.
          const l = pitch * (0.045 + rng() * 0.04);
          if (!pointInPolygon(poly, x, y)) continue;
          push(ink, [
            { x: x - Math.cos(ang) * l, y: y - Math.sin(ang) * l },
            { x: x + Math.cos(ang) * l, y: y + Math.sin(ang) * l },
          ]);
        }
      }
      break;
    }
  }

  return { ink, phantom: [] };
}
