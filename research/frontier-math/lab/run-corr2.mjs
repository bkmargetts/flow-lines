import { render, sheet, OUT } from './lab.mjs';
import { corrugationTower, curveLength, amplitudeFor } from './corrugate.mjs';
const W=1000,H=1000;
const circle=(R,n=800)=>{const o=[];for(let i=0;i<n;i++){const t=2*Math.PI*i/n;o.push({x:W/2+Math.cos(t)*R,y:H/2+Math.sin(t)*R});}return o;};
const entries=[];
function shot(id,label,lines,w=0.55){const info=await render(id,lines,W,H,{width:w,pngWidth:620});
  entries.push({png:info.png,label:`${label} — ${info.segments} segs`});console.log(id.padEnd(20),info.segments); return info;}
// predicted first-stage ripple amplitude, to sanity-check the regime
const R0=320, L0=2*Math.PI*R0;
for (const [stages,total,N0,ratio] of [[3,3,24,3],[4,5,24,3],[5,8,20,2.6]]) {
  const per=Math.pow(total,1/stages), amp=amplitudeFor(per)*L0/(Math.PI*N0);
  console.log(`stages=${stages} total=x${total} N0=${N0} -> per-stage x${per.toFixed(3)}, first ripple amp ~${amp.toFixed(1)}px (R=${R0})`);
}
const towers=[
  ['t1','3 stages, x3',{stages:3,totalStretch:3,N0:24,ratio:3}],
  ['t2','4 stages, x5',{stages:4,totalStretch:5,N0:24,ratio:3}],
  ['t3','5 stages, x8',{stages:5,totalStretch:8,N0:20,ratio:2.6}],
];
for(const [id,label,opt] of towers){
  const t=corrugationTower(circle(R0),opt);
  shot('c2-'+id,label+` (len x${(curveLength(t.curve)/L0).toFixed(2)})`,[{points:t.curve}]);
}
// spatially varying surplus: smooth arcs vs deeply crinkled arcs
const field=(s,k)=>Math.pow(0.5+0.5*Math.cos(2*Math.PI*(3*s+0.11*k)),3);
const v=corrugationTower(circle(R0),{stages:5,totalStretch:9,N0:20,ratio:2.6,stretchField:field});
shot('c2-varied','stretch varying along the curve',[{points:v.curve}]);
// nested rings, surplus increasing outward
const nest=[];
for(let i=0;i<16;i++){const R=70+i*17;
  const t=corrugationTower(circle(R,700),{stages:4,totalStretch:1.02+i*0.42,N0:26,ratio:2.8});
  nest.push({points:t.curve});}
shot('c2-nest','16 rings, surplus increasing outward',nest,0.4);
console.log(sheet(`${OUT}/corr2.html`,entries,{cols:3,title:'Corrugation towers — tuned'}));
