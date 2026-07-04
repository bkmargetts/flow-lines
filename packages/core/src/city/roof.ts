/**
 * Roof geometry beyond the flat parapet box: a roof is a cap *above* the top
 * tier — `tiers[top].z1` is the eave, `rise` lifts the ridge, and `b.h`
 * includes the rise so the spine's t = z/h normalisation reaches 1 at the
 * ridge and a leaning house gets a genuinely bent ridge line for free.
 */

export interface RoofSpec {
  kind: 'flat' | 'gable';
  /** Ridge direction: 'u' = ridge runs along u at v-mid, 'v' = along v at u-mid. */
  ridgeAxis: 'u' | 'v';
  /** Ridge height above the eave (world px). 0 for flat. */
  rise: number;
}

export function flatRoof(): RoofSpec {
  return { kind: 'flat', ridgeAxis: 'u', rise: 0 };
}
