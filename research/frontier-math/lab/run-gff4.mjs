import { render, sheet, OUT } from './lab.mjs';
import { sampleGFF, flowLines, addHarmonic } from './gff.mjs';
const W=1100,H=1100, entries=[], chi=1.1;
const ring=(n,R)=>Array.from({length:n},(_,i)=>{const t=2*Math.PI*i/n;return{x:W/2+R*Math.cos(t),y:H/2+R*Math.sin(t)};});
function shot(id,label,lines,w=0.55){const info=await render(id,lines,W,H,{width:w,pngWidth:600});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes, ${info.segments} segs`});
  console.log(id.padEnd(16),info.strokes,info.segments);return info;}
const base=sampleGFF(1024, 4711, {rough:1});
// winding = chi  =>  the harmonic term contributes exactly one turn of arg(z),
// so theta becomes the spiral pitch: pi = straight in, pi/2 = pure circulation.
const sw=addHarmonic(base,{sources:[{x:W/2,y:H/2,winding:chi}],W,H});
for (const [id,label,theta] of [
  ['r-in','theta = pi  (radially inward)',Math.PI],
  ['r-sp1','theta = 0.80 pi  (gentle spiral)',0.80*Math.PI],
  ['r-sp2','theta = 0.65 pi  (tight spiral)',0.65*Math.PI],
  ['r-circ','theta = 0.5 pi  (pure circulation)',0.5*Math.PI],
]) shot(id,label,flowLines(sw,{chi,theta,seeds:ring(800,530),W,H,step:0.6,maxSteps:6000,mergeRadius:1.7}));
// two opposite vortices
const two=addHarmonic(base,{sources:[{x:W*0.32,y:H*0.42,winding:chi},{x:W*0.70,y:H*0.60,winding:-chi}],W,H});
shot('r-dipole','two counter-rotating vortices, theta = 0.9 pi',
  flowLines(two,{chi,theta:0.9*Math.PI,seeds:ring(800,540),W,H,step:0.6,maxSteps:6000,mergeRadius:1.7}));
console.log(sheet(`${OUT}/gff4.html`,entries,{cols:3,title:'GFF + winding: composition control'}));
