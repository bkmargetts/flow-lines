import { render, sheet, OUT } from './lab.mjs';
import { foliation, criticalGraph } from './quaddiff.mjs';
import { rng } from './lab.mjs';
const W=1100,H=1100, entries=[];
function shot(id,label,lines,w=0.55,pw=640){const info=render(id,lines,W,H,{width:w,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes`});console.log(id.padEnd(20),info.strokes,info.segments);return info;}
function draw(id,label,zeros,theta,B,{res=190,seedsN=24000,showCrit=true,w=0.5}={}){
  const map=(p)=>({x:(p[0]+B)/(2*B)*W, y:(B-p[1])/(2*B)*H});
  const conv=(pts)=>({points:pts.map(map)});
  const lines=foliation(zeros,theta,{bounds:B,res,seedsN,step:0.0035,maxSteps:14000}).map(conv);
  if(showCrit) criticalGraph(zeros,theta,{bounds:B,step:0.003,maxSteps:14000})
    .forEach(c=>lines.push({...conv(c.pts),color:'#c0392b'}));
  return shot(id,label,lines,w);
}
// scattered zeros -> a field of triradii, like a fingerprint's deltas
function scatter(n,seed,R=0.95){const r=rng(seed),o=[];
  for(let i=0;i<n;i++){const t=2*Math.PI*r(),rad=R*Math.sqrt(r());o.push([rad*Math.cos(t),rad*Math.sin(t)]);}return o;}
draw('q3-6','6 zeros',scatter(6,11),0,1.2);
draw('q3-14','14 zeros',scatter(14,7),0,1.2);
draw('q3-26','26 zeros',scatter(26,23),0,1.2);
draw('q3-26-nc','26 zeros, foliation alone',scatter(26,23),0,1.2,{showCrit:false});
console.log(sheet(`${OUT}/qd3.html`,entries,{cols:2,title:'Quadratic differentials — trivalent foliations'}));
