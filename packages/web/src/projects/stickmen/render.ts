import {
  generateStickmen,
  starRegion,
  heartRegion,
  diamondRegion,
  blobRegion,
  type StickmenOptions,
  type StickmenRegion,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { StickmenState } from './types';
import { clipLinesToRect } from './clip';

const DEG = Math.PI / 180;

/**
 * Compile the UI's crowd-shape state to a core region. Core region coords are
 * box-relative (x scales by box width, y by height), so the picture shapes
 * (star / heart / diamond / blob) are sized from the smaller box dimension and
 * divided per-axis to stay aspect-correct on any page; the oval deliberately
 * follows the page aspect, and the ring is circular by the core's contract.
 */
function compileShape(state: StickmenState, boxW: number, boxH: number): StickmenRegion | undefined {
  const { regionShape: shape, regionSize: size, regionX: cx, regionY: cy, regionInner: inner } = state;
  if (shape === 'full') return undefined;
  if (shape === 'ellipse') return { kind: 'ellipse', cx, cy, rx: size / 2, ry: size / 2 };
  if (shape === 'ring')
    return { kind: 'ring', cx, cy, rOuter: size / 2, rInner: (size / 2) * inner };
  const r = (size / 2) * Math.min(boxW, boxH);
  const rx = r / boxW;
  const ry = r / boxH;
  if (shape === 'diamond') return diamondRegion(cx, cy, rx, ry);
  if (shape === 'star') return starRegion(cx, cy, rx, ry, inner, 5);
  if (shape === 'heart') return heartRegion(cx, cy, rx, ry);
  return blobRegion(state.seed, cx, cy, rx, ry, 0.45);
}

/**
 * Pure render for the Stick Men generator: state + page → lines. mm settings
 * convert to px at the page density. Zoom is a true camera magnification: the
 * crowd is generated once at page scale (zoom-independent), then every point is
 * uniformly scaled about the page centre — so figures AND spacing grow together
 * on zoom-in, and zoom-out shrinks everything and reveals the off-page crowd.
 * (The other generators pre-divide sizes by zoom because they fit-to-page; this
 * one is sized to the page directly, so a plain post-scale is the honest zoom.)
 */
export function renderStickmen(state: StickmenState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;
  const zoom = Math.max(0.2, state.zoom);

  const options: StickmenOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    count: Math.round(state.count),
    spread: state.spread,
    clustering: state.clustering,
    minSeparation: state.minSeparationMm * mm,
    facing: state.facing,
    facingAngle: state.facingAngleDeg * DEG,
    facingJitter: state.facingJitterDeg * DEG,
    region: compileShape(state, page.widthPx - 2 * marginPx, page.heightPx - 2 * marginPx),

    figureScale: state.figureHeightMm * mm,
    scaleVariance: state.scaleVariance,
    proportionVariance: state.proportionVariance,
    depthGrade: state.depthGrade,
    limbCurve: state.limbCurve,
    penWidth: state.penWidthMm * mm,

    poseEnergy: state.poseEnergy,
    poseMode: state.poseMode,

    occlude: state.occlude,
    groundContact: state.groundContact,
    wobble: state.wobbleMm * mm,
  };

  const result = generateStickmen(options);

  // Zoom: uniformly scale the whole crowd about the page centre — figures and
  // spacing together, a real camera zoom.
  const zoomed =
    zoom === 1
      ? result.lines
      : result.lines.map((ln) => ({
          ...ln,
          points: ln.points.map((p) => ({
            x: page.widthPx / 2 + (p.x - page.widthPx / 2) * zoom,
            y: page.heightPx / 2 + (p.y - page.heightPx / 2) * zoom,
          })),
        }));

  // The core leaves the crowd unclipped (the ground overflows the sheet on
  // purpose). Clip to the drawable box HERE, after zoom, so the page and the
  // exported plot stay inside the sheet — and zooming out pulls the previously
  // off-page figures into the box, revealing them.
  const lines = clipLinesToRect(zoomed, marginPx, marginPx, page.widthPx - marginPx, page.heightPx - marginPx);

  return {
    lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors: {
      figure: state.strokeColor,
      head: state.strokeColor,
      contact: state.strokeColor,
    },
  };
}
