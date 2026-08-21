import { makeRelief, drapeNet, netLines } from './drape.mjs';
import { tonePreTest, reportRow, REPORT_HEADER } from './tone-test.mjs';
import { render, sheet, OUT } from './lab.mjs';
const W = 900, H = 900, M = 40;
const rows = [], entries = [];
for (const [label, opts] of [
  ['1 cone', { bumps: 0, cones: 1, coneSlope: 1.0, seed: 3 }],
  ['2 cones', { bumps: 0, cones: 2, coneSlope: 1.2, seed: 5 }],
  ['3 cones + domes', { bumps: 3, amp: 0.12, cones: 3, coneSlope: 1.1, seed: 11 }],
]) {
  const { f } = makeRelief({ ...opts, W: 1, H: 1 });
  const net = drapeNet({ f, n: 96, h: 0.0102, origin: [0.06, 0.06], angle: 0.05, spread: Math.PI / 2 });
  const lines = netLines(net, { W, H, margin: M, scale: 1 });
  const id = 'drapec-' + label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const info = await render(id, lines, W, H, { width: 0.7, pngWidth: 560 });
  rows.push(tonePreTest(`drape/${label}`, lines, W, H, { dir: OUT, penWidth: 0.7 }));
  entries.push({ png: info.png, label: `${label} — ${net.tears} torn nodes` });
  console.log(label.padEnd(18), String(net.tears).padStart(5) + ' tears', String(info.strokes).padStart(5) + ' strokes');
}
console.log('\n' + REPORT_HEADER);
for (const r of rows) console.log(reportRow(r));
sheet(`${OUT}/drape2.html`, entries, { cols: 3, title: 'Drape — cone singularities' });
