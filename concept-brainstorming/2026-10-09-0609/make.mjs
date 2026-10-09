// Reproduce: node concept-brainstorming/2026-10-09-0609/make.mjs   (after pnpm install && pnpm build)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const core = await import(join(here, '../../packages/core/dist/index.js'));
const { generateCity, generatePlanet, holdOffLines, toSVG } = core;
const W = 1188, H = 1680; // A3 portrait at 4 px/mm; pen 0.3 mm = 1.2 px
const city = generateCity({ width: W, height: H, margin: 48, seed: 21, order: 0.35, style: 'towers',
  blockCols: 9, blockRows: 5, lotSize: 70, street: 22, buildingHeight: 330, downtown: 0.8, penWidth: 1.2 });
const S = 1000;
const moon = generatePlanet({ width: S, height: S, margin: 10, seed: 11, planetType: 'moon', radiusFrac: 0.96,
  lightAngle: -40, lightElevation: 28, craters: true, craterCount: 90, hatchSpacing: 5, crossHatchLayers: 3, stipple: 0.4 });
const shift = (ls, dx, dy) => ls.map((l) => ({ ...l, points: l.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }));
const inPage = (p) => p.x > 48 && p.x < W - 48 && p.y > 48 && p.y < H - 48;
let cls = shift(city.lines, 0, 240).map((l) => ({ ...l, points: l.points.filter(inPage) })).filter((l) => l.points.length > 1);
let mls = shift(moon.lines, 594 - S / 2, 540 - S / 2);
mls = holdOffLines(mls, cls, 9);
const opt = { strokeWidth: 1.2, physicalWidth: '297mm', physicalHeight: '420mm' };
const out = (name, lines) => writeFileSync(join(here, name), toSVG({ lines, width: W, height: H, seed: 1 }, opt));
out('artwork-layer-1-moon.svg', mls);
out('artwork-layer-2-towers.svg', cls);
