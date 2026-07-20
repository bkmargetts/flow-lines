// Rasterize a plotter SVG to a PNG preview — the preview step of the
// concept-brainstorming routine (see concept-brainstorming/README.md), and
// handy for eyeballing any single render without opening a browser.
//
//   node scripts/svg-to-png.mjs in.svg out.png [--width 1600]
//     [--background '#1a1a2e'] [--stroke '#e8e4d8']
//
// --background recolours the sheet (the background <rect> toSVG emits) and
// --stroke recolours every path to one ink, so a preview can approximate the
// envisioned materials (e.g. cream ink on midnight paper) instead of the
// default black-on-white. Omit --stroke to keep per-layer pen colours.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    flags[args[i].slice(2)] = args[i + 1];
    i++;
  } else {
    positional.push(args[i]);
  }
}

const [input, output] = positional;
if (!input || !output) {
  console.error(
    "Usage: node scripts/svg-to-png.mjs in.svg out.png [--width 1600] [--background '#fff'] [--stroke '#000']",
  );
  process.exit(1);
}

const { Resvg } = await import('@resvg/resvg-js');

let svg = readFileSync(input, 'utf8');
if (flags.background) {
  // toSVG's sheet is the first full-size <rect> — recolour it in place.
  svg = svg.replace(
    /(<rect width="[^"]+" height="[^"]+" fill=")[^"]+(")/,
    `$1${flags.background}$2`,
  );
}
if (flags.stroke) {
  svg = svg.replace(/stroke="[^"]+"/g, `stroke="${flags.stroke}"`);
}

const width = Number(flags.width ?? 1600);
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: width },
  background: flags.background ?? '#ffffff',
});
const png = resvg.render().asPng();
writeFileSync(output, png);
console.log(`wrote ${output} (${width}px wide, ${png.length} bytes)`);
