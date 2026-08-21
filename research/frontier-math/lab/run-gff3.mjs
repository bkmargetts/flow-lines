import { render, sheet, OUT } from './lab.mjs';
import { sampleGFF, flowLines, addHarmonic } from './gff.mjs';
const W=1100,H=1100, entries=[];
const ring=(n,cx,cy,R)=>Array.from({length:n},(_,i)=>{const t=2*Math.PI*i/n;return{x:cx+R*Math.cos(t),y:cy+R*Math.sin(t)};});
const row=(n,y)=>Array.from({length:n},(_,i)=>({x:(i+0.5)*W/n,y}));
function shot(id,label,lines,w=0.55){const info=await render(id,lines,W,H,{width:w,pngWidth:600});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes`});console.log(id.padEnd(18),info.strokes,info.segments);return info;}
const base=sampleGFF(1024, 4711, {rough:1});
const cases=[
 ['h-none','no harmonic term',{},ring(700,W/2,H/2,520)],
 ['h-sink','one sink: strength -1.6',{sources:[{x:W/2,y:H/2,strength:-1.6}]},ring(700,W/2,H/2,520)],
 ['h-swirl','one vortex: winding 1.4',{sources:[{x:W/2,y:H/2,winding:1.4}]},ring(700,W/2,H/2,520)],
 ['h-spiral','vortex + sink together',{sources:[{x:W/2,y:H/2,winding:1.2,strength:-1.0}]},ring(700,W/2,H/2,520)],
 ['h-two','two vortices of opposite sign',{sources:[{x:W*0.33,y:H/2,winding:1.5},{x:W*0.67,y:H/2,winding:-1.5}]},ring(700,W/2,H/2,520)],
 ['h-drift','linear drift only',{drift:[0,-5]},row(700,H-3)],
];
for(const [id,label,harm,seeds] of cases){
  const f=Object.keys(harm).length?addHarmonic(base,{...harm,W,H}):base;
  shot(id,label,flowLines(f,{chi:1.1,theta:-Math.PI/2,seeds,W,H,step:0.6,maxSteps:5000,mergeRadius:1.7}));
}
console.log(sheet(`${OUT}/gff3.html`,entries,{cols:3,title:'GFF + harmonic composition control'}));
