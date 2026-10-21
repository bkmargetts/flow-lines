const SEED=3,SPIN=0.6,SHADE=0.9,LIGHT=-2.2;
import {generateSportsBalls,toSVG} from '../../packages/core/dist/index.js';
import fs from 'fs';
const K=3, S=0.55; // px per mm, plate scale (real cm -> mm*S)
const W=297*K,H=420*K;
const balls=[ // type, real diameter cm, centre mm
 ['basketball',24.0,88,98],['soccer',22.0,220,180],['volleyball',21.0,98,282],
 ['baseball',7.4,222,286],['tennis',6.7,252,342],['pingpong',4.0,184,338]];
let lines=[];
const sh=(l,dx,dy,layer)=>({...l,layer:layer??l.layer,points:l.points.map(p=>({x:p.x+dx,y:p.y+dy}))});
balls.forEach(([t,cm,cx,cy],i)=>{
 const d=cm*10*S*K, box=Math.ceil(d+40);
 const r=generateSportsBalls({width:box,height:box,margin:10,seed:SEED+i,count:1,mix:{[t]:1},ballScale:d,scaleVariance:0,trueSizes:0,spin:SPIN,shading:SHADE,castShadows:0.5,penWidth:1,wobble:0.5,lightAngle:LIGHT});
 for(const l of r.lines) lines.push(sh(l,cx*K-box/2,cy*K-box/2));
 // dimension line
 const rr=d/2, y=cy*K+rr+10*K, x0=cx*K-rr, x1=cx*K+rr, e=3*K;
 const P=(...a)=>({layer:'dim',points:a.map(([x,y])=>({x,y}))});
 lines.push(P([x0,cy*K+rr+3*K],[x0,y+e]),P([x1,cy*K+rr+3*K],[x1,y+e]),P([x0-e,y],[x1+e,y]));
 lines.push(P([x0-e*.5,y+e*.5],[x0+e*.5,y-e*.5]),P([x1-e*.5,y+e*.5],[x1+e*.5,y-e*.5]));
});
// scale bar 0-10cm
const bx=40*K,by=398*K,u=10*S*K; // 1 cm
lines.push({layer:'dim',points:[{x:bx,y:by},{x:bx+10*u,y:by}]});
for(let i=0;i<=10;i++) lines.push({layer:'dim',points:[{x:bx+i*u,y:by},{x:bx+i*u,y:by-(i%5==0?4:2)*K}]});
lines.push({layer:'dim',points:[{x:bx,y:by+2*K},{x:bx+10*u,y:by+2*K}]});
const out=(ls,f)=>fs.writeFileSync(f,toSVG({width:W,height:H,lines:ls},{strokeWidth:1,physicalWidth:'297mm',physicalHeight:'420mm'}));
out(lines.filter(l=>l.layer!=='dim'),'artwork-layer-1.svg');
out(lines.filter(l=>l.layer==='dim'),'artwork-layer-2.svg');
