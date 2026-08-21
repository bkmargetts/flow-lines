import { render, sheet, OUT } from './lab.mjs';
import { shuffleAztec, validate, dominoEdges } from './aztec.mjs';
function fit(lines,W,H,pad=30){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const l of lines)for(const p of l.points){if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y;}
 const s=Math.min((W-2*pad)/(x1-x0),(H-2*pad)/(y1-y0));
 return lines.map(l=>({...l,points:l.points.map(p=>({x:(p.x-x0)*s+(W-(x1-x0)*s)/2,y:(p.y-y0)*s+(H-(y1-y0)*s)/2}))}));}
const W=1000,H=1000,entries=[];
for (const n of [30, 64, 120]) {
  const T=shuffleAztec(n,20260821); console.log('n='+n, JSON.stringify(validate(T)));
  const lines=fit(dominoEdges(T,6),W,H);
  const info=await render(`aztec-n${n}`,lines,W,H,{width:n>90?0.55:0.9,pngWidth:900});
  entries.push({png:info.png,label:`AD(${n}) — ${info.segments} segments`});
  console.log(info.png, info.segments);
}
sheet(`${OUT}/aztec.html`,entries,{cols:3,title:'Aztec diamond — exact uniform domino tilings'});
