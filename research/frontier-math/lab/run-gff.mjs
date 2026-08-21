import { render, sheet, OUT } from './lab.mjs';
import { sampleGFF, flowLines } from './gff.mjs';
const W=1000,H=1000;
const entries=[];
const seedsRow=(n,y)=>Array.from({length:n},(_,i)=>({x:(i+0.5)*W/n,y}));
function shot(id,label,lines,w=0.7){const info=render(id,lines,W,H,{width:w,pngWidth:640});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes, ${info.segments} segs`});
  console.log(id.padEnd(22),info.strokes,'strokes',info.segments,'segs');return info;}

const cases=[
  ['gff-rough100','GFF (rough=1.0) — true log-correlated field',1.0,1.2,true],
  ['gff-rough060','rough=0.6 — partially smoothed',0.6,1.2,true],
  ['gff-rough025','rough=0.25 — essentially smooth noise',0.25,1.2,true],
  ['gff-nomerge','GFF, merging DISABLED (what a smooth field must look like)',1.0,1.2,false],
];
for(const [id,label,rough,chi,merge] of cases){
  const f=sampleGFF(512, 2026, {rough});
  const lines=flowLines(f,{chi,theta:-Math.PI/2,seeds:seedsRow(400,H-4),W,H,mergeEnabled:merge,step:0.7,maxSteps:4000});
  shot(id,label,lines);
}
// chi sweep on the true GFF
for(const chi of [0.6,1.0,1.8,3.0]){
  const f=sampleGFF(512, 2026, {rough:1});
  const lines=flowLines(f,{chi,theta:-Math.PI/2,seeds:seedsRow(400,H-4),W,H,step:0.7,maxSteps:4000});
  shot('gff-chi'+String(chi).replace('.',''),`GFF, chi=${chi}`,lines);
}
console.log(sheet(`${OUT}/gff.html`,entries,{cols:4,title:'Imaginary geometry — GFF flow lines'}));
