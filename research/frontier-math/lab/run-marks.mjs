import { render, sheet, OUT } from './lab.mjs';
import { shuffleAztec, validate, dominoEdges } from './aztec.mjs';
import { spines, weldedSpines } from './marks.mjs';
function fit(lines,W,H,pad=30){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const l of lines)for(const p of l.points){if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y;}
 const s=Math.min((W-2*pad)/(x1-x0),(H-2*pad)/(y1-y0));
 return lines.map(l=>({...l,points:l.points.map(p=>({x:(p.x-x0)*s+(W-(x1-x0)*s)/2,y:(p.y-y0)*s+(H-(y1-y0)*s)/2}))}));}
const W=1000,H=1000,n=90;
const T=shuffleAztec(n,20260821); console.log(JSON.stringify(validate(T)));
const variants=[
  ['edges','all domino outlines',dominoEdges(T,6)],
  ['spines','one dash per domino',spines(T)],
  ['welded','dashes welded where collinear',weldedSpines(T)],
  ['welded-NS','welded, horizontal dominoes only',weldedSpines(T,{only:['N','S']})],
  ['welded-N','welded, one type only (N)',weldedSpines(T,{only:['N']})],
  ['welded-NE','welded, N + E only',weldedSpines(T,{only:['N','E']})],
];
const entries=[];
for(const [id,label,raw] of variants){
  const lines=fit(raw,W,H);
  const info=render(`mk-${id}`,lines,W,H,{width:0.8,pngWidth:640});
  entries.push({png:info.png,label:`${label} — ${info.strokes} strokes / ${info.segments} segs`});
  console.log(id.padEnd(12), info.strokes, 'strokes', info.segments,'segs');
}
console.log(sheet(`${OUT}/marks.html`,entries,{cols:3,title:`AD(${n}) — mark strategies`}));
