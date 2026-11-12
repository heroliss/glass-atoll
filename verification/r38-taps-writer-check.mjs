// Bounded CPU-only exactness/ownership and comparable microbenchmark evidence.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import os from 'node:os';
import {createFireworkEvent} from '../fireworks-physics.js';
import {sampleProfileBodyEmissionWindow as summary,writeProfileBodyEmissionBins as writer} from '../firework-layer-profile.js';
import {EXAMPLE_BURN_PROFILES} from '../firework-burn-profile.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),checks=[],began=performance.now();
const old=read('verification/baselines/r38-before-taps-writer/firework-layer-profile.js'),current=read('firework-layer-profile.js'),insertion=JSON.parse(read('verification/r38-taps-writer-insertion.json'));
const text=old.toString('utf8').replace(/from (['"])(\.\/[^'\"]+)\1/g,(_,q,p)=>`from '${new URL(p.slice(2),root).href}'`),oldAPI=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const saved=JSON.parse(read('verification/r36-radiant-motion-recording.json')),launch=saved.launch;
const events=[0,1,64].map(intensityScale=>createFireworkEvent({type:'chrysanthemum',time:saved.launchSource.launchTime,origin:launch.origin,azimuth:launch.azimuth,elevation:launch.elevation,seed:341070,burstOrientation:launch.burstOrientation,intensityScale,starDragModel:'bounded-descent',effectProfile:'three-heart-radiant120-v1'}));
const bodies=events.flatMap(e=>e.heads),datasetSHA=sha(JSON.stringify(bodies));let comparisons=0,values=0,rejections=0;
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
function target(Type){const a=new Type(29);a.fill(123.5);a[24]=-0;a[25]=NaN;a[26]=Infinity;a[27]=-Infinity;a[28]=7.25;return a;}
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function attempt(fn,body,options){try{return{value:fn(body,options),error:null};}catch(error){return{error:{name:error.name,message:error.message}};}}
function compare(body,fromAge,toAge,Type=Float64Array,extra={}){
 const a=target(Type),b=target(Type),suffix=Buffer.from(bytes(b).subarray(24*Type.BYTES_PER_ELEMENT)),options={fromAge,toAge,...extra};
 const x=attempt(summary,body,{...options,outRGB:a}),y=attempt(writer,body,{...options,outRGB:b});assert.deepEqual(y.error,x.error);
 assert.equal(bytes(a).compare(bytes(b)),0,'Full buffer differs, including partial writes/sentinels');
 for(let i=0;i<a.length;i++){assert(Object.is(a[i],b[i]));values++;}assert.equal(Buffer.from(bytes(b).subarray(24*Type.BYTES_PER_ELEMENT)).compare(suffix),0);
 if(y.error)rejections++;else assert.equal(y.value,b,'Writer must return exact caller-owned target');comparisons++;return{x,y,a,b};
}
check('Append-only whole-file inverse preserves every original byte and LF, with no old sampler edits',()=>{
 assert.equal(sha(old),insertion.originalSHA256);assert.equal(sha(current),insertion.candidateSHA256);assert.equal(current.subarray(0,old.length).compare(old),0);assert.equal(current.subarray(old.length).toString('utf8'),insertion.appendedSource);assert.equal(current.subarray(0,current.length-Buffer.byteLength(insertion.appendedSource)).compare(old),0);assert(!current.includes(13));
 return{originalBytes:old.length,appendedBytes:current.length-old.length,originalSHA256:sha(old),candidateSHA256:sha(current),oldPublicAPIByteExact:true};
});
check('Actual 192-root radiant instances at 0x/1x/64x: Float64 and Float32 taps at phases, head/tail lags, knots and lifetimes are Object.is exact',()=>{
 for(const event of events)for(const body of event.heads){
  const windows=[];for(const age of [.7,1.7,2.5])for(let j=-1;j<8;j++){
   const lag=j<0?0:(j+.5)/8*body.trailProfile.durationSeconds,now=event.burstTime+age;
   windows.push([(now-1/120)-body.birth-lag,now-body.birth-lag]);
  }
  for(const k of body.burnProfile.emission.knots)windows.push([k.age,k.age],[k.age-1/120,k.age],[k.age,k.age+1/120],[k.age-1/240,k.age+1/240]);
  windows.push([-1,-.5],[-0,-0],[body.life,body.life],[body.life+1,body.life+2]);
  for(const [a,b]of windows)for(const Type of [Float64Array,Float32Array])compare(body,a,b,Type);
 }
 return{events:3,gains:[0,1,64],actualBodies:bodies.length,completeComparisons:comparisons,comparedValues:values,errorsUnexpected:rejections,materialUnchanged:true};
});
check('Delays, signed zero, all legacy example profile shapes and narrow representable windows keep exact typed stores',()=>{
 const selected=[bodies[192],bodies[256],bodies[320]],before=JSON.stringify(selected);let n=0;
 for(const source of selected)for(const delay of [-.125,-0,.125,1000000000000]){
  const body={...source,ignitionDelay:delay};for(const age of [0,.04,.7,2.5,source.life])for(const S of [0,1/120,2**-38])for(const Type of[Float64Array,Float32Array]){compare(body,delay+age-S,delay+age,Type);n++;}
 }
 for(const profile of Object.values(EXAMPLE_BURN_PROFILES)){const body={burnProfile:profile,ignitionDelay:.125};for(const knot of profile.emission.knots)for(const Type of[Float64Array,Float32Array]){compare(body,knot.age+.125-1/120,knot.age+.125,Type);n++;}}
 assert.equal(JSON.stringify(selected),before);return{cases:n,narrowWindowsMayRejectIdentically:true};
});
check('Invalid finite/order/bin/output inputs and late unrepresentable bins preserve old error priority and partial output writes',()=>{
 const body=bodies[192];let n=0;
 for(const extra of [{fromAge:NaN,toAge:1},{fromAge:0,toAge:Infinity},{fromAge:2,toAge:1},{fromAge:-Number.MAX_VALUE,toAge:Number.MAX_VALUE},{fromAge:0,toAge:1,bins:1},{fromAge:0,toAge:1,bins:8.5},{fromAge:0,toAge:Number.MIN_VALUE}])for(const Type of[Float64Array,Float32Array]){compare(body,0,1,Type,extra);n++;}
 const huge=2**42,late=compare(body,huge,huge+5*2**-10);assert(late.y.error);const written=Array.from(late.b).slice(0,24).filter(v=>v!==123.5).length;assert(written>0&&written<24,'Expected old partial write before a later invalid bin');
 for(const output of [null,[],new Int32Array(29),new Float64Array(23),new Float32Array(23)]){const x=attempt(summary,body,{fromAge:0,toAge:1,outRGB:output}),y=attempt(writer,body,{fromAge:0,toAge:1,outRGB:output});assert.deepEqual(y.error,x.error);assert(y.error);n++;}
 for(const badBody of [{}, {burnProfile:{}},null]){const a=target(Float64Array),b=target(Float64Array),x=attempt(summary,badBody,{fromAge:NaN,toAge:0,outRGB:a}),y=attempt(writer,badBody,{fromAge:NaN,toAge:0,outRGB:b});assert.deepEqual(y.error,x.error);assert.equal(bytes(a).compare(bytes(b)),0);n++;}
 assert(attempt(writer,body,{fromAge:0,toAge:1}).error?.name==='TypeError');assert.equal(attempt(summary,body,{fromAge:0,toAge:1}).error,null);
 return{rejectionCases:n,lateBinWrittenEntries:written,lateBinError:late.y.error,requiredOutIsExplicitNewAPI:true};
});
check('Borrowed subarray byte offsets, suffix and neighboring storage are preserved; independent calls do not alias retained rows',()=>{
 const body=bodies[192];for(const Type of[Float64Array,Float32Array]){const storage=new Type(80);storage.fill(17.25);const target=storage.subarray(7,36),before=Buffer.from(bytes(storage));writer(body,{fromAge:.6,toAge:.7,outRGB:target});assert.equal(Buffer.from(bytes(storage).subarray(0,7*Type.BYTES_PER_ELEMENT)).compare(before.subarray(0,7*Type.BYTES_PER_ELEMENT)),0);assert.equal(Buffer.from(bytes(storage).subarray(31*Type.BYTES_PER_ELEMENT)).compare(before.subarray(31*Type.BYTES_PER_ELEMENT)),0);}
 const a=target(Float64Array),b=target(Float64Array);writer(body,{fromAge:.6,toAge:.7,outRGB:a});const first=Buffer.from(bytes(a));writer(body,{fromAge:1,toAge:1.1,outRGB:b});assert.equal(bytes(a).compare(first),0);assert.notEqual(a.buffer,b.buffer);return{outputPooling:false,independentOwnedTargets:true};
});
check('Old public window summaries including field order remain deep-exact against separately loaded archived API',()=>{
 let n=0;for(const body of bodies.filter((_,i)=>i%17===0))for(const age of [-.1,0,.7,1.7,2.5,6])for(const S of[0,1/120]){
  const a=summary(body,{fromAge:age-S,toAge:age}),b=oldAPI.sampleProfileBodyEmissionWindow(body,{fromAge:age-S,toAge:age});assert.deepEqual(a,b);assert.deepEqual(Object.keys(a),Object.keys(b));n++;
 }return{fullSummaryComparisons:n,oldAPIFieldOrderPreserved:true};
});
const timings={summary:[],tapsOnly:[]};let sink=0;
check('Comparable bounded warmed CPU microbenchmark consumes identical actual Float64 tap output, with summary return discarded in both arms',()=>{
 const jobs=[];for(const body of events[1].heads)for(const age of [.7,1.7,2.5])for(let j=-1;j<8;j++){const lag=j<0?0:(j+.5)/8*body.trailProfile.durationSeconds;const now=events[1].burstTime+age,sourceAge=now-body.birth-lag;if(sourceAge<0||sourceAge>body.life+1)continue;jobs.push({body,fromAge:(now-1/120)-body.birth-lag,toAge:now-body.birth-lag});}
 const targets={summary:new Float64Array(24),tapsOnly:new Float64Array(24)},methods={summary,tapsOnly:writer},repeats=4;
 function batch(name){let sum=0;const t=performance.now(),fn=methods[name],outRGB=targets[name];for(let n=0;n<repeats;n++)for(const p of jobs){fn(p.body,{fromAge:p.fromAge,toAge:p.toAge,outRGB});for(let k=0;k<24;k++)sum+=outRGB[k];}sink+=sum;return{ms:performance.now()-t,sum};}
 for(let warm=0;warm<2;warm++){assert.equal(batch('summary').sum,batch('tapsOnly').sum);}
 for(let cycle=0;cycle<4;cycle++)for(const name of['summary','tapsOnly','tapsOnly','summary']){assert(performance.now()-began<20000,'CPU probe exceeded bounded20s');timings[name].push(batch(name).ms);}
 function stats(a){const s=[...a].sort((a,b)=>a-b),median=(s[3]+s[4])/2;return{batches:a.length,minMs:s[0],medianMs:median,maxMs:s.at(-1),allMs:a,medianNanosecondsPerWindow:median*1e6/(jobs.length*repeats)};}
 const result=Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,stats(v)]));return{jobs:jobs.length,repeatsPerBatch:repeats,callsPerBatch:jobs.length*repeats,warmupBatchesPerArm:2,schedule:'ABBA repeated4 times',results:result,medianRatioTapsToSummary:result.tapsOnly.medianMs/result.summary.medianMs,checksum:sink,scope:'Isolated warmed Node calls with real compiled profiles and same caller-buffer allocation; not browser, source-bound subphase or frame-rate proof'};
});
assert.equal(sha(JSON.stringify(bodies)),datasetSHA,'Actual input bodies/profiles mutated');
const report={schema:'glass-atoll.r38-taps-writer-cpu-check.v1',passed:checks.every(c=>c.passed),checks:checks.filter(c=>c.passed).length,total:checks.length,actualGPU:false,browserUsed:false,productionFilesOwned:['firework-layer-profile.js'],sourceSHA256:{layer:sha(current),oldLayer:sha(old),audio:sha(read('fireworks-audio.js'))},actualDataset:{events:3,bodies:bodies.length,seed:341070,gains:[0,1,64],SHA256:datasetSHA,recordingSHA256:sha(read('verification/r36-radiant-motion-recording.json'))},totalTypedComparisons:comparisons,totalObjectIsValues:values,totalMatchedRejections:rejections,results:checks,engine:{node:process.version,V8:process.versions.v8,cpu:os.cpus()[0]?.model},wallSeconds:(performance.now()-began)/1000,limits:['No browser, GL, GPU, pixels, actual-frame speedup or promotion is established.','Public summary sampler remains full original bytes; required caller output is an explicit new-writer API distinction.','No buffers are pooled and all point/material/shutter/kernel/sample-count behavior outside this new entry is unchanged.']};
fs.writeFileSync(new URL('verification/r38-taps-writer-check.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:report.checks,total:report.total,typedComparisons:comparisons,ObjectIsValues:values,matchedRejections:rejections,wallSeconds:report.wallSeconds,microbench:checks.at(-1),failures:checks.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;
