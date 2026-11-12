import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as current from '../fireworks-physics.js';
import * as legacy from './baselines/r17-physics-before-layers/fireworks-physics.js';
import {FIREWORK_LAYER_PROFILE_LIMITS,compileFireworkLayerProfile} from '../firework-layer-profile.js';
import {integrateBurnEmission,sampleMaterialCDF} from '../firework-burn-profile.js';
const checks=[],started=new Date().toISOString(),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
const Y=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,close=(a,b,t=2e-12)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),vec=(a,b,t)=>a.forEach((v,i)=>close(v,b[i],t));
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(e){checks.push({name,passed:false,error:e.stack});}}
check('All10 legacy types, seeds, drag models and public samples remain exactly equal to frozen baseline',()=>{
  let events=0,samples=0;for(const type of legacy.FIREWORK_TYPES)for(const seed of [0,42,4294967295])for(const starDragModel of ['legacy','bounded-descent']){
    const options={type:type.id,seed,starDragModel,origin:[29,.87,7],azimuth:109,elevation:78,burstOrientation:{yawDegrees:17,tiltDegrees:8,rollDegrees:-6}},a=current.createFireworkEvent(options),b=legacy.createFireworkEvent(options);assert.deepEqual(a,b);assert.deepEqual(current.createFireworkEvent({...options,effectProfile:'legacy'}),b);
    const windTimeline=[{time:-Infinity,wind:[0,0,0]},{time:1,wind:[2,0,.7]},{time:5,wind:[3,0,1]}];for(const time of [a.burstTime-.1,a.burstTime+.1,a.burstTime+1.3]){assert.deepEqual(current.sampleFireworkEvent(a,time,{windTimeline}),legacy.sampleFireworkEvent(b,time,{windTimeline}));samples++;}events++;
  }return{events,samples};
});
check('Legacy simulation default/settings, jitter, random automatic sequence and event draining are unchanged',()=>{
  const a=current.createFireworksSimulation({seed:781}),b=legacy.createFireworksSimulation({seed:781});assert.deepEqual(a.state,b.state);for(const s of [a,b])s.configure({autoLaunch:true,intervalSeconds:2});
  for(const time of [0,.2,1,2.1,5.2,11,20]){a.update({time,windVector:[.7,0,.2]});b.update({time,windVector:[.7,0,.2]});assert.deepEqual(a.state,b.state);assert.deepEqual(a.active,b.active);assert.deepEqual(a.drainEvents(),b.drainEvents());}
});
check('Smoke-only sampling exactly equals frozen full sample filtered to smoke across10types/wind/birth boundaries',()=>{
  let comparisons=0;for(const definition of legacy.FIREWORK_TYPES){
    const options={type:definition.id,seed:42,starDragModel:'bounded-descent'},a=current.createFireworkEvent(options),b=legacy.createFireworkEvent(options),windTimeline=[{time:-Infinity,wind:[0,0,0]},{time:.4,wind:[1.7,0,.5]},{time:2.2,wind:[3,0,1]}];
    for(const dt of [-.1,0,.075-1e-9,.075,.075+1e-9,1.275,8.5,8.50000001]){const time=a.burstTime+dt,actual=current.sampleFireworkEvent(a,time,{windTimeline,stars:false}),expected=legacy.sampleFireworkEvent(b,time,{windTimeline}).filter(p=>p.kind==='smoke');assert.deepEqual(actual,expected);assert.deepEqual(a.heads,b.heads);comparisons++;}
  }
  const a=current.createFireworksSimulation({seed:7}),b=legacy.createFireworksSimulation({seed:7});for(const s of [a,b])s.launch({type:'chrysanthemum',seed:8});for(const time of [1,7,8,10]){a.update({time,windVector:[2,0,1]});b.update({time,windVector:[2,0,1]});assert.deepEqual(a.particles({stars:false}),b.particles().filter(p=>p.kind==='smoke'));comparisons++;}
  return{comparisons,optimization:'Skips carrier/head sampleBody/emission/allocation before consumer discards them; resolveBurst and legacy smoke RNG/state remain identical'};
});
check('Layered candidates keep192 real roots, stable layer counts, I0s, carrier and audio triggers',()=>{
  const details=[];for(const effectProfile of ['three-heart-v1','two-colour-v1'])for(const seed of [0,42,901]){
    const options={type:'chrysanthemum',seed,starDragModel:'bounded-descent'},a=current.createFireworkEvent({...options,effectProfile}),b=legacy.createFireworkEvent(options);assert.equal(a.heads.length,192);assert.equal(a.effectProfile,effectProfile);assert.deepEqual(a.rocket,b.rocket);assert.deepEqual(a.events,b.events);assert.equal(a.burstTime,b.burstTime);
    assert.deepEqual(a.heads.map(v=>v.id),b.heads.map(v=>v.id));assert.deepEqual(a.heads.map(v=>v.intensity),b.heads.map(v=>v.intensity));close(a.layerProfile.referencePeakBudget,b.heads.reduce((s,v)=>s+v.intensity,0));assert.deepEqual(a.layerProfile.layerCounts,effectProfile==='three-heart-v1'?{outer:64,middle:64,inner:64}:{single:192});
    for(const body of a.heads){assert.equal(body.birth,a.burstTime);assert.equal(body.ignitionDelay,0);assert.equal(Object.isFrozen(body.burnProfile),true);assert.ok(body.life<=FIREWORK_LAYER_PROFILE_LIMITS[effectProfile].maximumBodySeconds+1e-12);assert.ok(a.endTime>=body.birth+body.life+.95);assert.equal(body.burnProfile.metadata.normalization.nativeReferenceI0,body.intensity);}
    details.push({effectProfile,seed,maxLife:a.layerProfile.maximumLife,sumI0:a.layerProfile.referencePeakBudget});
  }return details;
});
check('Relative velocities scale1/.7/.4 and baseVelocity stays consistent through wind-resolved bursts',()=>{
  const options={type:'chrysanthemum',seed:42,starDragModel:'bounded-descent',burstOrientation:{yawDegrees:117,tiltDegrees:19,rollDegrees:-8}},a=current.createFireworkEvent({...options,effectProfile:'three-heart-v1'}),b=legacy.createFireworkEvent(options);
  const windTimeline=[{time:-Infinity,wind:[0,0,0]},{time:1,wind:[3.2,0,1.3]},{time:2,wind:[4,0,1]}];current.sampleFireworkEvent(a,a.burstTime,{windTimeline,smoke:false});legacy.sampleFireworkEvent(b,b.burstTime,{windTimeline,smoke:false});
  const actualA=current.sampleBody(a.rocket,a.burstTime,windTimeline),actualB=current.sampleBody(b.rocket,b.burstTime,windTimeline);
  for(let i=0;i<192;i++){const m=[1,.7,.4][i%3],x=a.heads[i],z=b.heads[i];vec(x.velocity.map((v,c)=>v-actualA.velocity[c]),z.velocity.map((v,c)=>(v-actualB.velocity[c])*m));
    vec(x.baseVelocity.map((v,c)=>v-a.baselineBurst.velocity[c]),z.baseVelocity.map((v,c)=>(v-b.baselineBurst.velocity[c])*m));assert.equal(x.drag,z.drag);assert.ok(Math.hypot(...x.baseVelocity.map((v,c)=>v-a.baselineBurst.velocity[c]))<=19+1e-10);}
  return{layers:['outer','middle','inner'],worldBurst:a.burstPosition};
});
check('Profile instantaneous RGB, I and envelope agree; peak budget and all-phase channels hold',()=>{
  let points=0;for(const effectProfile of ['three-heart-v1','two-colour-v1']){const e=current.createFireworkEvent({type:'chrysanthemum',effectProfile,seed:42});for(const body of e.heads){
    close(Math.max(...body.burnProfile.emission.knots.map(k=>Y(k.rgb))),body.intensity);for(let j=0;j<=20;j++){const age=body.life*j/20,v=current.sampleBodyEmission(body,age);close(v.intensityCdReference,Y(v.emissionRGBReference));close(v.envelope,v.intensityCdReference/body.intensity);assert.ok(v.envelope<=1+1e-13);for(let c=0;c<3;c++)assert.ok(v.emissionRGBReference[c]<=v.allPhaseMaximumRGB[c]*(1+1e-13));points++;}
  }}return{points};
});
check('0/1/2/64 optical gain is applied exactly once and never changes life/CDF/velocity',()=>{
  for(const effectProfile of ['three-heart-v1','two-colour-v1']){const events=[0,1,2,64].map(intensityScale=>current.createFireworkEvent({type:'chrysanthemum',effectProfile,seed:45,intensityScale}));for(let i=0;i<192;i++)for(let j=0;j<events.length;j++){
    const a=events[j].heads[i],b=events[1].heads[i],gain=[0,1,2,64][j];assert.equal(a.life,b.life);assert.deepEqual(a.velocity,b.velocity);assert.equal(sampleMaterialCDF(a.burnProfile,.5),sampleMaterialCDF(b.burnProfile,.5));const s=current.sampleBodyEmission(a,.5),t=current.sampleBodyEmission(b,.5);vec(s.emissionRGBReference,t.emissionRGBReference.map(v=>v*gain));if(!gain){assert.equal(s.envelope,0);assert.equal(s.intensityCdReference,0);}
  }}
});
check('Candidate public particles carry current RGB/colour and retire at the profile body life',()=>{
  const e=current.createFireworkEvent({type:'chrysanthemum',effectProfile:'two-colour-v1',seed:2}),time=e.burstTime+2,particles=current.sampleFireworkEvent(e,time,{smoke:false});assert.equal(particles.length,192);
  for(const p of particles){const s=current.sampleBodyEmission(p.body,p.age);assert.deepEqual(p.emissionRGBReference,s.emissionRGBReference);assert.deepEqual(p.colour,s.unitYColour);assert.equal(p.emission,s.envelope);}
  assert.equal(current.sampleFireworkEvent(e,e.burstTime+4,{smoke:false}).length,0);
});
check('Window8 local vector bins match pure analytic integral; caller buffers are borrowed and bounded',()=>{
  const e=current.createFireworkEvent({type:'chrysanthemum',effectProfile:'two-colour-v1',seed:42}),body=e.heads[0];let windows=0;
  for(const [fromAge,toAge]of [[-.1,.1],[1.35,1.7],[2.9,3.8],[.5,.5],[1.01,1.01+1e-8]])for(const C of [Float64Array,Float32Array]){
    const out=new C(26).fill(-77),v=current.sampleBodyEmissionWindow(body,{fromAge,toAge,bins:8,outRGB:out}),oracle=integrateBurnEmission(body.burnProfile,fromAge,toAge);assert.equal(v.rgbTaps,out);assert.equal(out[24],-77);assert.equal(out[25],-77);vec(v.averageRGBReference,oracle.averageRGBReference);vec(v.integralRGBReferenceSeconds,oracle.integralRGBReferenceSeconds);
    const average=[0,0,0];for(let k=0;k<8;k++)for(let c=0;c<3;c++)average[c]+=out[k*3+c]/8;vec(average,oracle.averageRGBReference,C===Float32Array?2e-7:1e-11);windows++;
  }
  assert.throws(()=>current.sampleBodyEmissionWindow(body,{fromAge:2,toAge:1}),RangeError);assert.throws(()=>current.sampleBodyEmissionWindow(body,{fromAge:0,toAge:1,outRGB:new Float64Array(23)}),TypeError);return{windows};
});
check('Legacy new sampler preserves original scalar and colour array; vector windows are opt-in',()=>{
  const e=current.createFireworkEvent({seed:42}),b=e.heads[0];for(const age of [-1,0,.1,1,b.life,b.life+1]){const s=current.sampleBodyEmission(b,age),env=current.bodyEmissionEnvelope(b,age);assert.equal(s.envelope,env);assert.equal(s.unitYColour,b.colour);assert.equal(s.intensityCdReference,b.intensity*env);vec(s.emissionRGBReference,b.colour.map(v=>v*b.intensity*env));}assert.throws(()=>current.sampleBodyEmissionWindow(b,{fromAge:0,toAge:1}),RangeError);
});
check('Simulation candidate is explicit; rejected combinations are atomic, legacy restoration is explicit',()=>{
  const s=current.createFireworksSimulation();assert.throws(()=>s.configure({effectProfile:'three-heart-v1'}),RangeError);assert.equal(s.settings.type,'peony');s.configure({type:'chrysanthemum',effectProfile:'three-heart-v1'});assert.throws(()=>s.configure({autoLaunch:true}),RangeError);assert.equal(s.settings.autoLaunch,false);assert.throws(()=>s.launchRandom(),RangeError);assert.equal(s.active.length,0);
  const launched=s.launch({seed:42});assert.equal(launched.effectProfile,'three-heart-v1');assert.equal(s.state.activeEvents[0].effectProfile,'three-heart-v1');assert.equal(s.lastLaunch.effectProfile,'three-heart-v1');assert.throws(()=>s.configure({type:'peony'}),RangeError);s.configure({type:'peony',effectProfile:'legacy'});assert.equal(s.launch({seed:3}).accepted,true);
});
check('Direct unsupported profiles reject, compiled descriptors stay immutable and do not change source bodies',()=>{
  for(const type of current.FIREWORK_TYPES.filter(t=>t.id!=='chrysanthemum'))assert.throws(()=>current.createFireworkEvent({type:type.id,effectProfile:'three-heart-v1'}),RangeError);assert.throws(()=>current.createFireworkEvent({type:'chrysanthemum',effectProfile:'other'}),RangeError);
  const e=current.createFireworkEvent({type:'chrysanthemum',seed:42}),copy=structuredClone(e.heads),p=compileFireworkLayerProfile({type:'chrysanthemum',effectProfile:'three-heart-v1',heads:e.heads,burstVelocity:e.baselineBurst.velocity,eventSeed:e.seed});assert.deepEqual(e.heads,copy);assert.throws(()=>p.patches[0].burnProfile.metadata.layerId='wrong',TypeError);assert.throws(()=>p.limits.maximumBodySeconds=9,TypeError);
});
check('RNG/kernels/audio contracts remain labelled reference and approved audio is unchanged',()=>{
  assert.equal(hash('fireworks-audio.js'),'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');return{physicsSHA256:hash('fireworks-physics.js'),layerSHA256:hash('firework-layer-profile.js'),pureProfileSHA256:hash('firework-burn-profile.js'),audioSHA256:hash('fireworks-audio.js')};
});
const report={schema:'glass-atoll.r17-layer-profile-check.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,limits:['G0/G1 and pure source windows only; root owns FW/main/optics integration.','No smoke CDF scheduler change, GPU, native image or sound acceptance.','Named I0 peak budget retained; different lifetimes do change reference intensity time integral.']},encoded=JSON.stringify(report,null,2)+'\n',runs=new URL('./r17-layer-profile-runs/',import.meta.url);fs.mkdirSync(runs,{recursive:true});fs.writeFileSync(new URL(started.replace(/[:.]/g,'-')+'.json',runs),encoded);fs.writeFileSync(new URL('./r17-layer-profile-check.json',import.meta.url),encoded);console.log(encoded);if(!report.passed)process.exitCode=1;
