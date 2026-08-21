import { render, sheet, OUT } from './lab.mjs';
import { sampleGFF, flowLines } from './gff.mjs';
const W=1200,H=1500;
const entries=[];
const row=(n,y)=>Array.from({length:n},(_,i)=>({x:(i+0.5)*W/n,y}));
const col=(n,x)=>Array.from({length:n},(_,i)=>({x,y:(i+0.5)*H/n}));
function shot(id,label,lines,w=0.6,pw=560){const info=await render(id,lines,W,H,{width:w,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes, ${info.segments} segs`});
  console.log(id.padEnd(20),info.strokes,info.segments);return info;}

const f=sampleGFF(1024, 90210, {rough:1});
// hero: one angle, dense seeding
shot('ig-hero','GFF flow-line tree, chi=1.1, 900 seeds',
  flowLines(f,{chi:1.1,theta:-Math.PI/2,seeds:row(900,H-3),W,H,step:0.6,maxSteps:6000,mergeRadius:1.5}),0.55,900);

// two angles: each family merges within itself, and the families cross
const a=flowLines(f,{chi:1.1,theta:-Math.PI/2,seeds:row(260,H-3),W,H,step:0.6,maxSteps:6000});
const b=flowLines(f,{chi:1.1,theta:0,seeds:col(260,3),W,H,step:0.6,maxSteps:6000});
shot('ig-two-angles','two angle families — each merges internally, the families cross',
  [...a.map(l=>({...l,color:'#111'})),...b.map(l=>({...l,color:'#c0392b'}))],0.6,900);

// a fan of angles from one strip of seeds — the "light cone"
const fan=[];
const cols=['#111','#1f6f8b','#b8860b','#7d3c98','#117a4a'];
[-2.4,-1.95,-1.57,-1.2,-0.75].forEach((th,i)=>{
  flowLines(f,{chi:1.1,theta:th,seeds:row(150,H-3),W,H,step:0.6,maxSteps:6000})
    .forEach(l=>fan.push({...l,color:cols[i]}));
});
shot('ig-fan','five angle families from the same field',fan,0.55,900);
console.log(sheet(`${OUT}/gff2.html`,entries,{cols:3,title:'Imaginary geometry — theorems visible'}));
