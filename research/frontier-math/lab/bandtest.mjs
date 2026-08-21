// fBm with persistence p and lacunarity l has amplitude p^n at frequency l^n,
// i.e. an envelope |k|^{-log(1/p)/log(l)}. At the repo default p=0.5, l=2 that
// is exactly |k|^{-1} -- the SAME exponent as the 2D Gaussian free field.
// The only difference is that fBm truncates the spectrum to `octaves` shells.
// So the honest test is: band-limit a GFF to N octaves and see when it stops
// being log-correlated over the range a pen can actually resolve.
import { rng, gauss } from './lab.mjs';
import { covarianceProfile } from './gff.mjs';

function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
    if (i < j) { [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; } }
  for (let l = 2; l <= n; l <<= 1) { const a=(inv?2:-2)*Math.PI/l, wr=Math.cos(a), wi=Math.sin(a);
    for (let i = 0; i < n; i += l) { let cr=1, ci=0;
      for (let k = 0; k < l/2; k++) { const ur=re[i+k], ui=im[i+k];
        const vr=re[i+k+l/2]*cr-im[i+k+l/2]*ci, vi=re[i+k+l/2]*ci+im[i+k+l/2]*cr;
        re[i+k]=ur+vr; im[i+k]=ui+vi; re[i+k+l/2]=ur-vr; im[i+k+l/2]=ui-vi;
        const nc=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=nc; } } }
  if (inv) for (let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
function fft2(re, im, N, inv) { const rr=new Float64Array(N), ii=new Float64Array(N);
  for (let y=0;y<N;y++){for(let x=0;x<N;x++){rr[x]=re[y*N+x];ii[x]=im[y*N+x];}fft(rr,ii,inv);
    for(let x=0;x<N;x++){re[y*N+x]=rr[x];im[y*N+x]=ii[x];}}
  for (let x=0;x<N;x++){for(let y=0;y<N;y++){rr[y]=re[y*N+x];ii[y]=im[y*N+x];}fft(rr,ii,inv);
    for(let y=0;y<N;y++){re[y*N+x]=rr[y];im[y*N+x]=ii[y];}} }

/** 1/|k| field, band-limited to `octaves` starting at the largest scale. */
export function bandLimited(N, seed, octaves) {
  const r = rng(seed);
  const re = new Float64Array(N*N), im = new Float64Array(N*N);
  for (let i=0;i<N*N;i++) re[i]=gauss(r);
  fft2(re, im, N, false);
  const kmax = octaves === Infinity ? Infinity : Math.pow(2, octaves);
  for (let ky=0;ky<N;ky++) for (let kx=0;kx<N;kx++) {
    const i=ky*N+kx;
    if (kx===0&&ky===0){re[i]=0;im[i]=0;continue;}
    const fx=Math.min(kx,N-kx), fy=Math.min(ky,N-ky);
    const k=Math.hypot(fx,fy);
    if (k > kmax) { re[i]=0; im[i]=0; continue; }        // truncate to the octave band
    const s1=Math.sin(Math.PI*kx/N), s2=Math.sin(Math.PI*ky/N);
    const f=Math.pow(4*(s1*s1+s2*s2), -0.5);
    re[i]*=f; im[i]*=f;
  }
  fft2(re, im, N, true);
  let m=0; for(let i=0;i<N*N;i++)m+=re[i]; m/=N*N;
  let v=0; for(let i=0;i<N*N;i++){const d=re[i]-m;v+=d*d;}
  const sd=Math.sqrt(v/(N*N)); const h=new Float64Array(N*N);
  for(let i=0;i<N*N;i++)h[i]=(re[i]-m)/sd;
  return {h,N};
}
const fit=(p)=>{const xs=p.map(q=>Math.log(q.d)),ys=p.map(q=>q.cov);
  const n=xs.length,mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;
  let num=0,den=0;for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)**2;}
  const s=num/den;let ss=0,st=0;
  for(let i=0;i<n;i++){const pr=my+s*(xs[i]-mx);ss+=(ys[i]-pr)**2;st+=(ys[i]-my)**2;}
  return {slope:s,r2:1-ss/st};};
const D=[2,4,8,16,32,64];
console.log('1/|k| field truncated to a finite octave band (= fBm at p=0.5, l=2):\n');
console.log('  octaves   scale range   cov vs ln r: slope     R^2   (log-correlated => high R^2)');
for (const oct of [2,3,4,5,7,Infinity]) {
  const f = bandLimited(512, 42, oct);
  const r = fit(covarianceProfile(f, D));
  const range = oct===Infinity ? 'all' : `${Math.pow(2,oct)}:1`;
  console.log('  '+String(oct===Infinity?'inf':oct).padStart(7), range.padStart(13),
    r.slope.toFixed(4).padStart(18), r.r2.toFixed(4).padStart(8));
}
console.log('\nA3 at 0.3mm nib resolves about 297/0.3 = 990:1, i.e. ~10 octaves.');
