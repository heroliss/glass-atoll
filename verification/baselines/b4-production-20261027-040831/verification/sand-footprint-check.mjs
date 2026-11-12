import fs from 'node:fs';
import crypto from 'node:crypto';
import {sandAlbedoGLSL} from '../sand.js';
const source=fs.readFileSync(new URL('../sand.js',import.meta.url),'utf8');
const baseline=fs.readFileSync(new URL('./baselines/sand-v6-before-footprint.js',import.meta.url),'utf8');
const checks=[];const check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Execute the actual scalar filter expression, rather than a separate chosen
// transition. Vector noise mirrors the unchanged authored field for A/B math.
const weightExpression=sandAlbedoGLSL.match(/float sandNoiseResolve\([^)]*\)\{return ([^;]+);\}/)[1];
const weight=new Function('cellsPerPixel','smoothstep',`return ${weightExpression};`);
const resolve=x=>weight(x,smoothstep);
const grainResolve=x=>1-smoothstep(.00065,.0028,x);
const textureResolve=x=>1-smoothstep(1,3,x);
let hashCalls=0;
function hash(x,y){
  hashCalls++;let a=fract(x*.1031),b=fract(y*.1031),c=a;
  const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);a+=d;b+=d;c+=d;
  return fract((a+b)*c);
}
function noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y),fx=smoothstep(0,1,fract(x)),fy=smoothstep(0,1,fract(y));
  return mix(mix(hash(ix,iy),hash(ix+1,iy),fx),mix(hash(ix,iy+1),hash(ix+1,iy+1),fx),fy);
}
function filteredNoise(x,y,footprint){const w=resolve(footprint);return w<=0?.5:mix(.5,noise(x,y),w);}
function fbm(x,y,footprint=0,filtered=true){
  const sample=(x,y,f)=>filtered?filteredNoise(x,y,f):noise(x,y);
  let v=.55*sample(x,y,footprint),xx=(.8*x+.6*y)*2.07+7.3,yy=(-.6*x+.8*y)*2.07+7.3;
  v+=.28*sample(xx,yy,footprint*2.07);
  return v+.17*sample((.6*xx+.8*yy)*2.03+13.1,(-.8*xx+.6*yy)*2.03+13.1,footprint*2.07*2.03);
}
function wet(x,y,h,footprint,filtered){
  if(filtered&&h<=.008)return 1;if(filtered&&h>=.1935)return 0;
  const sample=(x,y,f)=>filtered?filteredNoise(x,y,f):noise(x,y);
  const edge=.13+.055*(sample(x*.72,y*.72,footprint*.72)-.5)+.022*(sample(x*2.1,y*2.1,footprint*2.1)-.5);
  return 1-smoothstep(.008,edge+.025,h);
}
let monotonic=true,previous=1,finite=true;
for(let i=0;i<=10000;i++){const value=resolve(i*.0001);finite&&=Number.isFinite(value)&&value>=0&&value<=1;monotonic&&=value<=previous+1e-15;previous=value;}
check('actual octave weight finite bounded and monotone',finite&&monotonic,{expression:weightExpression});
check('full near response and zero beyond Nyquist support',resolve(0)===1&&resolve(.25)===1&&resolve(.5)===0&&resolve(10000)===0,{});
const boundaryError=Math.max(Math.abs(resolve(.25-1e-7)-resolve(.25+1e-7)),Math.abs(resolve(.5-1e-7)-resolve(.5+1e-7)));
check('filter is continuous at both transition boundaries',boundaryError<1e-10,{boundaryError});
let nearDifference=0,wetDifference=0;
for(let i=0;i<1024;i++){
  const x=Math.sin(i*3.17)*100,z=Math.cos(i*1.13)*100;
  for(const scale of [.13,.63,.14])nearDifference=Math.max(nearDifference,Math.abs(fbm(x*scale,z*scale,.0028*scale,true)-fbm(x*scale,z*scale,0,false)));
  for(const h of [-10,.008,.012,.06,.13,.18,.1935,1.3])wetDifference=Math.max(wetDifference,Math.abs(wet(x,z,h,.0028,true)-wet(x,z,h,0,false)));
}
check('near FBM field preserved at millimetre pixel footprint',nearDifference<1e-14,{nearDifference,footprintMetres:.0028});
check('near wetness and exact wet/dry shortcuts match baseline',wetDifference<1e-14,{wetDifference});
hashCalls=0;const far=fbm(1783.13,-832.27,10,true),farHashCalls=hashCalls;
check('unresolved FBM returns normalized mean without hashes',far===.5&&farHashCalls===0,{far,farHashCalls});
hashCalls=0;wet(317,-416,-3,1,true);const underwaterWetHashCalls=hashCalls;
hashCalls=0;wet(317,-416,1.3,1,true);const dryWetHashCalls=hashCalls;
check('constant underwater/dry wetness skips both noise fields',underwaterWetHashCalls===0&&dryWetHashCalls===0,{underwaterWetHashCalls,dryWetHashCalls});
check('zero grain support leaves original multiplier unchanged',grainResolve(.0028)===0&&grainResolve(1)===0&&source.includes('if(resolve>0.)'),{});
let tileMonotonic=true,oldWeight=1;
for(let i=0;i<=1000;i++){const w=textureResolve(i*.005);tileMonotonic&&=w<=oldWeight+1e-15;oldWeight=w;}
check('texture mean transition is continuous and monotone',tileMonotonic&&textureResolve(1)===1&&textureResolve(3)===0&&source.includes('if(resolved<=0.)return uSandColorMean'),{tileRange:[1,3],metresAtPublishedScale:[2.14,6.42]});
const photoBody=sandAlbedoGLSL.slice(sandAlbedoGLSL.indexOf('vec3 sandPhotographedColour'),sandAlbedoGLSL.indexOf('float sandWetness'));
check('texture gradients supplied outside varying texture branch',!photoBody.includes('dFdx(')&&!photoBody.includes('dFdy(')&&(photoBody.match(/textureGrad\(/g)||[]).length===3,{});
check('published tile size and albedo constants unchanged',source.includes('fineTileMetres=2.14')&&baseline.includes('fineTileMetres=2.14')&&source.includes('vec3(.665,.642,.589)')&&source.includes('uSandAlbedoGain:{value:.91}'),{});
const observed={nearUnfiltered:0,nearFiltered:0};let meanFbm=0,meanReef=0;
for(let j=0;j<256;j++)for(let i=0;i<256;i++){
  const f=fbm((i-128)*.791*.14+7,(j-128)*.937*.14+7,0,false);meanFbm+=f;meanReef+=smoothstep(.64,.80,f);
}
meanFbm/=65536;meanReef/=65536;
const reefMaximumChannelBias=meanReef*.36*Math.max(.41,.35,.49);
check('nonlinear reef far-mean error quantified, not hidden',reefMaximumChannelBias<.015,{sampleCount:65536,localOriginalFbmMean:meanFbm,localOriginalReefMaskMean:meanReef,estimatedWorstDeepWaterChannelBrightening:reefMaximumChannelBias,note:'Filtering before a nonlinear high threshold does not preserve the sparse-tail mean exactly. Owner explicitly accepted this ~1% material-scale limit; no artistic compensation added.'});
const result={date:new Date().toISOString(),passed:checks.every(c=>c.passed),checksPassed:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),checks,limits:['Double-precision CPU field comparison, not exact GPU hash/pixel identity','Actual shader compilation, native frame time, wet-edge and water-colour A/B remain owner GPU acceptance','Nonlinear reef tail mean has a documented ~1% far-material bias']};
fs.writeFileSync(new URL('./sand-footprint-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,checks:result.checksPassed,total:result.total,nearDifference,wetDifference,reefMaximumChannelBias,failed:checks.filter(c=>!c.passed)}));
if(!result.passed)process.exitCode=1;
