import { render, sheet, OUT, rng } from './lab.mjs';
import { foliation, criticalGraph } from './quaddiff.mjs';
const entries=[];
function scatter(n,seed,R=0.95){const r=rng(seed),o=[];
  for(let i=0;i<n;i++){const t=2*Math.PI*r(),rad=R*Math.sqrt(r());o.push([rad*Math.cos(t),rad*Math.sin(t)]);}return o;}
function draw(id,label,zeros,theta,B,{W=1200,H=1200,dsep=0.015,crit='bold',w=0.5,pw=900}={}){
  const map=(p)=>({x:(p[0]+B)/(2*B)*W, y:(B-p[1])/(2*B)*H});
  const conv=(pts)=>({points:pts.map(map)});
  const lines=foliation(zeros,theta,{bounds:B,dsep,step:0.0035,maxSteps:9000}).map(conv);
  if(crit) criticalGraph(zeros,theta,{bounds:B,step:0.003,maxSteps:9000}).forEach(c=>{
    const base=conv(c.pts);
    // bold = repeated offset passes of the same pen, as a plotter would do it
    for(const off of [-0.55,0,0.55]) lines.push({points:base.points.map((p,i,a)=>{
      const q=a[Math.min(i+1,a.length-1)],r=a[Math.max(i-1,0)];
      const tx=q.x-r.x,ty=q.y-r.y,L=Math.hypot(tx,ty)||1;
      return {x:p.x-ty/L*off,y:p.y+tx/L*off};})});
  });
  const info=await render(id,lines,W,H,{width:w,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes`});
  console.log(id.padEnd(14),info.strokes,info.segments); return info;
}
draw('qd-hero','14 zeros, critical graph in bold',scatter(14,7),0,1.2);
draw('qd-hero2','26 zeros',scatter(26,23),0,1.2);
// phase sweep — the critical graph reorganises as theta turns
for(const th of [0,0.18,0.36,0.54]) draw('qd-th'+String(th).replace('.',''),`theta = ${th}`,scatter(9,5),th,1.2,{W:700,H:700,dsep:0.02,pw:460});
console.log(sheet(`${OUT}/qd5.html`,entries,{cols:2,title:'Quadratic differentials'}));
