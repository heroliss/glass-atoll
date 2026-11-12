// Pure CPU author study, not a runtime patch, engine model or GPU acceptance.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {createFireworkEvent,FIREWORK_TYPES,starEnvelope,sampleFireworkEvent,sampleBody} from '../../fireworks-physics.js';
import {ASCENT_ENVELOPE_PROFILES,ascentEnvelopeClock,ascentEffectEnvelope,bodyEmissionPrototype,shutterEmissionPrototype} from './ascent-envelope-prototype.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),read=name=>readFileSync(new URL('../../'+name,import.meta.url));
const files=['fireworks-physics.js','fireworks.js','fireworks-audio.js','pyro-smoke-trajectory-events.js','pyro-smoke-ring-burn.js'];
const seals=Object.fromEntries(files.map(f=>[f,sha(read(f))])),checks=[],profiles=Object.keys(ASCENT_ENVELOPE_PROFILES),study=[];
const near=(a,b,tol=1e-10)=>assert(Math.abs(a-b)<=tol,`${a} vs ${b}`);
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}
function simpson(fn,from,to,panels=20000){const h=(to-from)/panels;let sum=fn(from)+fn(to);for(let i=1;i<panels;i++)sum+=(i%2?4:2)*fn(from+i*h);return sum*h/3;}
function legacy(body,age){return age>=0&&age<body.life?1:0;}
function recordIntensity(body,age,profile){
  const E=t=>profile==='legacy'?legacy(body,t):ascentEffectEnvelope(body,t,profile),duration=.5,segments=10;
  let normal=0,tail=0;for(let j=0;j<segments;j++)normal+=Math.exp(-(j+.5)/segments*3.5);
  for(let j=0;j<segments;j++){const lag=(j+.5)/segments*duration;tail+=Math.exp(-(j+.5)/segments*3.5)/normal*E(age-lag);}
  return{head:body.intensity*.66*E(age),tail:body.intensity*.34*tail,total:body.intensity*(.66*E(age)+.34*tail)};
}
const events=FIREWORK_TYPES.flatMap(d=>[42,14271].map(seed=>createFireworkEvent({type:d.id,seed,origin:[29,1.5,7],elevation:80,time:17})));
check('ten real types two seeds use unchanged events; ground types have no carrier',()=>{
  assert.equal(events.length,20);assert.equal(events.filter(e=>e.rocket).length,16);assert(events.filter(e=>e.definition.ground).every(e=>!e.rocket));return{events:20,aerial:16,ground:4};
});
check('finite input profile and shutter guard rejection',()=>{
  for(const life of [-1,NaN,Infinity,undefined])assert.throws(()=>ascentEnvelopeClock(life),RangeError);
  assert.throws(()=>ascentEnvelopeClock(3,'unknown'),RangeError);assert.throws(()=>ascentEffectEnvelope({life:3},NaN),RangeError);assert.throws(()=>shutterEmissionPrototype({kind:'rocket',life:3},0,-1),RangeError);return{rejectedCases:7};
});
check('both profiles bounded nonnegative with separate plateau fade and exact dark support',()=>{
  let samples=0;for(const profile of profiles)for(const life of [0,.01,3,4.6583789583,5.33112119266,5.77502427369,10]){
    const b={kind:'rocket',life},c=ascentEnvelopeClock(life,profile);assert(c.attackEnd<=c.fadeStart);
    for(let i=-2;i<=10002;i++){const age=life*i/10000,v=ascentEffectEnvelope(b,age,profile);assert(Number.isFinite(v)&&v>=0&&v<=1);samples++;if(age>=c.burnout||age<=0)assert.equal(v,0);}
    if(life>0)assert.equal(ascentEffectEnvelope(b,(c.attackEnd+c.fadeStart)/2,profile),1);
  }return{samples};
});
check('attack fade and support joins are smooth with zero limiting slope',()=>{
  const b={kind:'rocket',life:4.6583789583};let maximumOneSidedSlope=0;
  for(const p of profiles){const c=ascentEnvelopeClock(b.life,p),f=t=>ascentEffectEnvelope(b,t,p);for(const t of [0,c.attackEnd,c.fadeStart,c.burnout]){
    const h=1e-6,left=(f(t)-f(t-h))/h,right=(f(t+h)-f(t))/h;maximumOneSidedSlope=Math.max(maximumOneSidedSlope,Math.abs(left),Math.abs(right));assert(Math.abs(left)<1e-6&&Math.abs(right)<1e-6);
  }}return{maximumOneSidedSlope,analytic:'quintic smoothstep has zero first and second endpoint derivatives; nonoverlapping factors'};
});
check('independent Simpson area matches analytic attack plateau fade integral without renormalization',()=>{
  let error=0;for(const e of events.filter(e=>e.rocket))for(const profile of profiles){const b=e.rocket,c=ascentEnvelopeClock(b.life,profile),numeric=simpson(t=>ascentEffectEnvelope(b,t,profile),0,b.life);error=Math.max(error,Math.abs(numeric-c.analyticEmissionSeconds));near(numeric,c.analyticEmissionSeconds,2e-9);assert(numeric<b.life);}
  return{maximumAbsoluteEmissionSecondsError:error,peakMultiplierStaysAtMostOne:true};
});
check('real physical sampler currently reports one before burst and prototype does not mutate event',()=>{
  for(const e of events.filter(e=>e.rocket)){for(const ratio of [.01,.25,.7,.99]){
    const age=e.rocket.life*ratio,particle=sampleFireworkEvent(e,e.time+age,{smoke:false}).find(p=>p.kind==='rocket');assert(particle);assert.equal(particle.emission,1);
    // The real sampler legitimately calls resolveBurst, updating birth poses
    // even in zero wind. Isolate the prototype's mutation boundary after that.
    const before=JSON.stringify(e),p=sampleBody(e.rocket,e.time+age);for(const profile of profiles)bodyEmissionPrototype(e.rocket,age,profile);assert.deepEqual(sampleBody(e.rocket,e.time+age),p);assert.equal(JSON.stringify(e),before);
  }}return{baselineCarrierConstantConfirmed:true,eventAndTrajectoryUnchangedByPrototype:true,baselineResolveBurstIsOutsideMutationAssertion:true};
});
check('all existing star strobe and split body envelopes delegate exactly unchanged',()=>{
  let count=0;for(const e of events)for(const b of e.heads)for(const x of [-.01,0,.01,.25,.7,.99,1,1.01]){
    const age=b.life*x;for(const profile of profiles){assert.equal(bodyEmissionPrototype(b,age,profile),starEnvelope(b,age));count++;}
  }return{comparisons:count,noAuthorSourceRNGOrColourChange:true};
});
check('shutter uses the same central clock for main and zero-shutter reflection',()=>{
  let windows=0,maximumInstantaneousVsMainMean=0;const b=events.find(e=>e.type==='ring').rocket;
  for(const profile of profiles){const c=ascentEnvelopeClock(b.life,profile);for(const centre of [0,.02,c.attackEnd,c.fadeStart,c.burnout-.001,c.burnout,c.burnout+.001,b.life]){
    const w=shutterEmissionPrototype(b,centre,1/120,profile),reflected=shutterEmissionPrototype(b,centre,0,profile),instant=ascentEffectEnvelope(b,centre,profile);assert(w.every(v=>v>=0&&v<=1));assert(reflected.every(v=>v===instant));
    for(let k=0;k<8;k++)assert.equal(w[k],ascentEffectEnvelope(b,centre+((k+.5)/8-.5)/120,profile));maximumInstantaneousVsMainMean=Math.max(maximumInstantaneousVsMainMean,Math.abs(w.reduce((s,v)=>s+v,0)/8-instant));windows++;
  }}return{windows,maximumInstantaneousVsMainMean,meaning:'camera temporal average is intentionally distinct from instantaneous physical clusters/ledger'};
});
check('unchanged unmodulated source peak remains conservative; instantaneousE is not a shutter bound',()=>{
  const b=events.find(e=>e.type==='ring').rocket,c=ascentEnvelopeClock(b.life),age=.002,w=shutterEmissionPrototype(b,age),instant=ascentEffectEnvelope(b,age);
  assert(w.some(v=>v>instant));assert(w.every(v=>v<=1));for(const p of profiles)for(let i=0;i<=1000;i++){
    const x=recordIntensity(b,(b.life+.5)*i/1000,p);assert(x.total>=0&&x.total<=b.intensity+1e-12);
  }return{instantaneousE:instant,maximumShutterWeight:Math.max(...w),oldPeakOneStillSafe:true,doNotTightenWithCurrentSampleOnly:true};
});
check('tail uses emission at past birth and naturally outlives head without relighting coast',()=>{
  const b=events.find(e=>e.type==='ring').rocket,p='early-burnout-preview-v1',c=ascentEnvelopeClock(b.life,p),atEnd=recordIntensity(b,c.burnout,p),late=recordIntensity(b,c.burnout+.5,p);
  assert.equal(atEnd.head,0);assert(atEnd.tail>0);assert.equal(late.total,0);return{headAtBurnout:0,tailAtBurnout:atEnd.tail,tailAtBurnoutPlusHalfSecond:0};
});
check('frame rate samples converge to the same explicit physical-time envelope with no state',()=>{
  const result=[];for(const fps of [30,60,120]){let maxAreaError=0;for(const e of events.filter(e=>e.rocket))for(const p of profiles){
    const b=e.rocket,c=ascentEnvelopeClock(b.life,p),steps=Math.ceil(b.life*fps),h=b.life/steps;let area=0;for(let i=0;i<steps;i++)area+=ascentEffectEnvelope(b,(i+.5)*h,p)*h;
    maxAreaError=Math.max(maxAreaError,Math.abs(area-c.analyticEmissionSeconds));
    for(const t of [.02,.1,1,2,3])assert.equal(ascentEffectEnvelope(b,t,p),bodyEmissionPrototype(b,t,p));
  }assert(maxAreaError<.0005);result.push({fps,maximumEmissionSecondsQuadratureError:maxAreaError});}return result;
});
check('no speed wind or thrust is inferred from decorative brightness',()=>{
  const b=events.find(e=>e.type==='ring').rocket,age=1;
  for(const profile of profiles)for(const velocity of [[0,0,0],[0,1000,0],[0,-1000,0]])assert.equal(ascentEffectEnvelope({...b,velocity},age,profile),ascentEffectEnvelope(b,age,profile));
  return{envelopeReadsLifeAndAgeOnly:true,flightDragAndGravityUntouched:true};
});
for(const e of events){if(!e.rocket){study.push({type:e.type,seed:e.seed,carrier:false,scope:'ground stars unchanged; no fictitious engine envelope'});continue;}
  const b=e.rocket;study.push({type:e.type,seed:e.seed,carrier:true,flightSeconds:b.life,burstWorldY:e.burstPosition[1],burstVelocity:sampleBody(b,e.burstTime).velocity,
    referenceCandela:b.intensity,profiles:profiles.map(profile=>{const c=ascentEnvelopeClock(b.life,profile);return{...c,integralVsLegacy:c.analyticEmissionSeconds/b.life,
      samples:[0,.03,.06,.12,1,2,3,c.fadeStart,(c.fadeStart+c.burnout)*.5,c.burnout,b.life-.001,b.life,b.life+.5].map(age=>({age,E:ascentEffectEnvelope(b,age,profile),verticalVelocity:sampleBody(b,e.time+Math.max(0,age)).velocity[1],records:recordIntensity(b,age,profile)}))};})});
}
check('production physics FW audio and smoke sources remain byteexact',()=>{for(const file of files)assert.equal(sha(read(file)),seals[file],file);return seals;});
const report={schema:'glass-atoll.ascent-envelope-author-CPU-study.v1',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,study,
  productionIntegrated:false,actualGPU:false,sourceSHA256:seals,prototypeSHA256:sha(readFileSync(new URL('./ascent-envelope-prototype.mjs',import.meta.url))),scriptSHA256:sha(readFileSync(new URL(import.meta.url))),
  limits:['Author decorative light envelope only; not measured fuel/thrust/photometry, no CFD or smoke material allocation.','Through-burst profile is category-compatible with a published Japanese attached-effect example; numerical attack/fade durations are not specified by that source.','Earlycoast preview is an independent author choice, not universal aerial-shell physics.','This compares actual current CPU baseline to an unintegrated prototype; all head/tail/shutter/ledger/cluster/bound GPU acceptance is still required if root authorizes integration.']};
writeFileSync(new URL('./ascent-envelope-study.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),aerialExamples:study.filter(x=>x.carrier).slice(0,1).map(e=>({type:e.type,flightSeconds:e.flightSeconds,profiles:e.profiles.map(p=>({name:p.profile,burnout:p.burnout,coast:p.coastSeconds,integralVsLegacy:p.integralVsLegacy}))}))},null,2));if(!report.passed)process.exitCode=1;
