import { generatePlanet, type PlanetOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { PlanetState } from './types';
import { getPlanetPalette } from './palettes';

/**
 * Pure render for the Planet Generator: state + page → lines. mm settings
 * convert to px at the page density; friendly 0..1 knobs (ocean, mare) map to
 * the core's raw noise thresholds. Hatch spacing and pen width are pre-divided
 * by zoom so they land back at the true size after the zoom transform, exactly
 * as the Vine Generator does. Multi-ink via `layerColors`.
 */
export function renderPlanet(state: PlanetState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;
  const zoom = Math.max(0.2, state.zoom);

  const options: PlanetOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    radiusFrac: state.radiusFrac,
    planetType: state.planetType,

    lightAngle: state.lightAngle,
    lightElevation: state.lightElevation,
    ambient: state.ambient,
    limbDarkening: state.limbDarkening,

    noiseScale: state.terrainScale,
    octaves: Math.round(state.terrainDetail),
    persistence: state.persistence,
    contrast: state.terrainContrast,
    // ocean 0..1 → sea threshold: more ocean ⇒ higher threshold ⇒ more sea
    seaLevel: (state.ocean - 0.5) * 1.1,
    // mareAmount 0..1 → mare threshold
    mareLevel: (state.mareAmount - 0.5) * 0.8,
    coastlines: state.coastlines,
    lavaFissureWidth: state.lavaFissureWidth,
    lavaGlow: state.lavaGlow,

    bands: state.bands,
    bandCount: state.bandCount,
    bandTurbulence: state.bandTurbulence,
    storms: state.storms,
    stormSize: state.stormSize,
    oblateness: state.oblateness,

    iceCaps: state.iceCaps,
    capLatitude: state.capLatitude,
    capRaggedness: state.capRaggedness,

    hatchSpacing: Math.max(1.5, (state.hatchSpacingMm * mm) / zoom),
    crossHatchLayers: state.crossHatchLayers,
    lightWeight: state.lightWeight,
    albedoWeight: state.albedoWeight,
    stipple: state.stipple,
    atmosphere: state.atmosphere,
    atmosphereStyle: state.atmosphereStyle,
    eclipse: state.eclipse,
    aurora: state.aurora,
    auroraLatitude: state.auroraLatitude,
    auroraIntensity: state.auroraIntensity,

    rings: state.rings,
    ringInner: state.ringInner,
    ringOuter: state.ringOuter,
    ringTilt: state.ringTilt,
    ringYaw: state.ringYaw,
    ringGap: state.ringGap,
    ringCount: state.ringCount,
    ringDensity: state.ringDensity,
    ringShadow: state.ringShadow,

    craters: state.craters,
    craterCount: state.craterCount,
    craterMinR: state.craterMinR,
    craterMaxR: state.craterMaxR,
    craterDetail: state.craterDetail,

    terminatorEmphasis: state.terminatorEmphasis,
    mountains: state.mountains,
    clouds: state.clouds,

    graticule: state.graticule,
    graticuleSpacingDeg: state.graticuleSpacingDeg,
    plateFrame: state.plateFrame,
    scaleBar: state.scaleBar,
    title: state.plateTitle,
    caption: state.plateCaption,
    layout: state.layout,
    layoutCount: state.layoutCount,

    starfield: state.starfield,
    starCount: state.starCount,
    moon: state.moon,
    moonDist: state.moonDist,
    moonAngle: state.moonAngle,
    moonRadiusFrac: state.moonRadiusFrac,

    penWidth: (state.penWidthMm * mm) / zoom,
    wobble: (state.wobbleMm * mm) / zoom,
    sketch: state.sketch,
    sketchStyle: state.sketchStyle,
  };

  const result = generatePlanet(options);

  // Zoom: scale the whole plate about the page centre, like the Vine Generator.
  const lines =
    zoom === 1
      ? result.lines
      : result.lines.map((ln) => ({
          ...ln,
          points: ln.points.map((p) => ({
            x: page.widthPx / 2 + (p.x - page.widthPx / 2) * zoom,
            y: page.heightPx / 2 + (p.y - page.heightPx / 2) * zoom,
          })),
        }));

  const pal = getPlanetPalette(state.palette);
  const layerColors = pal
    ? {
        limb: pal.limb,
        hatch: pal.hatch,
        feature: pal.feature,
        stipple: pal.stipple,
        ring: pal.ring,
        star: pal.star,
        atmosphere: pal.atmosphere,
        aurora: pal.aurora,
        graticule: pal.graticule,
        annotation: pal.annotation,
        label: pal.labelInk,
        orbit: pal.graticule,
        relief: pal.feature,
        cloud: pal.graticule,
      }
    : {
        limb: state.limbColor,
        hatch: state.hatchColor,
        feature: state.featureColor,
        stipple: state.hatchColor,
        ring: state.accentColor,
        star: state.accentColor,
        atmosphere: state.accentColor,
        aurora: state.accentColor,
        graticule: state.featureColor,
        annotation: state.featureColor,
        label: state.featureColor,
        orbit: state.featureColor,
        relief: state.featureColor,
        cloud: state.featureColor,
      };

  return {
    lines,
    strokeColor: pal ? pal.limb : state.limbColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
