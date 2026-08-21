import { render, sheet, OUT } from './lab.mjs';
import { tropicalCaustic, shapes } from './caustic.mjs';
const W=1100,H=1100, entries=[];
function draw(id,label,poly,N,{W:w0=W,H:h0=H,pad=40,lw=0.8,pw=640,outline=true}={}){
  const t0=Date.now();
  const {edges,cells}=tropicalCaustic(poly,N);
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of poly){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  const s=Math.min((w0-2*pad)/(x1-x0),(h0-2*pad)/(y1-y0));
  const M=(p)=>({x:(p[0]-x0)*s+(w0-(x1-x0)*s)/2, y:h0-((p[1]-y0)*s+(h0-(y1-y0)*s)/2)});
  const lines=edges.map(([p,q])=>({points:[M(p),M(q)]}));
  if(outline) lines.push({points:[...poly,poly[0]].map(M),color:'#bbb'});
  const info=render(id,lines,w0,h0,{width:lw,pngWidth:pw});
  entries.push({png:info.png,label:`${label} — N=${N}, ${edges.length} edges, ${cells.length} cells`});
  console.log(id.padEnd(16),'N='+N,edges.length+' edges',((Date.now()-t0)/1000).toFixed(1)+'s');
}
draw('c-square','square (rational slopes -> finite)',shapes.square(2),12);
draw('c-disk16','disk',shapes.disk(1,256),16);
draw('c-disk48','disk',shapes.disk(1,256),48);
draw('c-disk128','disk',shapes.disk(1,384),128,{lw:0.55});
draw('c-ell','ellipse 1.6 x 1',shapes.ellipse(1.6,1,256),64,{lw:0.6});
draw('c-pent','regular pentagon (irrational slopes)',shapes.ngon(5,1,0.3),64,{lw:0.6});
console.log(sheet(`${OUT}/caustic.html`,entries,{cols:3,title:'Tropical caustics'}));
