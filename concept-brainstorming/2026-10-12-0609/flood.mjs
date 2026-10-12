import { writeFileSync } from 'node:fs';
const { generateCity, toSVG, PAPER_SIZES } = await import('/home/user/flow-lines/packages/core/dist/index.js');
const [,, seedA='7', orderA='0.25', styleA='towers', outA='out'] = process.argv;
const seed=+seedA, order=+orderA;
// A3 landscape in mm; 1 unit = 1mm
const W=420,H=297,M=14;
const res = generateCity({ width:W, height:H, margin:M, seed, order, style:styleA, blockCols:6, blockRows:2,
  lotSize:24, street:8, buildingHeight:95, storey:5.2, windowSize:4.5, hatchSpacing:1.6, downtown:0.8, heightVariance:0.7, penWidth:0.35 });
// Waterline: city bbox bottom
let minY=1e9,maxY=-1e9;
for(const l of res.lines) for(const p of l.points){minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
console.error('bbox y',minY,maxY, 'lines',res.lines.length);
const waterY = Math.min(maxY, H*0.64);
// city layer: clip above waterline
const clipAbove=(pts,y)=>{const runs=[];let cur=[];for(const p of pts){if(p.y<=y)cur.push(p);else{if(cur.length>1)runs.push(cur);cur=[];}}if(cur.length>1)runs.push(cur);return runs;};
const city=[];
for(const l of res.lines) for(const r of clipAbove(l.points,waterY)) city.push({...l,points:r});
// reflection: mirror about waterY, vertically squash, ripple horizontally, with horizontal gaps growing with depth
const refl=[];
let k=0;
const rnd=(i)=>{const x=Math.sin(i*127.1+seed*311.7)*43758.5453;return x-Math.floor(x);};
const SQ=0.85;
for(const l of city){
  const pts=l.points.map(p=>{const d=waterY-p.y;const y=waterY+d*SQ;
    const bb=Math.floor((y-waterY)/1.8);const x=p.x+(rnd(bb+7)-0.5)*Math.min(5,0.5+d*0.08);return{x,y};});
  // cut into bands: drop bands by ripple stripes
  let cur=[];
  for(const p of pts){
    if(p.y>H-M){ if(cur.length>1)refl.push({...l,points:cur});cur=[];continue;}
    const t=(p.y-waterY)/(H-M-waterY);
    const band=Math.floor((p.y-waterY)/1.6);
    const gap=rnd(band)<0.06+0.5*t || (Math.floor((p.y-waterY)/0.8)%2===0&&t>0.7&&rnd(band+99)<0.5);
    if(gap){ if(cur.length>1)refl.push({...l,points:cur}); cur=[]; } else cur.push(p);
  }
  if(cur.length>1)refl.push({...l,points:cur});
}
// waterline strokes
const wl=[];
for(let i=0;i<46;i++){const y=waterY+2+i*i*0.075+rnd(i+500)*1.5;if(y>H-M)break;
  let x=M+rnd(i)*40;while(x<W-M){const len=10+rnd(x+i)*60*(1+i/20);if(rnd(x*3+i)>0.35+i*0.008)wl.push({points:[{x,y},{x:Math.min(x+len,W-M),y:y+Math.sin(x)*0.15}]});x+=len+6+rnd(x+7)*14;}}
const moon=[];const mx=356,my=70,mr=22;
for(let pass=0;pass<2;pass++){const pts=[];for(let a=0;a<=Math.PI*2+0.05;a+=0.05){const r=mr+pass*0.45+Math.sin(a*3+seed)*0.12;pts.push({x:mx+Math.cos(a)*r+pass*0.2,y:my+Math.sin(a)*r});}moon.push({points:pts});}
const cx2=mx+9,cr=19.5;
for(let y=my-mr+1;y<my+mr;y+=1.15){const dy=y-my;const h=Math.sqrt(Math.max(0,mr*mr-dy*dy));const x0=mx-h+0.8;const d2=cr*cr-dy*dy;let x1=mx+h-0.8;if(d2>0)x1=Math.min(x1,cx2-Math.sqrt(d2));if(x1-x0>1.5)moon.push({points:[{x:x0,y:y},{x:x1,y:y+0.5+(rnd(y)-0.5)*0.4}]});}
const occ=new Set();for(const l of city)for(const p of l.points)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)occ.add((Math.floor(p.x/7)+a)+','+(Math.floor(p.y/7)+b));
const stars=[];for(let i=0;i<70;i++){const x=M+rnd(i*3+1)*(W-2*M),y=M+rnd(i*3+2)*(waterY-M-30);if(Math.hypot(x-mx,y-my)<mr+10||occ.has(Math.floor(x/7)+','+Math.floor(y/7)))continue;const r=0.3+rnd(i+9)*0.8;stars.push({points:[{x:x-r,y},{x:x+r,y}]},{points:[{x,y:y-r},{x,y:y+r}]});}
const glint=[];for(let y=waterY+3;y<H-M;y+=1.7){const t=(y-waterY)/(H-M-waterY);const w=(mr*0.9)*(1-0.4*t)*(0.4+rnd(y*5)*0.8);if(rnd(y*7)<0.55)glint.push({points:[{x:mx-w/2+(rnd(y)-0.5)*4,y},{x:mx+w/2+(rnd(y)-0.5)*4,y}]});}
const mk=(lines,layer)=>({width:W,height:H,lines:lines.map(l=>({...l,layer}))});
const opt={physicalWidth:W,physicalHeight:H,strokeWidth:0.35,optimizePaths:true};
writeFileSync(outA+'-city.svg',toSVG(mk(city,'city'),opt));
writeFileSync(outA+'-moon.svg',toSVG(mk([...moon,...stars,...glint],'moon'),opt));
writeFileSync(outA+'-water.svg',toSVG(mk([...refl,...wl],'water'),opt));
