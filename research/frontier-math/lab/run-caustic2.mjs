import { render, sheet, OUT } from './lab.mjs';
import { tropicalCaustic, waveFronts, tropicalInradius, shapes } from './caustic.mjs';
const entries=[];
function draw(id,label,poly,N,{W=1150,H=1150,pad=40,nlev=140,power=3.2,lw=0.5,pw=680,skel=true,fronts=true}={}){
  const t0=Date.now();
  const R=tropicalInradius(poly,N);
  const levels=Array.from({length:nlev},(_,i)=>R*Math.pow((i+0.5)/nlev,power));
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of poly){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  const s=Math.min((W-2*pad)/(x1-x0),(H-2*pad)/(y1-y0));
  const M=(p)=>({x:(p[0]-x0)*s+(W-(x1-x0)*s)/2, y:H-((p[1]-y0)*s+(H-(y1-y0)*s)/2)});
  const lines=[];
  if(fronts) for(const f of waveFronts(poly,N,levels)) lines.push({points:[...f.poly,f.poly[0]].map(M)});
  if(skel) for(const [p,q] of tropicalCaustic(poly,N).edges) lines.push({points:[M(p),M(q)],color:'#c0392b'});
  const info=render(id,lines,W,H,{width:lw,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — N=${N}, ${info.strokes} strokes`});
  console.log(id.padEnd(14),'N='+N,info.strokes+' strokes',info.segments+' segs',((Date.now()-t0)/1000).toFixed(1)+'s');
}
draw('w-disk','disk',shapes.disk(1,384),40);
draw('w-disk-hi','disk, deeper',shapes.disk(1,512),96,{nlev:200,power:4});
draw('w-ell','ellipse 1.7 x 1',shapes.ellipse(1.7,1,384),64,{nlev:180,power:3.6});
draw('w-ell-rot','ellipse, rotated 0.4 rad',shapes.ellipse(1.7,1,384,0.4),64,{nlev:180,power:3.6});
draw('w-pent','regular pentagon',shapes.ngon(5,1.2,0.3),64,{nlev:180,power:3.6});
draw('w-sq','square (rational slopes)',shapes.square(2),40,{nlev:120,power:1.6});
console.log(sheet(`${OUT}/caustic2.html`,entries,{cols:3,title:'Tropical wave fronts + caustic'}));
