import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BURN_PROFILE_SCHEMA,PHOTOPIC_Y,createBurnProfile,sampleBurnProfile,integrateBurnEmission,sampleBurnShutter,sampleMaterialCDF,integrateMaterialFraction,instantiateBurnProfile,createMaterialLedger,advanceMaterialLedger,clearMaterialLedger,EXAMPLE_BURN_PROFILES,EXAMPLE_EFFECT_DESCRIPTORS} from '../firework-burn-profile.js';
const results=[],started=new Date().toISOString(),hash=path=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url))).digest('hex');
const protectedFiles=['fireworks.js','fireworks-physics.js','fireworks-audio.js','pyro-smoke-logical-burn.js','scene-radiometry.js'],before=Object.fromEntries(protectedFiles.map(p=>[p,hash(p)]));
const close=(a,b,eps=2e-12)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),vec=(a,b,eps)=>a.forEach((v,i)=>close(v,b[i],eps));
const Y=rgb=>rgb.reduce((s,v,c)=>s+v*PHOTOPIC_Y[c],0),black=age=>({age,rgb:[0,0,0]});
const input=()=>({id:'analytic',emissionKnots:[black(0),{age:1,rgb:[2,0,0]},{age:2,rgb:[0,1,0]},black(3)],materialRateKnots:[{age:0,rate:0},{age:1,rate:1},{age:3,rate:1},{age:4,rate:0}],metadata:{nested:{value:1}}});
const fixture=createBurnProfile(input());
function check(name,fn){try{results.push({name,passed:true,details:fn()??null});}catch(error){results.push({name,passed:false,error:error.stack});}}
check('Versioned deep immutable descriptors do not retain caller references',()=>{
  const a=input(),p=createBurnProfile(a);a.emissionKnots[1].rgb[0]=99;a.metadata.nested.value=8;assert.equal(p.schema,BURN_PROFILE_SCHEMA);assert.equal(sampleBurnProfile(p,1).emissionRGBReference[0],2);assert.equal(p.metadata.nested.value,1);
  assert.throws(()=>p.emission.knots[1].rgb[0]=8,TypeError);assert.throws(()=>p.metadata.nested.value=9,TypeError);assert.throws(()=>sampleBurnProfile({...p},1),TypeError);return{calibrationStatus:p.calibrationStatus,physical:p.physical};
});
check('Actual knot values, finite support and raw reference RGB unit contract',()=>{
  vec(sampleBurnProfile(fixture,-1).emissionRGBReference,[0,0,0]);vec(sampleBurnProfile(fixture,0).emissionRGBReference,[0,0,0]);vec(sampleBurnProfile(fixture,1).emissionRGBReference,[2,0,0]);vec(sampleBurnProfile(fixture,1.5).emissionRGBReference,[1,.5,0]);vec(sampleBurnProfile(fixture,3).emissionRGBReference,[0,0,0]);vec(sampleBurnProfile(fixture,30).emissionRGBReference,[0,0,0]);
  for(const age of [.1,1,1.5,2.1]){const p=sampleBurnProfile(fixture,age);close(Y(p.unitYColour),1);vec(p.unitYColour.map(v=>v*p.intensityCdReference),p.emissionRGBReference);}return{midpoint:sampleBurnProfile(fixture,1.5)};
});
check('Exact vector shutter integral differs from avg(I) times avg(colour)',()=>{
  const value=integrateBurnEmission(fixture,1,2);vec(value.integralRGBReferenceSeconds,[1,.5,0]);vec(value.averageRGBReference,[1,.5,0]);
  const a=sampleBurnProfile(fixture,1),b=sampleBurnProfile(fixture,2),wrong=a.unitYColour.map((v,c)=>(v+b.unitYColour[c])*.5*(a.intensityCdReference+b.intensityCdReference)*.5);
  assert.ok(Math.abs(wrong[0]-value.averageRGBReference[0])>.3);return{correct:value.averageRGBReference,incorrectIndependentAverages:wrong};
});
check('Clipped local-overlap integration, knot crossings and zero-width limits',()=>{
  vec(integrateBurnEmission(fixture,-2,5).integralRGBReferenceSeconds,[2,1,0]);vec(integrateBurnEmission(fixture,1,1).integralRGBReferenceSeconds,[0,0,0]);vec(integrateBurnEmission(fixture,1,1).averageRGBReference,[2,0,0]);vec(sampleBurnShutter(fixture,{age:1.5,shutterSeconds:1}).averageRGBReference,[1,.5,0]);
  vec(sampleBurnShutter(fixture,{age:1,shutterSeconds:0}).averageRGBReference,[2,0,0]);assert.throws(()=>integrateBurnEmission(fixture,2,1),RangeError);assert.throws(()=>sampleBurnShutter(fixture,{age:1e12,shutterSeconds:1e-8}),RangeError);
});
check('Tiny late windows use local integrals instead of catastrophic prefix subtraction',()=>{
  const p=createBurnProfile({id:'large-prefix',emissionKnots:[black(0),{age:1,rgb:[1e9,0,0]},{age:1000,rgb:[1e9,0,0]},{age:1000.1,rgb:[1,0,0]},{age:1001,rgb:[1,0,0]},black(1002)],materialRateKnots:[{age:0,rate:1},{age:1002,rate:1}]});
  const lo=1000.7,hi=lo+1e-8,r=integrateBurnEmission(p,lo,hi);assert.equal(r.averageRGBReference[0],1);assert.equal(r.integralRGBReferenceSeconds[0],hi-lo);return{windowSeconds:hi-lo,localIntegral:r.integralRGBReferenceSeconds[0],naivePrefixDifference:integrateBurnEmission(p,0,hi).integralRGBReferenceSeconds[0]-integrateBurnEmission(p,0,lo).integralRGBReferenceSeconds[0]};
});
check('Independent Simpson integration witnesses across every colour and fade segment',()=>{
  let windows=0,maximumError=0;
  for(const p of Object.values(EXAMPLE_BURN_PROFILES))for(let segment=0;segment<p.emission.knots.length-1;segment++){
    const left=p.emission.knots[segment],right=p.emission.knots[segment+1],a=left.age+(right.age-left.age)*.13,b=left.age+(right.age-left.age)*.91,m=(a+b)*.5;
    // Independent point samples plus Simpson rule are exact for linear segments.
    const va=sampleBurnProfile(p,a).emissionRGBReference,vm=sampleBurnProfile(p,m).emissionRGBReference,vb=sampleBurnProfile(p,b).emissionRGBReference,oracle=va.map((v,c)=>(b-a)/6*(v+4*vm[c]+vb[c]));
    const actual=integrateBurnEmission(p,a,b).integralRGBReferenceSeconds;vec(actual,oracle);maximumError=Math.max(maximumError,...actual.map((v,c)=>Math.abs(v-oracle[c])));windows++;
  }
  return{windows,maximumError};
});
check('Black and subnormal emission never produce NaN or infinite normalized colour',()=>{
  const p=createBurnProfile({id:'subnormal',emissionKnots:[black(0),{age:1,rgb:[Number.MIN_VALUE,0,0]},black(2)],materialRateKnots:[{age:0,rate:1},{age:2,rate:1}]});
  const s=sampleBurnProfile(p,1);assert.equal(s.emissionRGBReference[0],Number.MIN_VALUE);vec(s.unitYColour,[0,0,0]);for(const q of [sampleBurnProfile(fixture,-1),s,sampleBurnShutter(p,{age:1,shutterSeconds:0})])assert.ok(Object.values(q).flat().filter(v=>typeof v==='number').every(Number.isFinite));
});
check('Nonnegative normalized material CDF and analytic interval fractions',()=>{
  close(sampleMaterialCDF(fixture,1),1/6);close(sampleMaterialCDF(fixture,3),5/6);close(integrateMaterialFraction(fixture,1,3),2/3);assert.equal(sampleMaterialCDF(fixture,4),1);assert.equal(sampleMaterialCDF(fixture,-3),0);
  let previous=0;for(let i=0;i<=4000;i++){const value=sampleMaterialCDF(fixture,i/1000);assert.ok(value>=previous&&value<=1);previous=value;}return{normalizationArea:fixture.material.normalizationArea,final:previous};
});
check('Material ledger closure is partition independent at30/60/120Hz and irregular cadence',()=>{
  const finals=[];for(const hz of [30,60,120]){let ledger=createMaterialLedger(fixture,{budget:20.35}),sum=0;for(let i=1;i<=4*hz;i++){const tx=advanceMaterialLedger(ledger,i/hz);assert.ok(tx.emission.amount>=0);sum+=tx.emission.amount;ledger=tx.ledger;close(ledger.budget,ledger.emitted+ledger.reserved+ledger.cancelled);}assert.equal(ledger.emitted,20.35);assert.equal(ledger.reserved,0);close(sum,20.35);finals.push(ledger.emitted);}
  let ledger=createMaterialLedger(fixture,{budget:20.35});for(const t of [.001,.09,.731,1.231,1.232,2.2,3.999,9])ledger=advanceMaterialLedger(ledger,t).ledger;assert.equal(ledger.emitted,20.35);return{finals,irregularFinal:ledger.emitted};
});
check('Late tiny material packet survives a huge already-emitted prefix',()=>{
  const p=createBurnProfile({id:'material-dynamic-range',emissionKnots:[black(0),black(2000)],materialRateKnots:[{age:0,rate:1e9},{age:1000,rate:1e9},{age:1000.000001,rate:1e-4},{age:2000,rate:1e-4}]});
  const first=advanceMaterialLedger(createMaterialLedger(p,{budget:1e12}),1500),second=advanceMaterialLedger(first.ledger,1501),oracle=1e12*integrateMaterialFraction(p,1500,1501);
  assert.ok(second.emission.amount>0);close(second.emission.amount,oracle,1e-13);return{expected:oracle,actual:second.emission.amount};
});
check('Pure staged ledger transition, clear absorbing state and rewind rejection',()=>{
  const initial=createMaterialLedger(fixture,{budget:3}),tx=advanceMaterialLedger(initial,1);assert.equal(initial.emitted,0);close(tx.emission.amount,.5);assert.equal(advanceMaterialLedger(initial,1).emission.amount,tx.emission.amount);
  assert.throws(()=>advanceMaterialLedger(tx.ledger,.5),RangeError);const cleared=clearMaterialLedger(tx.ledger);close(cleared.emitted,.5);close(cleared.cancelled,2.5);assert.equal(cleared.reserved,0);assert.equal(advanceMaterialLedger(cleared,4).emission.amount,0);assert.equal(clearMaterialLedger(cleared),cleared);assert.throws(()=>advanceMaterialLedger({...cleared},4),TypeError);
});
check('Body-keyed randomness is stable, independent of iteration order and bounded',()=>{
  const options={eventSeed:42,bodyId:7,layerId:'outer'},a=instantiateBurnProfile(EXAMPLE_BURN_PROFILES.twoColour,options),b=instantiateBurnProfile(EXAMPLE_BURN_PROFILES.twoColour,options);
  assert.deepEqual(a,b);const others=new Map([9,7,1,3].map(bodyId=>[bodyId,instantiateBurnProfile(EXAMPLE_BURN_PROFILES.twoColour,{...options,bodyId})]));assert.deepEqual(others.get(7),a);assert.notDeepEqual(others.get(9).metadata.instance,a.metadata.instance);
  for(let bodyId=0;bodyId<256;bodyId++){const p=instantiateBurnProfile(EXAMPLE_BURN_PROFILES.twoColour,{eventSeed:42,bodyId}),i=p.metadata.instance;assert.ok(i.timeScale>=.94&&i.timeScale<=1.06);assert.ok(i.intensityScale>=.88&&i.intensityScale<=1.12);}return{instance:a.metadata.instance};
});
check('Every allowed base profile ID can instantiate without derived-label overflow',()=>{
  const p=createBurnProfile({...input(),id:'x'.repeat(256)}),instance=instantiateBurnProfile(p,{eventSeed:1,bodyId:1});assert.ok(instance.id.length<=256);assert.equal(instance.metadata.instance.baseProfileId,p.id);
});
check('Optical0/1/2 changes RGB only; material mass/time and propulsion remain independent',()=>{
  const make=opticalScale=>instantiateBurnProfile(EXAMPLE_BURN_PROFILES.bee,{eventSeed:17,bodyId:'bee5',opticalScale}),a=make(0),b=make(1),c=make(2);
  for(const age of [0,.01,.4,1,1.6,2]){vec(sampleBurnProfile(a,age).emissionRGBReference,[0,0,0]);vec(sampleBurnProfile(c,age).emissionRGBReference,sampleBurnProfile(b,age).emissionRGBReference.map(v=>2*v));assert.equal(sampleMaterialCDF(a,age),sampleMaterialCDF(b,age));assert.equal(sampleMaterialCDF(c,age),sampleMaterialCDF(b,age));}
  assert.deepEqual(a.propulsion,b.propulsion);assert.deepEqual(b.propulsion,c.propulsion);assert.equal(advanceMaterialLedger(createMaterialLedger(a,{budget:.9}),3).ledger.emitted,.9);
});
check('Example descriptors contain actual different colour/life/layer contracts without new trajectories',()=>{
  const d=EXAMPLE_EFFECT_DESCRIPTORS;assert.equal(d.threeLayer.layers.reduce((s,l)=>s+l.count,0),192);close(d.threeLayer.layers.reduce((s,l)=>s+l.referenceMaterialShare,0),1);assert.deepEqual(d.threeLayer.layers.map(l=>l.profile.emission.endAge),[3.4,4.6,2.6]);
  const a=sampleBurnProfile(EXAMPLE_BURN_PROFILES.twoColour,.5),b=sampleBurnProfile(EXAMPLE_BURN_PROFILES.twoColour,2);assert.ok(a.emissionRGBReference[0]>a.emissionRGBReference[1]);assert.ok(b.emissionRGBReference[1]>b.emissionRGBReference[0]);
  const p=EXAMPLE_BURN_PROFILES.bee.propulsion;assert.equal(p.endAge,1);assert.ok(p.integratedAccelerationBoundMetresPerSecond<=12);assert.equal(p.trajectoryImplemented,false);assert.equal(d.poweredBees.trajectoryImplemented,false);return{threeLayerEnds:d.threeLayer.layers.map(l=>l.profile.emission.endAge),bee:p};
});
check('All-phase source bound covers interpolated channels, including instanced variability',()=>{
  const profiles=[...Object.values(EXAMPLE_BURN_PROFILES),...Array.from({length:8},(_,bodyId)=>instantiateBurnProfile(EXAMPLE_BURN_PROFILES.twoColour,{eventSeed:9,bodyId}))];
  let points=0;for(const p of profiles)for(let i=0;i<=200;i++){const s=sampleBurnProfile(p,p.lifetimeSeconds*i/200);s.emissionRGBReference.forEach((v,c)=>assert.ok(v>=0&&v<=p.emission.sourceMaximumRGB[c]*(1+1e-14)));points++;}
  return{points,reason:'Analytic piecewise-linear positive interpolation stays in the convex hull of adjacent knots; finite samples are regression witnesses, not the proof'};
});
check('Malformed/unbounded inputs reject before a profile/ledger exists',()=>{
  const cyclic={};cyclic.self=cyclic;
  const cases=[()=>createBurnProfile({...input(),emissionKnots:[black(0),{age:0,rgb:[1,0,0]},black(1)]}),()=>createBurnProfile({...input(),emissionKnots:[black(0),{age:1,rgb:[-1,0,0]},black(2)]}),()=>createBurnProfile({...input(),emissionKnots:[{age:0,rgb:[1,0,0]},black(1)]}),()=>createBurnProfile({...input(),materialRateKnots:[{age:0,rate:0},{age:1,rate:0}]}),()=>createBurnProfile({...input(),metadata:null}),()=>createBurnProfile({...input(),metadata:{x:NaN}}),()=>createBurnProfile({...input(),metadata:{x:undefined}}),()=>createBurnProfile({...input(),metadata:cyclic}),()=>createBurnProfile({...input(),metadata:{x:new Array(300)}}),()=>createBurnProfile({...input(),propulsion:{kind:'fake-engine'}}),()=>createMaterialLedger(fixture,{budget:-1}),()=>instantiateBurnProfile(fixture,{bodyId:1,eventSeed:NaN}),()=>sampleBurnProfile(fixture,Infinity)];
  for(const run of cases)assert.throws(run);return{rejections:cases.length};
});
check('Sparse RGB arrays reject before derived NaN reaches a profile',()=>{
  const rgb=[1,,1];assert.throws(()=>createBurnProfile({...input(),emissionKnots:[black(0),{age:1,rgb},black(2)]}));
});
check('Stage1 leaves protected production physics/render/audio/smoke/radiometry bytes unchanged',()=>{
  const after=Object.fromEntries(protectedFiles.map(p=>[p,hash(p)]));assert.deepEqual(after,before);assert.equal(after['fireworks-audio.js'],'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');return after;
});
const report={schema:'glass-atoll.r17-burn-profile-check.v1',started,completed:new Date().toISOString(),passed:results.every(r=>r.passed),counts:{passed:results.filter(r=>r.passed).length,total:results.length},moduleSHA256:hash('firework-burn-profile.js'),protectedSHA256:before,results,limits:['Pure opt-in author-reference profile only; no runtime imports or integration.','No measured photometry, fuel/kg balance, propulsion trajectory, smoke transport, GPU, actual sound or visual acceptance.','Emission integration excludes moving transmission T(t); current renderer anchor-T approximation is not changed.','Ledger deltas are pure proposals; downstream host must retain its transactional prepare/commit and family allocation.']};
const encoded=JSON.stringify(report,null,2)+'\n',base=new URL('./r17-burn-profile-check',import.meta.url),runs=new URL('./r17-burn-profile-runs/',import.meta.url);fs.mkdirSync(runs,{recursive:true});fs.writeFileSync(new URL(started.replace(/[:.]/g,'-')+'.json',runs),encoded);fs.writeFileSync(new URL(base.href+'.json'),encoded);console.log(encoded);if(!report.passed)process.exitCode=1;
