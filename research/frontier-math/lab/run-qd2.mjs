import { render, sheet, OUT } from './lab.mjs';
import { foliation, criticalGraph } from './quaddiff.mjs';
const W=1100,H=1100, entries=[];
function shot(id,label,lines,w=0.55,pw=640){const info=render(id,lines,W,H,{width:w,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes`});console.log(id.padEnd(18),info.strokes,info.segments);return info;}
function draw(id,label,zeros,theta,B,{res=150,seedsN=9000,crit=true}={}){
  const map=(p)=>({x:(p[0]+B)/(2*B)*W, y:(B-p[1])/(2*B)*H});
  const conv=(pts)=>({points:pts.map(map)});
  const fol=foliation(zeros,theta,{bounds:B,res,seedsN,step:0.004,maxSteps:12000});
  const lines=fol.map(conv);
  if(crit) criticalGraph(zeros,theta,{bounds:B,step:0.003,maxSteps:12000})
    .forEach(c=>lines.push({...conv(c.pts),color:'#c0392b'}));
  return shot(id,label,lines);
}
const tri=[[-0.75,-0.45],[0.75,-0.45],[0,0.8]];
draw('q2-tri','3 zeros — a triradius at each',tri,0,1.25);
const five=[[-0.85,-0.15],[0.85,-0.2],[0,0.85],[-0.2,-0.8],[0.35,0.25]];
draw('q2-five','5 zeros',five,0,1.25);
const eight=[[-0.9,-0.5],[0.85,-0.6],[0.05,0.9],[-0.55,0.4],[0.6,0.35],[-0.15,-0.9],[0.45,-0.1],[-0.45,-0.1]];
draw('q2-eight','8 zeros',eight,0,1.25);
draw('q2-eight-th','8 zeros, theta = 0.5',eight,0.5,1.25);
console.log(sheet(`${OUT}/qd2.html`,entries,{cols:2,title:'Quadratic differentials — framed'}));
