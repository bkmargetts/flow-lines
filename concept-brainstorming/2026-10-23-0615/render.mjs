// Reproduces artwork-layer-{0..4}.svg:  node render.mjs <outDir>   (run from repo root after `pnpm build`)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const c = await import(join(process.cwd(), 'packages/core/dist/index.js'));
const out = process.argv[2] ?? '.';
const res = c.generateColorField({
  width: 297, height: 420, margin: 20, seed: 5, penWidthPx: 0.4,
  inkCount: 5, gradientMode: 'radial', focalXPct: 0.5, focalYPct: 0.5, gradientRadiusPct: 0.55,
  spacingPx: 1.5, fill: 0.97, angleDeg: 0, blend: 1.0,
  gradientNoiseAmpPx: 10, gradientNoiseScale: 0.012, ditherScale: 0.08, inkAngleSpreadDeg: 6,
  maskShapes: [{ type: 'ellipse', cx: 148.5, cy: 210, rx: 112, ry: 112 }],
  wobbleAmpPx: 0.4,
});
const o = { strokeWidth: 0.4, optimizePaths: false, physicalWidth: '297mm', physicalHeight: '420mm' };
for (const { layer, svg } of c.toSVGLayers(res, o)) writeFileSync(join(out, `artwork-layer-${+layer.slice(5)}.svg`), svg);
const lc = { 'band-00': '#fff4d6', 'band-01': '#ffd23f', 'band-02': '#ff7a1a', 'band-03': '#e0245e', 'band-04': '#6a3dc9' };
writeFileSync(join(process.env.PREVIEW_DIR ?? out, 'combined.svg'), c.toSVG(res, { ...o, layerColors: lc, includeBackground: true, backgroundColor: '#101014' }));
