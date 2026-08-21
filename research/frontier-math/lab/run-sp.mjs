import { render, sheet, OUT, rng } from './lab.mjs';
import { relax, domains } from './sandpile.mjs';
import { thin, straightRuns } from './vectorize.mjs';
const entries=[];
function make(id,label,N,dom,pts,{S=1200,lw=0.8,pw=680,tol=1.1}={}){
  const t0=Date.now();
  const r=relax(N,N,dom,pts);
  const sk=thin(r.dev,N,N);
  const runs=straightRuns(sk,N,N,{tol,minLen:4});
  const k=(S-60)/N, off=30;
  const lines=runs.map(([a,b])=>({points:[{x:a[0]*k+off,y:a[1]*k+off},{x:b[0]*k+off,y:b[1]*k+off}]}));
  const info=render(id,lines,S,S,{width:lw,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — ${runs.length} straight segments`});
  console.log(id.padEnd(12),'pts='+pts.length,'segments='+runs.length,'topples='+r.topples,((Date.now()-t0)/1000).toFixed(1)+'s');
  return info;
}
const N=701;
const pick=(k,seed,dom)=>{const r=rng(seed),o=[];let g=0;
  while(o.length<k&&g++<k*300){const x=(r()*N)|0,y=(r()*N)|0;if(dom(x,y))o.push([x,y]);}return o;};
const rect=domains.rect(N,N), disk=domains.disk(N,N), hex=domains.ngon(N,N,6,0.2), tri=domains.ngon(N,N,3,Math.PI/2);
make('v-7','square domain, 7 points',N,rect,[[150,180],[430,200],[300,430],[200,380],[420,420],[300,120],[110,330]]);
make('v-40','square domain, 40 points',N,rect,pick(40,17,rect));
make('v-120','square domain, 120 points',N,rect,pick(120,31,rect));
make('v-disk60','disk domain, 60 points',N,disk,pick(60,5,disk));
make('v-hex80','hexagon domain, 80 points',N,hex,pick(80,13,hex));
make('v-tri60','triangle domain, 60 points',N,tri,pick(60,29,tri));
console.log(sheet(`${OUT}/sandpile.html`,entries,{cols:3,title:'Tropical sandpile — vectorised'}));
