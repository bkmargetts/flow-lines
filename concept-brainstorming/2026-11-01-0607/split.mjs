// Splits artwork.svg into one file per pen colour (run from repo root).
import fs from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const svg = fs.readFileSync(dir + 'artwork.svg', 'utf8');
const lines = svg.split('\n');
const head = lines.slice(0, 2).join('\n');
const paths = lines.filter((l) => l.includes('<path'));
const pens = { 'artwork-layer-1-moonlight-white': '#e8e4d8', 'artwork-layer-2-moon-gold': '#d9b45a', 'artwork-layer-0-register-crosses': '#000000' };
for (const [name, col] of Object.entries(pens)) {
  const own = paths.filter((p) => p.includes(`stroke="${col}"`));
  fs.writeFileSync(`${dir}${name}.svg`, `${head}\n${own.join('\n')}\n</svg>\n`);
}
