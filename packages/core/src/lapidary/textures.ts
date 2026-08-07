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
      // Long ruled lines break into hand-fed dashes with small pen-lift gaps
      // at irregular heights (the reference's airy background field); short
      // runs — a core band, sliver spans — stay whole.
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
