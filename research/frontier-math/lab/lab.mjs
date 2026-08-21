// Minimal maths lab: polylines -> SVG -> PNG. Deliberately independent of the
// repo so the mathematics drives the code, not the existing API shapes.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Output goes to research/frontier-math/out/ (gitignored) unless FM_OUT is set.
export const OUT = process.env.FM_OUT
  || new URL('../out/', import.meta.url).pathname;

/** Deterministic LCG, same family as the repo's rng. */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export const gauss = (r) => {
  const u = Math.max(1e-12, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** lines: [{points:[{x,y}...], pen?}] in px. */
export function toSVG(lines, w, h, { bg = '#ffffff', stroke = '#111111', width = 1 } = {}) {
  const body = lines
    .filter((l) => l.points && l.points.length > 1)
    .map((l) => {
      const d = l.points
        .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ');
      const sw = l.pen === 'bold' ? width * 1.0 : width;
      return `<path d="${d}" fill="none" stroke="${l.color || stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${bg}"/>
${body}
</svg>`;
}

export function save(path, svg) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg);
  return path;
}

// Imported lazily: the pure-maths modules must be usable with no dependencies
// at all, so pulling in `rng` must not drag the rasteriser along with it.
export async function png(svgPath, pngPath, width = 1200) {
  const { Resvg } = await import('@resvg/resvg-js');
  const svg = readFileSync(svgPath, 'utf8');
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  mkdirSync(dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, r.render().asPng());
  return pngPath;
}

/** One call: build svg + png, return both paths and stats. */
export async function render(name, lines, w, h, opts = {}) {
  const dir = opts.dir || OUT;
  const svgPath = `${dir}/${name}.svg`;
  const pngPath = `${dir}/${name}.png`;
  save(svgPath, toSVG(lines, w, h, opts));
  await png(svgPath, pngPath, opts.pngWidth || 1100);
  return { name, svg: svgPath, png: pngPath, ...stats(lines) };
}

export function stats(lines) {
  let segs = 0, len = 0;
  for (const l of lines) {
    const p = l.points || [];
    segs += Math.max(0, p.length - 1);
    for (let i = 1; i < p.length; i++) len += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  }
  return { strokes: lines.length, segments: segs, inkMetres: len / 1000 };
}

/** Contact sheet of PNGs for eyeballing a parameter sweep. */
export function sheet(path, entries, { cols = 3, title = '' } = {}) {
  const cells = entries
    .map((e) => `<figure><img src="${e.png}"/><figcaption>${e.label}</figcaption></figure>`)
    .join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{background:#191919;color:#ddd;font:13px/1.4 ui-monospace,monospace;margin:24px}
h1{font-size:15px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#888}
.grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:18px}
figure{margin:0}img{width:100%;display:block;background:#fff;border-radius:2px}
figcaption{padding-top:6px;color:#9a9a9a;font-size:11px}</style>
<h1>${title}</h1><div class="grid">${cells}</div>`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
  return path;
}
