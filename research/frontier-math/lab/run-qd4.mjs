import { render, sheet, OUT, rng } from './lab.mjs';
import { foliation, criticalGraph } from './quaddiff.mjs';
const W=1100,H=1100, entries=[];
function draw(id,label,zeros,theta,B,{dsep=0.018,showCrit=true,w=0.55}={}){
  const map=(p)=>({x:(p[0]+B)/(2*B)*W, y:(B-p[1])/(2*B)*H});
  const conv=(pts)=>({points:pts.map(map)});
  const t0=Date.now();
  const lines=foliation(zeros,theta,{bounds:B,dsep,step:0.0035,maxSteps:9000}).map(conv);
  if(showCrit) criticalGraph(zeros,theta,{bounds:B,step:0.003,maxSteps:9000})
    .forEach(c=>lines.push({...conv(c.pts),color:'#c0392b'}));
  const info=await render(id,lines,W,H,{width:w,pngWidth:640});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes`});
  console.log(id.padEnd(16),info.strokes,'strokes',info.segments,'segs',((Date.now()-t0)/1000).toFixed(1)+'s');
}
function scatter(n,seed,R=0.95){const r=rng(seed),o=[];
  for(let i=0;i<n;i++){const t=2*Math.PI*r(),rad=R*Math.sqrt(r());o.push([rad*Math.cos(t),rad*Math.sin(t)]);}return o;}
draw('q4-6','6 zeros',scatter(6,11),0,1.2);
draw('q4-14','14 zeros',scatter(14,7),0,1.2);
draw('q4-26','26 zeros',scatter(26,23),0,1.2);
draw('q4-26nc','26 zeros, foliation alone',scatter(26,23),0,1.2,{showCrit:false});
console.log(sheet(`${OUT}/qd4.html`,entries,{cols:2,title:'Quadratic differentials — evenly spaced'}));
