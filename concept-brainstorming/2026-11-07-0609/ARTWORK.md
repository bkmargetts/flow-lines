# Standing Water

## Artist statement

Towers on a night-blue sheet, drawn in cream line, and below them the same
city turned over and let go: a gold reflection that is only the city's own
edges and hatching, mirrored about a waterline, sliced into ripple bands
that erase more of it the deeper it goes, and shoved sideways by two
sine ripples that grow with depth. Between the two, a scatter of short
broken horizontals is the water surface itself.

Earlier runs used the `city` generator for its `order` slider; none gave
it a floor. Here the isometric towers have no ground — paper does that
job — and the only thing that says "water" is the second pen. What
survived the cull was the restraint: the first attempt (a small, tangled
reflection with no windows) was all ripple; the final one keeps the
reflection legible as architecture for the first third of its depth and
then lets it dissolve. Two pens, two colours, one sheet, no fills.

## Materials

- Paper: A3 (297×420 mm) midnight-indigo card, ~250 gsm, smooth (approx
  `#14213d`).
- Layer 1 (towers): white/cream gel pen, 0.4–0.5 mm, "ivory" `#f2e9d0`.
- Layer 2 (reflection + water): gold/brass metallic pen, 0.5 mm,
  `#c9a45c`.
- Low-tack tape for registration; clean white mount board (float mount).

## Process

1. Tape the card to the plotter bed; mark the A3 origin with tape corners.
2. Plot `artwork-layer-2.svg` first (gold; metallic ink needs longest to
   dry, and the towers do not overlap it).
3. Let dry 30 minutes. Without moving the card, swap pens.
4. Plot `artwork-layer-1.svg` in cream gel.
5. Optional hand step: with a dry brush, dust a faint thinned-gold glaze
   across the lower third of the water band only.
6. Float-mount on white board, 40 mm margin.

## Plot settings

A3 portrait, 297×420 mm, SVG in mm units, pen width 0.35 mm declared (pen
tip may be 0.4–0.5 mm). Both layers share the same origin. ~2,250 strokes
(towers) and ~2,070 strokes (reflection and water).

## Reproduction

Needs `pnpm install && pnpm build` first. Save the script below as
`gen.mjs` and run `node gen.mjs out 7`. It writes `artwork-layer-1.svg`
and `artwork-layer-2.svg` byte-for-byte as in this folder. Preview:
the two layers merged, ink recoloured, `node scripts/svg-to-png.mjs
merged.svg preview.png --width 1000 --background '#14213d'` (layer 1
`#f2e9d0`, layer 2 `#c9a45c`).

```js
// Flooded City generator: towers + rippled reflection. usage: node gen.mjs outdir [seed]
import {generateCity,toSVG,optimizePlot} from './packages/core/dist/index.js';
import {writeFileSync,mkdirSync} from 'fs';
const out=process.argv[2]; const seed=+(process.argv[3]||7);
mkdirSync(out,{recursive:true});
const MM=3.7795; // px per mm irrelevant: we use mm directly
const W=297,H=420; // A3 portrait in mm
const city=generateCity({width:W,height:H*0.56,margin:14,seed,style:'towers',blockRows:2,buildingHeight:170*0.42,lotSize:39*0.42,street:15*0.42,storey:9.6*0.42,windowSize:7.2*0.42,hatchSpacing:3.2*0.42,windows:0.8,blockCols:9,penWidth:0.35,order:0.5,downtown:0.9});
let maxY=0,minY=1e9;for(const l of city.lines)for(const p of l.points){maxY=Math.max(maxY,p.y);minY=Math.min(minY,p.y);}
console.error('extent',minY,maxY);
// shift city so its base sits on the waterline at y=water
const water=H*0.55; const dy=water-maxY;
let minX=1e9,maxX=-1e9;for(const l of city.lines)for(const p of l.points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);}
const dx0=W/2-(minX+maxX)/2;
const up=city.lines.map(l=>({...l,points:l.points.map(p=>({x:p.x+dx0,y:p.y+dy}))}));
// rng
let s=seed*9301+49297; const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
const ph=[rnd()*6.28,rnd()*6.28,rnd()*6.28];
const refl=[];
const depthMax=H-14-water;
for(const l of up){
  if(l.layer==='window')continue; // reflections lose the small detail
  // resample at 0.8mm
  const pts=[];
  for(let i=0;i<l.points.length-1;i++){const a=l.points[i],b=l.points[i+1];const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/0.8));for(let k=0;k<n;k++)pts.push({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n});}
  pts.push(l.points[l.points.length-1]);
  let cur=[];
  for(const p of pts){
    const d=(water-p.y); // height above water
    const ry=water+d*0.92+ 0.4; // mirrored depth
    if(ry>H-14){ if(cur.length>1)refl.push(cur);cur=[];continue;}
    const t=(ry-water)/depthMax;
    // ripple: horizontal displacement growing with distance
    const dx=(0.5+3*t)*Math.sin(ry*0.9+ph[0]+p.x*0.02)+ (0.4+1.6*t)*Math.sin(ry*2.3+ph[1]);
    // gaps: banded by y (horizontal ripple bands erase) 
    const band=Math.sin(ry*1.7+ph[2]+Math.sin(p.x*0.05)*2);
    const keep=band>(-0.9+1.9*t*t) ; // more erased deeper
    if(keep){cur.push({x:p.x+dx,y:ry});}else{if(cur.length>1)refl.push(cur);cur=[];}
  }
  if(cur.length>1)refl.push(cur);
}
// water surface strokes: horizontal broken lines
const wl=[];
for(let y=water+1.5;y<H-14;y+=2.2+ (y-water)*0.035){
  const t=(y-water)/depthMax;
  let x=14+rnd()*30;
  while(x<W-14){const len=4+rnd()*26*(0.4+t);const gap=3+rnd()*12;
    if(rnd()<0.55*(1-t*0.5)||true){ if(rnd()>0.3+0.4*t) wl.push([{x,y:y+Math.sin(x*0.1)*0.3},{x:Math.min(W-14,x+len),y:y+Math.sin((x+len)*0.1)*0.3}]); }
    x+=len+gap;}
}
const mk=(arr,layer)=>arr.map(pts=>({points:Array.isArray(pts)?pts:pts.points,pen:'fine',layer}));
const A={lines:[...up.map(l=>({...l,layer:'city'}))],width:W,height:H,seed};
const B={lines:[...mk(refl,'reflection'),...mk(wl,'water')],width:W,height:H,seed};
const opt=r=>({...r,lines:optimizePlot?optimizePlot(r.lines,{}):r.lines});
const o={physicalWidth:W+'mm',physicalHeight:H+'mm',strokeWidth:0.35};
writeFileSync(out+'/artwork-layer-1.svg',toSVG(A,{...o,optimize:true}));
writeFileSync(out+'/artwork-layer-2.svg',toSVG(B,{...o,optimize:true}));
console.error(A.lines.length,B.lines.length);
```

## Wishes

- A `city` CLI command, and a ground plane / water option in the city
  generator itself.
- A core "reflect" compose helper (mirror about a line with banded erasure
  and ripple displacement) instead of hand-rolled code.
