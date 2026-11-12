// QA-only non-official numerical candidate. No production HDR imports this file.
// atan reduction to |z| <= sqrt(2)-1, followed by the degree17 odd series.
export const ATAN_CANDIDATE_VERSION='range-reduced-taylor17-v1';
export const ATAN_CANDIDATE_RADIANS_GATE=1e-6;
export const ACCURATE_ATAN2_GLSL=`
// QA_ACCURATE_ATAN2_BEGIN: non-official arithmetic substitution, no colour tuning.
float qaAccurateAtan2(float y, float x)
{
    uint xb = floatBitsToUint(x), yb = floatBitsToUint(y);
    uint ax = xb & 0x7fffffffu, ay = yb & 0x7fffffffu;
    bool sx = (xb & 0x80000000u) != 0u, sy = (yb & 0x80000000u) != 0u;
    if (ax > 0x7f800000u || ay > 0x7f800000u) return uintBitsToFloat(0x7fc00000u);
    float a;
    if (ay == 0u) a = 0.0;
    else if (ax == 0u) a = 1.57079632679489661923;
    else if (ax == 0x7f800000u || ay == 0x7f800000u)
        a = ax == ay ? 0.78539816339744830962 : (ay == 0x7f800000u ? 1.57079632679489661923 : 0.0);
    else
    {
        uint hi = max(ax, ay), lo = min(ax, ay);
        float r;
        // Integer mantissas preserve ratios when both finite inputs are subnormal.
        // Mixed subnormal/normal scaling avoids dividing an FTZ operand directly.
        if (hi < 0x00800000u) r = float(lo) / float(hi);
        else if (lo < 0x00800000u)
            r = (float(lo) / float((hi & 0x007fffffu) | 0x00800000u)) * exp2(1.0 - float(hi >> 23u));
        else r = uintBitsToFloat(lo) / uintBitsToFloat(hi);
        bool reduce = r > 0.41421356237309504880;
        float z = reduce ? (r - 1.0) / (r + 1.0) : r;
        float z2 = z * z;
        float p = 1.0 / 17.0;
        p = -1.0 / 15.0 + z2 * p;
        p = 1.0 / 13.0 + z2 * p;
        p = -1.0 / 11.0 + z2 * p;
        p = 1.0 / 9.0 + z2 * p;
        p = -1.0 / 7.0 + z2 * p;
        p = 1.0 / 5.0 + z2 * p;
        p = -1.0 / 3.0 + z2 * p;
        a = z * (1.0 + z2 * p);
        if (reduce) a += 0.78539816339744830962;
        if (ay > ax) a = 1.57079632679489661923 - a;
    }
    if (sx) a = 3.14159265358979323846 - a;
    // Explicit signed zero, independent of compiler unary-minus folding.
    return uintBitsToFloat(floatBitsToUint(a) | (sy ? 0x80000000u : 0u));
}
// QA_ACCURATE_ATAN2_END
`;

const scratch=new ArrayBuffer(4),floats=new Float32Array(scratch),uints=new Uint32Array(scratch),f=Math.fround;
export function float32Bits(x){floats[0]=x;return uints[0];}
export function bitsFloat32(x){uints[0]=x;return floats[0];}
// Explicit float32-operation emulation is a CPU test subject, not the libm oracle.
export function accurateAtan2Float32(y,x){
  const xb=float32Bits(x),yb=float32Bits(y),ax=xb&0x7fffffff,ay=yb&0x7fffffff,sx=(xb>>>31)!==0,sy=(yb>>>31)!==0;
  if(ax>0x7f800000||ay>0x7f800000)return NaN;
  let a;
  if(ay===0)a=0;
  else if(ax===0)a=f(Math.PI/2);
  else if(ax===0x7f800000||ay===0x7f800000)a=ax===ay?f(Math.PI/4):ay===0x7f800000?f(Math.PI/2):0;
  else{
    const hi=Math.max(ax,ay),lo=Math.min(ax,ay);let r;
    if(hi<0x00800000)r=f(f(lo)/f(hi));
    else if(lo<0x00800000)r=f(f(f(lo)/f((hi&0x007fffff)|0x00800000))*f(2**(1-(hi>>>23))));
    else r=f(bitsFloat32(lo)/bitsFloat32(hi));
    const reduce=r>f(Math.SQRT2-1),z=reduce?f(f(r-1)/f(r+1)):r,z2=f(z*z);
    let p=f(1/17);for(let k=15;k>=3;k-=2)p=f(f((k%4===1?1:-1)/k)+f(z2*p));
    a=f(z*f(1+f(z2*p)));if(reduce)a=f(a+f(Math.PI/4));if(ay>ax)a=f(f(Math.PI/2)-a);
  }
  if(sx)a=f(f(Math.PI)-a);
  return bitsFloat32(float32Bits(a)|(sy?0x80000000:0));
}

export function buildAccurateAtan2Candidate(original){
  const from='atan(Aab.b, Aab.g)',to='qaAccurateAtan2(Aab.b, Aab.g)';
  if(typeof original!=='string'||original.split(from).length-1!==1||original.includes('QA_ACCURATE_ATAN2_BEGIN')||original.includes(to))throw Error('Exactly one untouched official atan2 call is required');
  const prefix=ACCURATE_ATAN2_GLSL+'\n',source=prefix+original.replace(from,to);
  return {source,from,to,prefix,normalize(candidate){
    if(!candidate.startsWith(prefix)||candidate.split(to).length-1!==1||candidate.includes(from)||candidate.split('QA_ACCURATE_ATAN2_BEGIN').length-1!==1)throw Error('Candidate substitution scope is not exact');
    return candidate.slice(prefix.length).replace(to,from);
  }};
}

export function makeAtanFixtureCases(){
  const rows=[],add=(id,y,x)=>rows.push({id,y:Math.fround(y),x:Math.fround(x)});
  for(const y of [0,-0,1,-1,Infinity,-Infinity])for(const x of [0,-0,1,-1,Infinity,-Infinity])add('axes-special-'+rows.length,y,x);
  add('nan-y',NaN,1);add('nan-x',1,NaN);
  const ratios=[0,1e-30,1e-12,.00001,.01,.2,Math.SQRT2-1-1e-6,Math.SQRT2-1,Math.SQRT2-1+1e-6,.5,.8,1-1e-6,1];
  for(const r of ratios)for(const scale of [1,2**-120,2**120])for(const sx of [-1,1])for(const sy of [-1,1]){add('ratio-'+rows.length,sy*r*scale,sx*scale);add('swap-'+rows.length,sy*scale,sx*r*scale);}
  const tiny=[bitsFloat32(1),bitsFloat32(2),bitsFloat32(0x007fffff),bitsFloat32(0x00800000)],huge=bitsFloat32(0x7f7fffff);
  for(const y of tiny)for(const x of [...tiny,1,huge])for(const sx of [-1,1])for(const sy of [-1,1]){add('finite-extreme-'+rows.length,sy*y,sx*x);add('finite-extreme-swap-'+rows.length,sy*x,sx*y);}
  return rows;
}
