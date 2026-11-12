import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createFiniteThrustProfile,compileSeededBeeThrust,sampleFiniteThrustResponse,sampleFiniteThrustAcceleration,getFiniteThrustMotionBound,FINITE_THRUST_LIMITS} from '../firework-thrust-profile.js';
import {sampleBody} from '../fireworks-physics.js';
const checks=[],started=new Date().toISOString(),check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack)});}},norm=a=>Math.hypot(...a),close=(a,b,t=2e-10)=>assert(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),vec=(a,b,t)=>{assert.equal(a.length,b.length);a.forEach((v,c)=>close(v,b[c],t));};
const constant=createFiniteThrustProfile({id:'constant-x',cells:[{fromAge:0,toAge:1,acceleration:[12,0,0]}]}),sample=(p,t,k=.613125)=>sampleFiniteThrustResponse(p,t,k);

// Independent fourth-order differential stepper. Force/wind breaks split the
// integration intervals; within a held cell all four RK stages see that cell.
function ode(profile,age,k,{initialP=[0,0,0],initialV=[0,0,0],gravity=0,windKnots=[{time:0,wind:[0,0,0]}],dtLimit=2e-4}={}){
  const cuts=[0,...profile.cells.flatMap(c=>[c.fromAge,c.toAge]),...windKnots.map(x=>x.time),age].filter(t=>t>=0&&t<=age).sort((a,b)=>a-b),unique=[...new Set(cuts)];let p=[...initialP],v=[...initialV];
  for(let i=0;i<unique.length-1;i++){
    const lo=unique[i],hi=unique[i+1],mid=(lo+hi)*.5,cell=profile.cells.find(c=>mid>=c.fromAge&&mid<c.toAge),a=cell?.acceleration??[0,0,0],w=[...windKnots].reverse().find(c=>c.time<=mid)?.wind??[0,0,0],n=Math.max(1,Math.ceil((hi-lo)/Math.min(dtLimit,k>0?.25/k:dtLimit))),h=(hi-lo)/n;
    const acceleration=x=>x.map((q,c)=>-k*(q-w[c])+a[c]-(c===1?gravity:0));
    for(let step=0;step<n;step++){
      const a1=acceleration(v),v2=v.map((x,c)=>x+a1[c]*h*.5),a2=acceleration(v2),v3=v.map((x,c)=>x+a2[c]*h*.5),a3=acceleration(v3),v4=v.map((x,c)=>x+a3[c]*h),a4=acceleration(v4);
      p=p.map((x,c)=>x+h/6*(v[c]+2*v2[c]+2*v3[c]+v4[c]));v=v.map((x,c)=>x+h/6*(a1[c]+2*a2[c]+2*a3[c]+a4[c]));
    }
  }
  return{position:p,velocity:v};
}
check('finite immutable cells and protected output/cache ownership',()=>{
  const source={id:'copy witness',cells:[{fromAge:0,toAge:.5,acceleration:[1,2,3]},{fromAge:.5,toAge:1,acceleration:[-2,1,0]}]},p=createFiniteThrustProfile(source),saved=sample(p,.8,.7);source.cells[0].acceleration[0]=11;assert(Object.isFrozen(p)&&Object.isFrozen(p.cells)&&Object.isFrozen(p.cells[0].acceleration));
  const mutated=sample(p,.8,.7);mutated.positionDelta.fill(999);mutated.velocityDelta.fill(999);sampleFiniteThrustAcceleration(p,.8).fill(999);assert.deepEqual(sample(p,.8,.7),saved);
  for(const k of [.1,.2,.3,.4,.5,.6])sample(p,.8,k);assert.deepEqual(sample(p,.8,.7),saved);return{immutable:true,responseCacheKeysBound:FINITE_THRUST_LIMITS.responseCacheEntriesPerProfile};
});
check('constant-force response agrees with independent RK4 over k0/small/normal/high drag',()=>{
  let maxPositionError=0,maxVelocityError=0,cases=0;for(const k of [0,1e-12,1e-6,.001,.613125,10,1000])for(const t of [1e-8,.07,.5,1,1.4]){const actual=sample(constant,t,k),reference=ode(constant,t,k);vec(actual.positionDelta,reference.position,2e-9);vec(actual.velocityDelta,reference.velocity,2e-9);maxPositionError=Math.max(maxPositionError,...actual.positionDelta.map((x,c)=>Math.abs(x-reference.position[c])));maxVelocityError=Math.max(maxVelocityError,...actual.velocityDelta.map((x,c)=>Math.abs(x-reference.velocity[c])));cases++;}return{cases,maxPositionError,maxVelocityError,oracle:'RK4 differential equations, force-cell aligned, h<=.0002 and k*h<=.25'};
});
check('correlated seeded schedules agree with independent ODE and preserve finite mean-envelope area',()=>{
  let cases=0,maxError=0,maxCells=0;for(const seed of [0,1,42,0xffffffff])for(const timeScale of [.94,1,1.06]){
    const p=compileSeededBeeThrust({eventSeed:seed,bodyId:31,timeScale});maxCells=Math.max(maxCells,p.cells.length);close(p.integratedAccelerationMagnitudeMetresPerSecond,p.authoring.scalarEnvelopeAreaMetresPerSecond,2e-14);assert(p.motorEndAge<=1.06&&p.cells.length<=12&&p.maximumAccelerationMetresPerSecondSquared<=12&&p.integratedAccelerationMagnitudeMetresPerSecond<=12.72);
    for(const k of [0,.613125,2])for(const t of [.03,.42,1.17]){const actual=sample(p,t,k),reference=ode(p,t,k);vec(actual.positionDelta,reference.position,2e-9);vec(actual.velocityDelta,reference.velocity,2e-9);maxError=Math.max(maxError,...actual.positionDelta.map((x,c)=>Math.abs(x-reference.position[c])),...actual.velocityDelta.map((x,c)=>Math.abs(x-reference.velocity[c])));cases++;}
  }return{cases,maxError,maxCells};
});
check('k→0, subnormal k*dt, short ages and drag cache eviction remain stable',()=>{
  const evidence=[];for(const k of [Number.MIN_VALUE,1e-250,1e-18,1e-12])for(const t of [1e-100,1e-12,.001,.9,1.7]){const a=sample(constant,t,k),zero=sample(constant,t,0);vec(a.positionDelta,zero.positionDelta,3e-12);vec(a.velocityDelta,zero.velocityDelta,3e-12);assert(a.positionDelta.every(Number.isFinite)&&a.velocityDelta.every(Number.isFinite));evidence.push({k,t,p:a.positionDelta[0],v:a.velocityDelta[0]});}
  const extreme=sample(constant,3600,1000);assert(extreme.positionDelta.every(Number.isFinite)&&extreme.velocityDelta.every(Number.isFinite));return{cases:evidence.length,underflowExample:evidence[0],maximumAge:extreme.age};
});
check('right-hand force selection and cutoff retain continuous pose and inertial velocity',()=>{
  const p=createFiniteThrustProfile({id:'turn and cutoff',cells:[{fromAge:0,toAge:.25,acceleration:[10,0,0]},{fromAge:.25,toAge:.75,acceleration:[0,8,0]},{fromAge:.75,toAge:1,acceleration:[-4,0,0]}]}),eps=1e-8;let boundaries=0;
  for(const t of [.25,.75,1]){const a=sample(p,t-eps),b=sample(p,t),c=sample(p,t+eps);vec(a.positionDelta,b.positionDelta,2e-7);vec(c.positionDelta,b.positionDelta,2e-7);vec(a.velocityDelta,b.velocityDelta,2e-7);vec(c.velocityDelta,b.velocityDelta,2e-7);assert.deepEqual(b.motorAcceleration,t===1?[0,0,0]:p.cells[t===.25?1:2].acceleration);vec(c.velocityDelta.map((v,i)=>(v-b.velocityDelta[i])/eps),b.responseAcceleration,2e-6);boundaries++;}
  const end=sample(p,1),later=sample(p,1.4);assert(norm(end.velocityDelta)>1);assert.deepEqual(end.motorAcceleration,[0,0,0]);vec(later.velocityDelta,end.velocityDelta.map(x=>x*Math.exp(-.613125*.4)),2e-13);return{boundaries,cutoffVelocity:end.velocityDelta,afterCutoffVelocity:later.velocityDelta};
});
check('future force cells cannot affect any earlier response or acceleration',()=>{
  const prefix={fromAge:0,toAge:.5,acceleration:[1,2,0]},a=createFiniteThrustProfile({id:'future A',cells:[prefix,{fromAge:.5,toAge:1,acceleration:[12,0,0]}]}),b=createFiniteThrustProfile({id:'future B',cells:[prefix,{fromAge:.5,toAge:1,acceleration:[-12,0,0]}]});
  for(const k of [0,.1,2])for(const t of [0,.01,.4,.499999])assert.deepEqual(sample(a,t,k),sample(b,t,k));const atA=sample(a,.5),atB=sample(b,.5);assert.deepEqual(atA.positionDelta,atB.positionDelta);assert.deepEqual(atA.velocityDelta,atB.velocityDelta);assert.notDeepEqual(atA.motorAcceleration,atB.motorAcceleration);assert.equal(sample(a,-.1),null);assert.equal(sampleFiniteThrustAcceleration(a,-.1),null);return{earlierQueries:12,atBoundaryPoseIdentical:true,rightHandNewForcesDiffer:true};
});
check('motor contribution superposes with actual ballistic/wind/gravity pose and independent full ODE',()=>{
  const profile=compileSeededBeeThrust({eventSeed:91,bodyId:18}),body={birth:0,position:[1,100,-2],velocity:[2,3,-1],drag:.613125,gravity:9.81},windKnots=[{time:0,wind:[1,0,-1]},{time:.3,wind:[-2,.2,3]},{time:.9,wind:[4,-.1,0]}];let cases=0,maxError=0;
  for(const k of [0,.613125,2])for(const t of [.2,.6,1.2,2]){
    const motion=sample(profile,t,k),base=sampleBody({...body,drag:k},t,windKnots),combinedP=base.position.map((v,c)=>v+motion.positionDelta[c]),combinedV=base.velocity.map((v,c)=>v+motion.velocityDelta[c]),reference=ode(profile,t,k,{initialP:body.position,initialV:body.velocity,gravity:body.gravity,windKnots});
    vec(combinedP,reference.position,2e-9);vec(combinedV,reference.velocity,2e-9);maxError=Math.max(maxError,...combinedP.map((v,c)=>Math.abs(v-reference.position[c])),...combinedV.map((v,c)=>Math.abs(v-reference.velocity[c])));cases++;
  }return{cases,maxError,scope:'Detached composition with actual base sampler; production sampleBody has no thrust import yet'};
});
check('frame rotation and keyed seeds are deterministic without Math.random or query-order dependence',()=>{
  const original=Math.random;Math.random=()=>{throw new Error('Forbidden frame RNG');};let p,q;try{p=compileSeededBeeThrust({eventSeed:42,bodyId:7,timeScale:1.06});q=compileSeededBeeThrust({eventSeed:42,bodyId:7,timeScale:1.06});}finally{Math.random=original;}
  assert.deepEqual(p,q);assert.notDeepEqual(p.cells,compileSeededBeeThrust({eventSeed:43,bodyId:7,timeScale:1.06}).cells);assert.notDeepEqual(p.cells,compileSeededBeeThrust({eventSeed:42,bodyId:8,timeScale:1.06}).cells);
  const frame={right:[0,0,-1],up:[0,1,0],forward:[1,0,0]},rotated=compileSeededBeeThrust({eventSeed:42,bodyId:7,timeScale:1.06,frame}),rotate=v=>[v[2],v[1],-v[0]];
  for(const t of [0,.07,.33,.9,1.4]){const a=sample(p,t),b=sample(rotated,t);vec(b.positionDelta,rotate(a.positionDelta),2e-13);vec(b.velocityDelta,rotate(a.velocityDelta),2e-13);vec(b.motorAcceleration,rotate(a.motorAcceleration),2e-13);}
  const target=sample(p,1.3);for(const hz of [30,60,120]){for(let n=0;n<=Math.ceil(1.3*hz);n++)sample(p,Math.min(1.3,n/hz));assert.deepEqual(sample(p,1.3),target);}for(const t of [1.2,.01,.8,.22,1.3,.45])sample(p,t);assert.deepEqual(sample(p,1.3),target);return{seedReplay:true,rateSequences:[30,60,120,'irregular past-order'],rotationQueries:5};
});
check('declared heading-step and impulse-kernel motion bounds enclose all sampled trajectories',()=>{
  let profiles=0,queries=0,maxStep=0;for(let s=0;s<24;s++)for(const timeScale of [.94,1,1.06]){
    const p=compileSeededBeeThrust({eventSeed:(s*2654435761)>>>0,bodyId:s*7%192,timeScale});profiles++;
    const headings=p.authoring.headingsLocal;for(let i=1;i<headings.length;i++){const dot=headings[i].reduce((sum,x,c)=>sum+x*headings[i-1][c],0),angle=Math.acos(Math.min(1,Math.max(-1,dot)))*180/Math.PI;maxStep=Math.max(maxStep,angle);assert(angle<=22.5+1e-10);}
    for(const k of [0,1e-12,.613125,10])for(const age of [0,.02,.2,.8,1.06,2,20]){const a=sample(p,age,k),b=getFiniteThrustMotionBound(p,age,k);assert(norm(a.velocityDelta)<=b.maximumVelocityDeltaMetresPerSecond+1e-11);assert(norm(a.positionDelta)<=b.maximumPositionDeltaMetres+1e-10);queries++;}
  }return{profiles,queries,maxStepDegrees:maxStep,warning:'Heading step is not a continuous angular-rate bound; numerical enclosures use stated tolerance'};
});
check('invalid data, accessors, spoof profiles and unbounded clocks are rejected without getter execution',()=>{
  let getterCalls=0,count=0;const badProfiles=[{id:'bad',cells:[]},{id:'bad',cells:[{fromAge:.1,toAge:1,acceleration:[1,0,0]}]},{id:'bad',cells:[{fromAge:0,toAge:1.07,acceleration:[1,0,0]}]},{id:'bad',cells:[{fromAge:0,toAge:1,acceleration:[13,0,0]}]},{id:'bad',cells:[{fromAge:0,toAge:1,acceleration:[NaN,0,0]}]},{id:'bad',cells:[{fromAge:0,toAge:1,acceleration:[,0,0]}]},{get id(){getterCalls++;return'bad';},cells:[]}];
  for(const value of badProfiles){assert.throws(()=>createFiniteThrustProfile(value));count++;}
  const badCalls=[()=>sample({},1),()=>sample(constant,Infinity),()=>sample(constant,3601),()=>sample(constant,1,-1),()=>sample(constant,1,NaN),()=>sample(constant,1,1001),()=>compileSeededBeeThrust({eventSeed:-1,bodyId:1}),()=>compileSeededBeeThrust({eventSeed:1,bodyId:192}),()=>compileSeededBeeThrust({eventSeed:1,bodyId:1,timeScale:1.07}),()=>compileSeededBeeThrust({eventSeed:1,bodyId:1,frame:{right:[1,0,0],up:[0,1,0],forward:[0,0,-1]}})];
  for(const fn of badCalls){assert.throws(fn);count++;}assert.equal(getterCalls,0);return{rejections:count,getterCalls};
});
const source=fs.readFileSync(new URL('../firework-thrust-profile.js',import.meta.url)),report={schema:'glass-atoll.r20-finite-thrust-cpu.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},helperSHA256:crypto.createHash('sha256').update(source).digest('hex'),checks,limits:['New pure helper only; no scene/sampleBody/smoke/framing/optical pipeline integration or native GPU run.','Authored effective acceleration/drag; no calibrated thrust, mass, fuel, photometry, continuous attitude or real bee fit.','Prefix tables use known immutable force cells only; queried response never uses a cell portion after the requested relative age.','Piecewise-held acceleration may jump; position/velocity remain continuous. Independent ODE is a numerical oracle with finite tolerance.']};fs.writeFileSync(new URL('./r20-finite-thrust-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
