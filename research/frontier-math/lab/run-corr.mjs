import { render, sheet, OUT } from './lab.mjs';
import { corrugationTower, curveLength, resample } from './corrugate.mjs';
const W=1000,H=1000;
const circle=(R,n=600)=>{const o=[];for(let i=0;i<n;i++){const t=2*Math.PI*i/n;o.push({x:W/2+Math.cos(t)*R,y:H/2+Math.sin(t)*R});}return o;};
const entries=[];
function shot(id,label,lines,w=0.7){
  const info=render(id,lines,W,H,{width:w,pngWidth:620});
  entries.push({png:info.png,label:`${label} — ${info.segments} segs`});
  console.log(id.padEnd(22), info.segments,'segs'); return info;
}
// 1: the tower, stage by stage
const tower=corrugationTower(circle(330),{stages:4,totalStretch:6,N0:5,ratio:4});
tower.history.forEach(h=>shot(`corr-stage${h.k}`,`stage ${h.k}: N=${h.N}, length x${(h.length/curveLength(circle(330))).toFixed(2)}`,[{points:h.pts}]));
// 2: deeper tower
const deep=corrugationTower(circle(330),{stages:6,totalStretch:14,N0:4,ratio:3});
shot('corr-deep','6 stages, total stretch x14',[{points:deep.curve}],0.45);
// 3: spatially varying stretch — smooth in places, deeply corrugated in others
const field=(s,k)=>0.15+0.85*Math.pow(0.5+0.5*Math.cos(2*Math.PI*(s*(k===0?1:3)+0.13*k)),2);
const varied=corrugationTower(circle(330),{stages:5,totalStretch:10,N0:4,ratio:3,stretchField:field});
shot('corr-varied','5 stages, stretch varying along the curve',[{points:varied.curve}],0.45);
// 4: nested family — concentric circles with different length surpluses
const nest=[];
for(let i=0;i<14;i++){
  const R=90+i*19, s=1.15+i*0.55;
  const t=corrugationTower(circle(R,400),{stages:4,totalStretch:s,N0:5,ratio:3});
  nest.push({points:t.curve});
}
shot('corr-nest','14 rings, length surplus increasing outward',nest,0.42);
console.log(sheet(`${OUT}/corr.html`,entries,{cols:3,title:'Convex integration — corrugation towers'}));
