import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createBurnProfile,EXAMPLE_BURN_PROFILES} from '../firework-burn-profile.js';
import {sampleProfileBodyEmissionWindow as current} from '../firework-layer-profile.js';

// Compare the complete public return object and caller-buffer mutation to the
// independently frozen production implementation, without copying its maths.
const root=new URL('../',import.meta.url),baselineURL=new URL('./baselines/r19-before-overlap-hoist/firework-layer-profile.js',import.meta.url),baselineSource=fs.readFileSync(baselineURL,'utf8');
const resolved=baselineSource.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,path)=>`from '${new URL(path,root).href}'`);
const {sampleProfileBodyEmissionWindow:baseline}=await import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const checks=[];
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}}
let seed=0x62a13d07;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const profiles=[...Object.values(EXAMPLE_BURN_PROFILES)];
for(let p=0;p<18;p++){
  const count=[3,4,9,17,31,64,127,256][p%8],knots=[];let age=0;
  for(let i=0;i<count;i++){
    if(i)age+=.00001+random()*(p%3===0?15:.7);
    knots.push({age,rgb:i===0||i===count-1?[0,0,0]:[0,1,2].map(c=>p%5===0&&c===1?0:10**(-12+random()*20))});
  }
  profiles.push(createBurnProfile({id:'independent-overlap-'+p,emissionKnots:knots,materialRateKnots:[{age:0,rate:0},{age:age*.5,rate:1},{age,rate:0}]}));
}
function outcome(fn,body,options){try{return{value:fn(body,options),error:null};}catch(e){return{error:[e.constructor.name,e.message]};}}
let exactWindows=0,channelEntries=0;
function compare(body,fromAge,toAge,bufferType){
  const a=bufferType?new bufferType(29).fill(123.875):undefined,b=bufferType?new bufferType(29).fill(123.875):undefined;
  const A=outcome(current,body,{fromAge,toAge,...(a?{outRGB:a}:{})}),B=outcome(baseline,body,{fromAge,toAge,...(b?{outRGB:b}:{})});
  assert.deepStrictEqual(A,B);if(a){assert.deepStrictEqual(a,b);assert.ok(Array.from(a.slice(24)).every(v=>v===123.875));}
  if(!A.error){exactWindows++;channelEntries+=24;}
  return !A.error;
}
check('Frozen baseline hash and current production imports are distinct and pinned',()=>{
  const production=fs.readFileSync(new URL('../firework-layer-profile.js',import.meta.url));assert.notEqual(sha(production),sha(baselineSource));
  return{baselineSHA256:sha(baselineSource),currentSHA256:sha(production),baselinePath:baselineURL.pathname};
});
check('Exact full-window result parity at all knots, boundaries, zero widths and overlapping exposure intervals',()=>{
  let cases=0;
  for(const burnProfile of profiles)for(const ignitionDelay of [0,.013,-.007]){
    const body={burnProfile,ignitionDelay},end=burnProfile.emission.endAge;
    const ages=[-1,0,end*.5,end,end+1,...burnProfile.emission.knots.map(k=>k.age)];
    for(const point of ages)for(const width of [0,1/120,.1,1,3.2]){
      compare(body,point+ignitionDelay-width,point+ignitionDelay,[undefined,Float64Array,Float32Array][cases++%3]);
    }
  }
  return{cases,profileCount:profiles.length,comparison:'deepStrictEqual on full return object and trailing caller-buffer sentinel; no tolerance'};
});
check('Seeded broad/narrow positive-width window and Float64/Float32 output parity',()=>{
  let cases=0;
  for(const burnProfile of profiles){
    const body={burnProfile,ignitionDelay:random()*.1};
    for(let i=0;i<120;i++){
      const lo=-2+random()*(burnProfile.emission.endAge+4),width=[Number.EPSILON,1e-10,.008333333333333333,.23,random()*8][i%5];
      compare(body,lo,lo+width,[undefined,Float64Array,Float32Array][i%3]);cases++;
    }
  }
  return{cases,seed:'0x62a13d07',comparison:'exact binary64 objects and typed-buffer values; matching nonrepresentable-bin errors retained'};
});
check('Invalid inputs retain exact error type/message and caller buffer mutation parity',()=>{
  const body={burnProfile:profiles[0]},bad=[{fromAge:1,toAge:0},{fromAge:NaN,toAge:1},{fromAge:0,toAge:Infinity},{fromAge:-1e308,toAge:1e308},{fromAge:0,toAge:1,bins:7},{fromAge:0,toAge:1,outRGB:[]},{fromAge:0,toAge:1,outRGB:new Float64Array(23)},{fromAge:1,toAge:1+Number.EPSILON},{fromAge:1e20,toAge:1e20+16384}];
  for(const options of bad){const before=options.outRGB?.slice(),A=outcome(current,body,options),B=outcome(baseline,body,options);assert.deepStrictEqual(A,B);if(before)assert.deepStrictEqual(options.outRGB,before);}
  assert.deepStrictEqual(outcome(current,{},{}),outcome(baseline,{},{}));
  return{cases:bad.length+1};
});
const report={schema:'glass-atoll.r19-overlap-hoist-independent.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},exactWindows,channelEntries,sourceSHA256:sha(fs.readFileSync(new URL('../firework-layer-profile.js',import.meta.url))),baselineSHA256:sha(baselineSource),checks,limits:['Direct independent frozen implementation parity, not a timing benchmark or GPU/image test.','Public output parity for the listed finite profiles/windows; does not prove every possible IEEE754 input.']};
fs.writeFileSync(new URL('./r19-overlap-hoist-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
