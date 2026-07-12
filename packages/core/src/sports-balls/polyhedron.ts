import { type Vec3, norm } from '../planet/vec3.js';

/**
 * The truncated-icosahedron edge net — the classic 32-panel football. Built
 * once at module load: icosahedron from the golden ratio, each directed icosa
 * edge (i,j) truncated at a third of its length to the vertex
 * normalize((2·vi + vj)/3). Edges come in two families: the segment the two
 * flanking hexagons share (one per icosa edge, 30) and the pentagon rings
 * around each icosa vertex (12 × 5 = 60) — 90 edges over 60 vertices.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

function icosahedron(): Vec3[] {
  const v: Vec3[] = [];
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      v.push({ x: 0, y: s1, z: s2 * PHI });
      v.push({ x: s1, y: s2 * PHI, z: 0 });
      v.push({ x: s2 * PHI, y: 0, z: s1 });
    }
  }
  return v.map(norm);
}

const truncVertex = (a: Vec3, b: Vec3): Vec3 =>
  norm({ x: (2 * a.x + b.x) / 3, y: (2 * a.y + b.y) / 3, z: (2 * a.z + b.z) / 3 });

function build(): [Vec3, Vec3][] {
  const ico = icosahedron();
  const n = ico.length;

  // Icosa edges = the closest pairs (all edges share one chord length).
  let minD2 = Infinity;
  const d2 = (a: Vec3, b: Vec3): number =>
    (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) minD2 = Math.min(minD2, d2(ico[i], ico[j]));
  }
  const neighbors: number[][] = Array.from({ length: n }, () => []);
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (d2(ico[i], ico[j]) < minD2 * 1.2) {
        edges.push([i, j]);
        neighbors[i].push(j);
        neighbors[j].push(i);
      }
    }
  }

  const out: [Vec3, Vec3][] = [];
  // Hexagon–hexagon edge per icosa edge: the middle third of the edge.
  for (const [i, j] of edges) {
    out.push([truncVertex(ico[i], ico[j]), truncVertex(ico[j], ico[i])]);
  }
  // Pentagon ring per icosa vertex: its 5 truncation points in angular order.
  for (let i = 0; i < n; i++) {
    const a = norm(ico[i]);
    const ref: Vec3 = Math.abs(a.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const ux = a.y * ref.z - a.z * ref.y;
    const uy = a.z * ref.x - a.x * ref.z;
    const uz = a.x * ref.y - a.y * ref.x;
    const ul = Math.hypot(ux, uy, uz) || 1;
    const u = { x: ux / ul, y: uy / ul, z: uz / ul };
    const v = {
      x: a.y * u.z - a.z * u.y,
      y: a.z * u.x - a.x * u.z,
      z: a.x * u.y - a.y * u.x,
    };
    const ring = neighbors[i]
      .map((j) => truncVertex(ico[i], ico[j]))
      .map((p) => ({
        p,
        ang: Math.atan2(p.x * v.x + p.y * v.y + p.z * v.z, p.x * u.x + p.y * u.y + p.z * u.z),
      }))
      .sort((p, q) => p.ang - q.ang)
      .map((e) => e.p);
    for (let k = 0; k < ring.length; k++) {
      out.push([ring[k], ring[(k + 1) % ring.length]]);
    }
  }
  return out;
}

/** 90 great-circle edge arcs (as unit-vector endpoint pairs). */
export const SOCCER_EDGES: readonly [Vec3, Vec3][] = build();
