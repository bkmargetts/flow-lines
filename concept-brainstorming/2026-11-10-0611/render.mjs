// node concept-brainstorming/2026-11-10-0611/render.mjs  (after pnpm build)
import {writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const {generateCity,toSVG}=await import('../../packages/core/dist/index.js');
const W=420,H=297;
const r=generateCity({width:W,height:H,margin:15,seed:11,order:0.12,style:'towers',blockCols:7,blockRows:5,density:0.8,windows:0.5,penWidth:0.35});
writeFileSync(join(dirname(fileURLToPath(import.meta.url)),'artwork.svg'),toSVG(r,{optimize:true,widthMm:W,heightMm:H}));
