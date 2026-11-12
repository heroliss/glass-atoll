// Read-only CPU diagnostic, not an optimization candidate or whole-frame test.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import os from 'node:os';
import {createFireworkEvent,sampleBodyEmission,sampleBody} from '../fireworks-physics.js';
import {sampleBurnProfile,sampleMaterialCDF} from '../firework-burn-profile.js';
const root=new URL('../',import.meta.url),read=name=>fs.readFileSync(new URL(name,root),'utf8'),sha=value=>crypto.createHash('sha256').update(value).digest('hex'),began=performance.now();
const files=['firework-burn-profile.js','firework-layer-profile.js','fireworks-physics.js','fireworks.js','fireworks-audio.js'];
const before=Object.fromEntries(files.map(p=>[p,sha(read(p))]));
const recording=JSON.parse(read('verification/r36-radiant-motion-recording.json')),launch=recording.launch;
const event=createFireworkEvent({type:'chrysanthemum',time:recording.launchSource.launchTime,origin:launch.origin,azimuth:launch.azimuth,elevation:launch.elevation,seed:341070,burstOrientation:launch.burstOrientation,intensityScale:1,starDragModel:'bounded-descent',effectProfile:'three-heart-radiant120-v1'});
assert.equal(event.heads.length,192);assert.equal(event.layerProfile.referencePeakBudget,launch.layerProfile.referencePeakBudget);
const dataset=[],phaseCounts=[];
for(const age of [.7,1.7,2.5]){
  const phase={ageSeconds:age,physicsParticleSamples:0,FWHeadSamples:0,FWTailSamples:0,materialInteriorSamples:0,materialEndpointFastPaths:0};
  function push(body,sourceAge,caller){
    const adjusted=sourceAge-(body.ignitionDelay??0),k=body.burnProfile.material.knots,interior=adjusted>k[0].age&&adjusted<k.at(-1).age;
    dataset.push({body,profile:body.burnProfile,age:adjusted,caller});phase[caller]++;phase[interior?'materialInteriorSamples':'materialEndpointFastPaths']++;
  }
  for(const body of event.heads){
    if(age>=0&&age<=body.life&&sampleBody(body,event.burstTime+age).position[1]>=.03)push(body,age,'physicsParticleSamples');
    if(age<=body.life+1)push(body,age,'FWHeadSamples');
    for(let j=0;j<8;j++){const sourceAge=age-(j+.5)/8*body.trailProfile.durationSeconds;if(sourceAge>=0&&sourceAge<=body.life+1)push(body,sourceAge,'FWTailSamples');}
  }
  phase.totalSamples=phase.physicsParticleSamples+phase.FWHeadSamples+phase.FWTailSamples;phaseCounts.push(phase);
}
// Actual immutable production instances, no rebuilt stand-in curves.
const instanceJSON=JSON.stringify(event.heads.map(b=>({id:b.id,life:b.life,delay:b.ignitionDelay,profile:b.burnProfile}))),instanceSHA=sha(instanceJSON);
for(const x of dataset){const a=sampleBurnProfile(x.profile,x.age),b=sampleBodyEmission(x.body,x.age+(x.body.ignitionDelay??0));assert.equal(a.materialCDF,sampleMaterialCDF(x.profile,x.age));assert.deepEqual(a.emissionRGBReference,b.emissionRGBReference);assert.equal(a.intensityCdReference,b.intensityCdReference);}
const methods={
  fullBurnProfile:x=>{const r=sampleBurnProfile(x.profile,x.age);return r.intensityCdReference+r.emissionRGBReference[0]+r.unitYColour[2]+r.materialCDF;},
  materialCDFOnly:x=>sampleMaterialCDF(x.profile,x.age),
  fullBodyWrapper:x=>{const r=sampleBodyEmission(x.body,x.age+(x.body.ignitionDelay??0));return r.intensityCdReference+r.emissionRGBReference[0]+r.unitYColour[2]+r.materialCDF+r.envelope;}
};
let sink=0;const timings=Object.fromEntries(Object.keys(methods).map(k=>[k,[]]));
const repeats=4,rounds=8;
function batch(fn){let value=0;const t=performance.now();for(let n=0;n<repeats;n++)for(const row of dataset)value+=fn(row);sink+=value;return performance.now()-t;}
for(let warm=0;warm<3;warm++)for(const fn of Object.values(methods))batch(fn);
for(let round=0;round<rounds;round++){
  assert(performance.now()-began<10000,'Bounded CPU diagnostic exceeded 10 seconds before next batch');
  const names=Object.keys(methods);if(round%2)names.reverse();for(const name of names)timings[name].push(batch(methods[name]));
}
function stats(a){const s=[...a].sort((a,b)=>a-b);return{batches:s.length,minMs:s[0],medianMs:(s[3]+s[4])/2,maxMs:s.at(-1),allMs:a,medianNanosecondsPerCall:(s[3]+s[4])/2*1e6/(dataset.length*repeats)};}
assert(Number.isFinite(sink));assert.equal(sha(JSON.stringify(event.heads.map(b=>({id:b.id,life:b.life,delay:b.ignitionDelay,profile:b.burnProfile})))),instanceSHA);
for(const p of files)assert.equal(sha(read(p)),before[p]);
const report={schema:'glass-atoll.r37-emission-cdf-readonly-cpu-probe.v1',passed:true,actualGPU:false,browserUsed:false,productionChanged:false,candidateImplemented:false,engine:{node:process.version,V8:process.versions.v8,cpu:os.cpus()[0]?.model},sourceSHA256:before,dataset:{origin:'Actual current createFireworkEvent production factory using saved successful R36 seed/angle/origin/orientation/G16 reference profile; Node CPU, not browser replay identity',recordingSHA256:sha(read('verification/r36-radiant-motion-recording.json')),seed:341070,effectProfile:event.effectProfile,bodies:192,tailSamples:8,phaseCounts,totalRows:dataset.length,instanceSHA256:instanceSHA,materialKnots:[...new Set(event.heads.map(b=>b.burnProfile.material.knots.length))],emissionKnots:[...new Set(event.heads.map(b=>b.burnProfile.emission.knots.length))],phaseScope:'Source-derived point-sample workload before contact filtering; physics sea check uses native still-air motion. No actual runtime instrumentation or per-view/adaptive shutter call count is claimed.'},measurement:{warmupBatchesPerMethod:3,measuredBatchesPerMethod:rounds,callsPerBatch:dataset.length*repeats,repeatsPerBatch:repeats,alternatingMethodOrder:true,checksum:sink,results:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,stats(v)]))},findings:{fullSampleAlwaysRequestsMaterialCDF:true,FWAndPhysicsPointConsumersDoNotReadCDF:true,positiveShutterBinsAlreadyRGBOnly:true,profileValidationWeakSetAlreadyExists:true,materialCDFNoValueCache:true,oldAPIChangesApproved:false},limits:['Isolated warmed Node CPU timings are diagnostic; materialCDF-only time is not a proved whole-frame speedup or a valid subtractive performance bound.','The observable checksum consumes CDF; optimizing JITs may eliminate unused work differently in real application call sites. Only a future real caller A/B can prove benefit.','No transformed emission-only function, production edit, shader change, browser, GPU, media recording or full-frame benchmark is performed.','Point workload reconstruction does not duplicate the already RGB-only positive shutter-bin integration; adaptive spatial/optical work is outside this probe.'],wallSeconds:(performance.now()-began)/1000};
fs.writeFileSync(new URL('verification/r37-emission-cdf-cost-probe.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,rows:dataset.length,phaseCounts,timingNanoseconds:Object.fromEntries(Object.entries(report.measurement.results).map(([k,v])=>[k,v.medianNanosecondsPerCall])),wallSeconds:report.wallSeconds},null,2));
