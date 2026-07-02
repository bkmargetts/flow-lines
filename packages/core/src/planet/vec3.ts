export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** A fixed 3-axis rotation built from a seed, so each seed shows a different
 *  face of the surface noise without any non-determinism. */
export function makeRotation(rng: () => number): (v: Vec3) => Vec3 {
  const a = rng() * TAU;
  const b = rng() * TAU;
  const c = rng() * TAU;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cc = Math.cos(c), sc = Math.sin(c);
  return (v: Vec3): Vec3 => {
    // Rz then Ry then Rx
    let x = v.x * ca - v.y * sa;
    let y = v.x * sa + v.y * ca;
    let z = v.z;
    let x2 = x * cb + z * sb;
    const z2 = -x * sb + z * cb;
    x = x2;
    z = z2;
    const y2 = y * cc - z * sc;
    const z3 = y * sc + z * cc;
    y = y2;
    z = z3;
    x2 = x;
    return { x: x2, y, z };
  };
}
