// Detached CPU candidate only. This file does not alter production modules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createFireworkEvent} from '../fireworks-physics.js';
import {sampleProfileBodyEmissionWindow} from '../firework-layer-profile.js';
import {sampleBurnProfile} from '../firework-burn-profile.js';
const verified=new WeakSet(),finite=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new RangeError(name+' must be finite');return x;};
function sharedOverlapWindow(body,{fromAge,toAge,bins=8,outRGB}={}){
  if(!body.burnProfile)throw new RangeError('Vector profile window is opt-in only');finite(fromAge,'Window start');finite(toAge,'Window end');
  if(!verified.has(body.burnProfile)){sampleBurnProfile(body.burnProfile,0);verified.add(body.burnProfile);}
  if(toAge<fromAge||!Number.isFinite(toAge-fromAge)||bins!==8)throw new RangeError('Profile window requires ordered finite ages and8 bins');
  if(outRGB!==undefined&&(!(outRGB instanceof Float64Array||outRGB instanceof Float32Array)||outRGB.length<24))throw new TypeError('outRGB requires24 Float64/Float32 entries');
  const rgbTaps=outRGB??new Float64Array(24),delay=body.ignitionDelay??0,start=fromAge-delay,end=toAge-delay,width=end-start,knots=body.burnProfile.emission.knots;
  if(width===0)return sampleProfileBodyEmissionWindow(body,{fromAge,toAge,bins,outRGB});
  let totalR=0,totalG=0,totalB=0;
  for(let bin=0;bin<8;bin++){
    const lo=start+width*bin/8,hi=bin===7?end:start+width*(bin+1)/8;if(!(hi>lo))throw new RangeError('Positive profile bins are not representable at this age');
    let r=0,g=0,bv=0,cr=0,cg=0,cb=0;
    for(let k=0;k<knots.length-1;k++){
      const a=knots[k],b=knots[k+1],left=Math.max(lo,a.age),right=Math.min(hi,b.age);if(!(right>left))continue;
      const u=(left-a.age)/(b.age-a.age),v=(right-a.age)/(b.age-a.age),span=right-left;
      let va=a.rgb[0]+(b.rgb[0]-a.rgb[0])*u,vb=a.rgb[0]+(b.rgb[0]-a.rgb[0])*v,x=(va+vb)*.5*span-cr,next=r+x;cr=(next-r)-x;r=next;
      va=a.rgb[1]+(b.rgb[1]-a.rgb[1])*u;vb=a.rgb[1]+(b.rgb[1]-a.rgb[1])*v;x=(va+vb)*.5*span-cg;next=g+x;cg=(next-g)-x;g=next;
      va=a.rgb[2]+(b.rgb[2]-a.rgb[2])*u;vb=a.rgb[2]+(b.rgb[2]-a.rgb[2])*v;x=(va+vb)*.5*span-cb;next=bv+x;cb=(next-bv)-x;bv=next;
    }
    rgbTaps[bin*3]=r/(width/8);rgbTaps[bin*3+1]=g/(width/8);rgbTaps[bin*3+2]=bv/(width/8);totalR+=r/width;totalG+=g/width;totalB+=bv/width;
  }
  const averageRGBReference=[totalR,totalG,totalB];return{fromAge,toAge,bins:8,rgbTaps,averageRGBReference,integralRGBReferenceSeconds:averageRGBReference.map(v=>v*width),allPhaseMaximumRGB:body.burnProfile.emission.sourceMaximumRGB,
    bufferLifetime:outRGB?'Borrowed caller buffer, first24 entries overwritten; consume before caller reuses it':'Owned new24-entry Float64 buffer',scope:'Source vector time-bin averages only; no geometry kernel, head/tail allocation, P/C or transmission integration'};
}
const events=['three-heart-v1','two-colour-v1'].map((effectProfile,i)=>createFireworkEvent({type:'chrysanthemum',effectProfile,seed:42+i,starDragModel:'bounded-descent'})),windows=[];
for(const e of events)for(const body of e.heads)for(const S of [0,1/120,.1,.5,1])for(const phase of [-.02,0,.03,.4,.65,.95,1,1.02]){
  const age=body.life*phase;windows.push({body,options:{fromAge:age-S,toAge:age}});
}
let compared=0;
for(const {body,options} of windows){assert.deepEqual(sharedOverlapWindow(body,options),sampleProfileBodyEmissionWindow(body,options));compared++;}
const invalid=[{fromAge:NaN,toAge:1},{fromAge:2,toAge:1},{fromAge:0,toAge:Infinity},{fromAge:0,toAge:1,bins:2},{fromAge:0,toAge:1,outRGB:new Float64Array(23)},{fromAge:1e20,toAge:1e20+16384}];
for(const options of invalid){let a,b;try{sampleProfileBodyEmissionWindow(events[0].heads[0],options);}catch(e){a=[e.constructor.name,e.message];}try{sharedOverlapWindow(events[0].heads[0],options);}catch(e){b=[e.constructor.name,e.message];}assert.deepEqual(b,a);}
const buf=new Float64Array(24),benchWindows=windows.filter(w=>w.options.fromAge!==w.options.toAge),timings=[];let checksum=0;
function batch(fn){const start=performance.now();for(const {body,options} of benchWindows){const a=fn(body,{...options,outRGB:buf});checksum+=a.rgbTaps[9];}return performance.now()-start;}
for(let round=0;round<5;round++){
  const order=round%2?['candidate','baseline']:['baseline','candidate'],result={round};
  for(const k of order)result[k]=batch(k==='candidate'?sharedOverlapWindow:sampleProfileBodyEmissionWindow);
  timings.push(result);
}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)],source=fs.readFileSync(new URL('../firework-layer-profile.js',import.meta.url));
const report={schema:'glass-atoll.r19-optical-overlap-candidate-cpu.v1',dateUTC:new Date().toISOString(),passed:true,comparedWindows:compared,exactComparison:'assert.deepEqual full return shape and all Float64 values',invalidCases:invalid.length,benchWindowCount:benchWindows.length,timingsMs:timings,medianBaselineMs:median(timings.slice(1).map(x=>x.baseline)),medianCandidateMs:median(timings.slice(1).map(x=>x.candidate)),checksum,productionLayerSHA256:crypto.createHash('sha256').update(source).digest('hex'),limits:['Detached CPU candidate only; production has not been changed.','No browser/GPU/native evolving FPS speedup claim.','Finite profile cases and invalid examples do not constitute exhaustive public API validation.']};
fs.writeFileSync(new URL('./r19-optical-sampling-microbench.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
