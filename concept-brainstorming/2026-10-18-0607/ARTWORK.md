# Four Hours in a Dish

## Artist statement

A single drop of activator is placed at the centre of a petri dish. Four
photographs are taken as it grows. That is the whole piece: four circles
on one A3 sheet, each holding the *same* reaction–diffusion colony at a
later moment of its life — a small rounded square, a four-lobed bud, a
cruciform with doubled arms, and finally a branching, snowflake-like
bloom that has pressed against the rim of its dish. A thin gold time-axis
runs beneath, ticked at each photograph.

It survived the cull because it turned the generator's weakness into the
idea. I first rendered balls, physarum networks and full-page
reaction–diffusion coral; the full-page coral is handsome but it is
wallpaper, and the library has done it before. Seeding from one point
(`seedLayout: center`) made the simulation perfectly four-fold symmetric,
and symmetry plus the **step count** gave me a time dimension the earlier
runs never used: the same seed stopped at 1800, 3000, 4300 and 6000
iterations. The contour style nests ~9 iso-levels, so each colony is a
fat, ink-bled outline with finer echoes inside — the quality of a
stained-and-fixed specimen, not a diagram. It reads as scientific
documentation and as ornament at once, and the empty paper around each
colony (the dish is mostly blank at stage one) does half the work.

## Materials

- **Paper:** A3 (297 × 420 mm), landscape, warm cream cotton-rag
  or hot-press sheet, 200–300 gsm, e.g. Fabriano Artistico "Extra White"
  or a natural-white Arches (preview uses `#f3efe4`).
- **Pen 1 — colonies:** deep indigo fineliner/gel, 0.35 mm, e.g. Sakura
  Pigma Micron 03 in blue-black, or a Staedtler pigment liner in
  "Prussian blue" (≈ `#1b2a49`).
- **Pen 2 — dishes and time-axis:** antique-gold/bronze metallic or
  ochre fineliner, 0.35 mm (≈ `#8a6d1f`), e.g. Uni-ball Signo gold
  gel on cream, or a Sakura Gelly Roll Metallic Gold.
- Optional: a very dilute indigo watercolour wash (see Process step 5).

## Process

1. Tape the sheet to the plotter bed, landscape, with a registration
   mark pencilled on a corner so the sheet can be re-seated.
2. Load pen 1 (indigo, 0.35 mm). Plot `artwork-growth.svg` (A3
   landscape, 181 paths). Let the ink dry fully (≥ 10 minutes).
3. **Without moving the paper**, swap to pen 2 (gold, 0.35 mm) and plot
   `artwork-dish.svg` (the four dish circles and the ticked axis).
   Plotting the dishes second keeps gold from smearing under indigo; the
   few millimetres where the final colony touches its rim overlap gold
   on indigo, which is intended.
4. Dry; erase the pencil mark.
5. *Optional hand step:* with a 6 mm flat brush, lay a single pale wash
   (indigo diluted ~1:20) inside the **fourth** dish only, from rim to
   rim, so the final stage is the only "filled" moment. Let it dry flat
   under a board.
6. Mount floating on off-white board; frame at A3 with a wide margin.

`artwork.svg` is the combined two-ink composite used for the preview; it
is not plotted.

## Plot settings

- Sheet: A3 landscape, 420 × 297 mm. Page margin 15 mm to the first dish
  edge; four dishes of Ø 90 mm at 10 mm spacing.
- Pen width 0.35 mm for both layers (SVG `stroke-width: 0.35`).
- Layers: `growth` (indigo), `dish` (gold). Plot growth first.
- Both layers are single stroked paths, no fills. Pen travel is small
  because the colony paths are ordered with `orderPlot`.

## Reproduction

Requires `pnpm install && pnpm build`. Save the script below as
`four-hours.mjs` and run `node four-hours.mjs out/` from the repo root
(deterministic: seed 5, no randomness elsewhere). It writes
`artwork.svg`, `artwork-growth.svg` and `artwork-dish.svg` byte-for-byte
identical to this folder. `preview.png` was made with:

```sh
node scripts/svg-to-png.mjs artwork.svg preview.png --width 1800 --background '#f3efe4'
```

```js
// Four Hours in a Dish — see ARTWORK.md
import {writeFileSync,mkdirSync} from 'node:fs';
const c = await import(process.env.CORE ?? '/home/user/flow-lines/packages/core/dist/index.js');
const out=process.argv[2]; mkdirSync(out,{recursive:true});
const W=420,H=297,D=90,GAP=10,CY=136;
const steps=[1800,3000,4300,6000];
const growth=[],dish=[];
steps.forEach((st,i)=>{
  const cx=15+D/2+i*(D+GAP);
  const r=c.generateReactionDiffusion({width:200,height:200,margin:9,seed:5,gridCols:170,style:'contour',seedLayout:'center',offCenter:0,steps:st,contourLevels:9});
  for(const l of r.lines) growth.push({points:l.points.map(p=>({x:p.x*D/200+cx-D/2,y:p.y*D/200+CY-D/2})),layer:'growth'});
  const pts=[];for(let a=0;a<=96;a++){const t=a/96*Math.PI*2;pts.push({x:cx+Math.cos(t)*(D/2),y:CY+Math.sin(t)*(D/2)});}
  dish.push({points:pts,layer:'dish'});
});
// time axis
const ay=CY+D/2+16, x0=15+D/2, x1=15+D/2+3*(D+GAP);
dish.push({points:[{x:x0,y:ay},{x:x1,y:ay}],layer:'dish'});
for(let i=0;i<4;i++){const x=x0+i*(D+GAP);dish.push({points:[{x,y:ay-3},{x,y:ay+3}],layer:'dish'});}
for(let i=0;i<=30;i++){const x=x0+i/30*(x1-x0);dish.push({points:[{x,y:ay},{x,y:ay+(i%10===0?0:1.6)}],layer:'dish'});}
const base={width:W,height:H,seed:5};
const growthRes=c.orderPlot({...base,lines:growth});
const res={...base,lines:[...growthRes.lines,...dish]};
const o={physicalWidth:'420mm',physicalHeight:'297mm',strokeWidth:0.35};
for(const {layer,svg} of c.toSVGLayers(res,o)) {writeFileSync(`${out}/artwork-${layer}.svg`,svg);}
writeFileSync(`${out}/artwork.svg`,c.toSVG(res,{...o,layerColors:{growth:'#1b2a49',dish:'#8a6d1f'},layerWidths:{growth:0.35,dish:0.35}}));
```

Note: the simulation is run on a 200 × 200 px page and scaled down into
each 90 mm dish — at very small page sizes the generator returned no
contours, so scaling afterwards was the workaround.

## Wishes

- A reaction–diffusion option to emit **several time-slices from one
  run** (rather than re-simulating to each step count).
- Support for small page sizes (the generator emits nothing at 90 px).
- A circular boundary condition so the colony meets a round dish wall
  instead of being clipped by the square grid.
