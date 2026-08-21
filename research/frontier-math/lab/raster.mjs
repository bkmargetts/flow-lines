import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
const crcT=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc=(b)=>{let c=0xFFFFFFFF;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);
  const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
/** rgb(x,y) -> [r,g,b] */
export function writePNG(path,W,H,rgb){
  const raw=Buffer.alloc(H*(W*3+1));
  for(let y=0;y<H;y++){raw[y*(W*3+1)]=0;
    for(let x=0;x<W;x++){const c=rgb(x,y),o=y*(W*3+1)+1+x*3;raw[o]=c[0];raw[o+1]=c[1];raw[o+2]=c[2];}}
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4); ihdr[8]=8; ihdr[9]=2;
  writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
  return path;
}
