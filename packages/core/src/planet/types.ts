import type { SketchStyle } from '../sketch-styles.js';

export type PlanetType =
  | 'terrestrial'
  | 'gas-giant'
  | 'ringed'
  | 'moon'
  | 'ice'
  | 'lava'
  | 'star'
  | 'barren';

export type PlanetLayout = 'single' | 'phases' | 'comparison' | 'orbital';

export interface PlanetOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  /** Disk radius as a fraction of the usable half-frame (0..1). */
  radiusFrac?: number;
  planetType?: PlanetType;

  // Light
  lightAngle?: number; // degrees, azimuth in the screen plane
  lightElevation?: number; // degrees, 0 = grazing (crescent) .. 90 = full face
  ambient?: number; // 0..1 fill so the shadow side never goes pure white
  limbDarkening?: number; // 0..1 darkening toward the disk edge (star/gas)

  // Surface noise
  noiseScale?: number;
  octaves?: number;
  persistence?: number;
  contrast?: number; // >1 sharpens coast/cracks
  seaLevel?: number; // terrestrial land/sea threshold on noise (-1..1)
  mareLevel?: number; // moon dark-plain threshold
  coastlines?: boolean; // trace feature outlines
  lavaFissureWidth?: number; // |noise| band kept as open glowing cracks
  lavaGlow?: number; // 0..1 ember-stipple density along the fissures

  // Gas giant
  bands?: boolean;
  bandCount?: number;
  bandTurbulence?: number;
  storms?: number; // count of oval spots (Great Red Spot)
  stormSize?: number; // 0..n scale on the storm ovals

  // Ice caps
  iceCaps?: boolean;
  capLatitude?: number; // degrees from the equator where caps begin
  capRaggedness?: number; // 0..1 noisy cap edge

  // Mark-making
  hatchSpacing?: number; // base stroke spacing in px
  crossHatchLayers?: number; // 1..5
  lightWeight?: number; // tone = darkness*lightWeight + albedo*albedoWeight
  albedoWeight?: number;
  stipple?: number; // 0..1 shadow/texture dots
  atmosphere?: number; // 0..n glow rings (star: corona)
  atmosphereStyle?: 'rings' | 'haze'; // closed rings, or broken lit-limb arcs

  // Celestial phenomena
  /** The companion moon casts its shadow onto the primary (needs `moon`,
   *  single layout, and the moon on the lit side — a solar eclipse plate). */
  eclipse?: boolean;
  eclipseSoftness?: number; // penumbra width as a fraction of the moon radius
  aurora?: boolean; // dashed auroral ovals + curtain rays around the poles
  auroraLatitude?: number; // degrees where the oval sits
  auroraIntensity?: number; // 0..1 dash density / ray count

  // Rings
  rings?: boolean;
  ringInner?: number; // in disk radii
  ringOuter?: number;
  ringTilt?: number; // degrees
  ringYaw?: number; // degrees
  ringGap?: number; // 0..1 fraction of the span left as a Cassini gap
  ringCount?: number; // concentric stroke bands
  ringDensity?: number; // strokes per band (tone by spacing)
  ringShadow?: boolean; // cut the planet's shadow into the rings

  // Craters
  craters?: boolean;
  craterCount?: number;
  craterMinR?: number; // fraction of disk radius
  craterMaxR?: number;
  craterDetail?: boolean; // central peaks + ejecta rays on big craters

  // Surface relief
  terminatorEmphasis?: number; // 0..1 extra hatch hugging the terminator
  mountains?: boolean; // chevron hachures on high terrestrial land
  clouds?: boolean; // soft cloud shapes traced over terrestrial worlds

  // Engraved-plate annotation
  graticule?: boolean; // lat/long lines on the globe
  graticuleSpacingDeg?: number; // degrees between lines
  plateFrame?: boolean; // graduated neatline just inside the margin
  scaleBar?: boolean; // divided scale bar along the bottom
  title?: string; // engraved plate title, centred along the top
  caption?: string; // engraved caption, centred along the bottom

  // Composition (multi-body plates)
  layout?: PlanetLayout;
  layoutCount?: number; // bodies in the plate

  // Extras
  starfield?: boolean;
  starCount?: number;
  moon?: boolean;
  moonDist?: number; // in disk radii from centre
  moonAngle?: number; // degrees
  moonRadiusFrac?: number; // of the primary radius

  // Pen / finishing
  penWidth?: number; // px
  wobble?: number; // px wobble amplitude
  sketch?: number; // 0..1 hand-drawn overdraw intensity (multi-pass)
  sketchStyle?: SketchStyle; // character of the overdraw
}
