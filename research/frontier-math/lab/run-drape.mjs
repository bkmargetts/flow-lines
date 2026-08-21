import { makeRelief, drapeNet, netLines } from './drape.mjs';
import { tonePreTest, reportRow, REPORT_HEADER } from './tone-test.mjs';
import { render, sheet, OUT } from './lab.mjs';

const W = 900, H = 900, M = 40;
const rows = [], entries = [];
for (const [label, opts] of [
  ['flat (control, K=0)', { bumps: 0, amp: 0 }],
  ['3 domes, gentle', { bumps: 3, amp: 0.10, seed: 4 }],
  ['5 domes, medium', { bumps: 5, amp: 0.20, seed: 4 }],
  ['7 domes, strong', { bumps: 7, amp: 0.32, seed: 9 }],
]) {
  const { f } = makeRelief({ ...opts, W: 1, H: 1 });
  // net anchored bottom-left so it marches across the whole sheet
  const net = drapeNet({ f, n: 96, h: 0.0102, origin: [0.06, 0.06], angle: 0.05, spread: Math.PI / 2 });
  const lines = netLines(net, { W, H, margin: M, scale: 1 });
  const id = 'drape-' + label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const info = await render(id, lines, W, H, { width: 0.7, pngWidth: 560 });
  rows.push(tonePreTest(`drape/${label}`, lines, W, H, { dir: OUT, penWidth: 0.7 }));
  entries.push({ png: info.png, label: `${label} — ${net.tears} torn nodes, ${info.strokes} strokes` });
  console.log(label.padEnd(22), String(net.tears).padStart(5) + ' tears', String(info.strokes).padStart(5) + ' strokes');
}
console.log('\n' + REPORT_HEADER);
console.log('-'.repeat(60));
for (const r of rows) console.log(reportRow(r));
sheet(`${OUT}/drape.html`, entries, { cols: 2, title: 'Drape — Chebyshev nets' });
