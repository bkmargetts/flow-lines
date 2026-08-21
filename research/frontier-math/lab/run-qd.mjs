import { render, sheet, OUT } from './lab.mjs';
import { foliation, criticalGraph } from './quaddiff.mjs';
const W=1100,H=1100,B=2.2, entries=[];
const map=(p)=>({x:(p[0]+B)/(2*B)*W, y:(B-p[1])/(2*B)*H});
const conv=(pts)=>({points:pts.map(map)});
function shot(id,label,lines,w=0.6,pw=620){const info=await render(id,lines,W,H,{width:w,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes, ${info.segments} segs`});
  console.log(id.padEnd(16),info.strokes,info.segments);return info;}

const sets={
  tri:[[-1.1,-0.6],[1.1,-0.6],[0,1.05]],
  five:[[-1.3,0],[1.3,0],[0,1.25],[0,-1.25],[0.15,0.1]],
  seven:[[-1.4,-0.4],[1.35,-0.55],[0.1,1.3],[-0.7,0.55],[0.8,0.5],[-0.25,-1.1],[0.55,-0.9]],
};
for (const [name,zeros] of Object.entries(sets)) {
  for (const th of [0]) {
    const fol=foliation(zeros,th,{bounds:B,res:400,seedsN:2600,step:0.005,maxSteps:9000});
    const crit=criticalGraph(zeros,th,{bounds:B,step:0.004,maxSteps:9000});
    shot(`qd-${name}-fol`,`${zeros.length} zeros — foliation only`,fol.map(conv),0.5);
    shot(`qd-${name}-both`,`${zeros.length} zeros — foliation + critical graph (bold)`,
      [...fol.map(conv), ...crit.map(c=>({...conv(c.pts),color:'#c0392b'}))],0.5);
  }
}
// phase sweep on the 3-zero case: watch the critical graph reorganise
const z3=sets.tri;
for (const th of [0,0.25,0.5,0.75]) {
  const crit=criticalGraph(z3,th*Math.PI,{bounds:B,step:0.004,maxSteps:9000});
  shot(`qd-phase-${String(th).replace('.','')}`,`critical graph, theta = ${th}pi`,crit.map(c=>conv(c.pts)),1.0);
}
console.log(sheet(`${OUT}/qd.html`,entries,{cols:3,title:'Quadratic differential trajectories'}));
