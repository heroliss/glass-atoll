import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createFiniteThrustProfile,compileSeededBeeThrust,sampleFiniteThrustResponse,sampleFiniteThrustAcceleration,getFiniteThrustMotionBound,FINITE_THRUST_LIMITS} from '../firework-thrust-profile.js';

const source=fs.readFileSync(new URL('../firework-thrust-profile.js',import.meta.url)),sha=crypto.createHash('sha256').update(source).digest('hex'),expectedSHA='c9b1d306d3681594e9cc2f20ddb00ddb6719c0b3d66079f5ce13e895b0d2471a';
const checks=[],norm=v=>Math.hypot(...v),check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}};
const explicit=createFiniteThrustProfile({id:'independent-oblique-cells',cells:[{fromAge:0,toAge:.013,acceleration:[2,-1,3]},{fromAge:.013,toAge:.167,acceleration:[-3,8,1]},{fromAge:.167,toAge:.61,acceleration:[1,0,-5]},{fromAge:.61,toAge:1.06,acceleration:[0,2,0]}]});
const seeded=[compileSeededBeeThrust({eventSeed:0,bodyId:0,timeScale:.94}),compileSeededBeeThrust({eventSeed:0xffffffff,bodyId:191,timeScale:1.06}),compileSeededBeeThrust({eventSeed:44,bodyId:23,timeScale:1})];

check('Source freeze and declared finite-domain contracts are pinned',()=>{assert.equal(sha,expectedSHA);assert.equal(FINITE_THRUST_LIMITS.maximumCells,12);assert.equal(FINITE_THRUST_LIMITS.responseCacheEntriesPerProfile,4);return{sourceSHA256:sha};});
check('1000-digit independent global impulse-convolution oracle covers tiny/high drag, knots and long post-cutoff age',()=>{
  // Python Decimal sums independent force-interval contributions from their
  // physical release times to observation. It uses no production series,
  // cell-prefix state, stepping implementation, seed generator or cache.
  const witnesses=[];
  for(const k of [0,Number.MIN_VALUE,1e-250,1e-18,1e-9,.000999,.001001,.613125,12,1000])for(const t of [1e-100,1e-8,.013,.167,.61,1.06,1.37,3600])witnesses.push({cells:explicit.cells,k,t,profile:explicit});
  for(const profile of seeded)for(const k of [0,1e-18,.2,8,1000])for(const t of [.033,.725,1.06,2])witnesses.push({cells:profile.cells,k,t,profile});
  const python=String.raw`import sys,json,decimal
from decimal import Decimal as D
decimal.getcontext().prec=1000
data=json.load(sys.stdin); result=[]
for w in data:
 t=D(str(w['t'])); k=D(str(w['k'])); p=[D(0)]*3; v=[D(0)]*3
 for cell in w['cells']:
  lo=D(str(cell['fromAge'])); hi=min(t,D(str(cell['toAge'])))
  if hi<=lo:continue
  h=hi-lo
  if k==0:
   kv=h; kp=((t-lo)**2-(t-hi)**2)/2
  else:
   difference=(-k*(t-hi)).exp()-(-k*(t-lo)).exp()
   kv=difference/k; kp=h/k-difference/(k*k)
  for c in range(3):
   a=D(str(cell['acceleration'][c]));p[c]+=a*kp;v[c]+=a*kv
 result.append({'p':[float(x) for x in p],'v':[float(x) for x in v]})
json.dump(result,sys.stdout)`;
  const result=spawnSync('python',['-c',python],{input:JSON.stringify(witnesses.map(({profile,...rest})=>rest)),encoding:'utf8',maxBuffer:4*1024*1024,timeout:60000});assert.equal(result.status,0,result.stderr);const refs=JSON.parse(result.stdout);let maxRelativeError=0,maxAbsoluteError=0;
  for(let i=0;i<witnesses.length;i++){
    const w=witnesses[i],a=sampleFiniteThrustResponse(w.profile,w.t,w.k),r=refs[i];
    for(const [actual,reference] of [[a.positionDelta,r.p],[a.velocityDelta,r.v]]){
      const scale=Math.max(1e-290,norm(reference));
      for(let c=0;c<3;c++){const error=Math.abs(actual[c]-reference[c]);assert.ok(error<=3e-12*scale+Number.MIN_VALUE*16,`${i},k=${w.k},t=${w.t},c=${c}: ${actual[c]} vs ${reference[c]}`);maxRelativeError=Math.max(maxRelativeError,error/scale);maxAbsoluteError=Math.max(maxAbsoluteError,error);}
    }
  }
  return{witnesses:witnesses.length,decimalDigits:1000,maxRelativeVectorScaledError:maxRelativeError,maxAbsoluteComponentError:maxAbsoluteError,oracle:'global force-interval impulse convolution; Decimal exp, no local-prefix/series/RK helper reuse'};
});
check('Right-hand acceleration, causal prefix independence and autonomous post-cutoff semigroup',()=>{
  let cases=0;const A=createFiniteThrustProfile({id:'prefixA',cells:[{fromAge:0,toAge:.25,acceleration:[2,0,0]},{fromAge:.25,toAge:.75,acceleration:[0,1,0]},{fromAge:.75,toAge:1,acceleration:[0,0,12]}]}),B=createFiniteThrustProfile({id:'prefixB',cells:[{fromAge:0,toAge:.25,acceleration:[2,0,0]},{fromAge:.25,toAge:.75,acceleration:[0,1,0]},{fromAge:.75,toAge:1.06,acceleration:[0,0,-12]}]});
  for(const k of [0,1e-18,.3,1000])for(const t of [0,.25,.6,.749999999999]){assert.deepStrictEqual(sampleFiniteThrustResponse(A,t,k),sampleFiniteThrustResponse(B,t,k));cases++;}
  assert.deepStrictEqual(sampleFiniteThrustAcceleration(A,.25),[0,1,0]);assert.deepStrictEqual(sampleFiniteThrustAcceleration(A,.75),[0,0,12]);assert.deepStrictEqual(sampleFiniteThrustAcceleration(A,1),[0,0,0]);
  for(const k of [0,1e-18,.3,10]){
    const a=sampleFiniteThrustResponse(A,1,k),b=sampleFiniteThrustResponse(A,1.37,k),decay=Math.exp(-k*.37),travel=k>1e-10?-Math.expm1(-k*.37)/k:.37;
    for(let c=0;c<3;c++){assert.ok(Math.abs(b.velocityDelta[c]-a.velocityDelta[c]*decay)<1e-12);assert.ok(Math.abs(b.positionDelta[c]-a.positionDelta[c]-a.velocityDelta[c]*travel)<1e-12);assert.equal(b.motorAcceleration[c],0);assert.ok(b.responseAcceleration[c]===-k*b.velocityDelta[c]);}
    assert.equal(b.motorActive,false);
  }
  assert.equal(sampleFiniteThrustResponse(A,-Number.MAX_VALUE),null);assert.equal(getFiniteThrustMotionBound(A,-1),null);return{pastPrefixQueries:cases,cutoffCarriesVelocity:true,postCutoffOnlyHomogeneousDrag:true};
});
check('All native root IDs and lifetime scales retain bounded correlated seed schedules and conservative response envelopes',()=>{
  let profiles=0,queries=0,maxCells=0,maxHeading=0,maxSpeedRatio=0,maxPositionRatio=0;
  for(const timeScale of [.94,1,1.06])for(let bodyId=0;bodyId<192;bodyId++){
    const p=compileSeededBeeThrust({eventSeed:(Math.imul(bodyId+1,2654435761))>>>0,bodyId,timeScale});profiles++;maxCells=Math.max(maxCells,p.cells.length);assert.ok(p.cells.length<=12&&p.motorEndAge<=1.06&&p.maximumAccelerationMetresPerSecondSquared<=12&&p.integratedAccelerationMagnitudeMetresPerSecond<=12.72);
    let end=0;for(const c of p.cells){assert.equal(c.fromAge,end);assert.ok(c.toAge>c.fromAge);end=c.toAge;}assert.equal(end,timeScale);
    const headings=p.authoring.headingsLocal;for(let i=1;i<headings.length;i++){const angle=Math.acos(Math.min(1,Math.max(-1,headings[i].reduce((s,v,c)=>s+v*headings[i-1][c],0))))*180/Math.PI;maxHeading=Math.max(maxHeading,angle);assert.ok(angle<=22.5+1e-10);}
    for(const k of [0,1e-18,.613125,1000])for(const t of [.01,.4,1.06,8,3600]){
      const a=sampleFiniteThrustResponse(p,t,k),b=getFiniteThrustMotionBound(p,t,k);assert.ok(norm(a.velocityDelta)<=b.maximumVelocityDeltaMetresPerSecond+1e-10);assert.ok(norm(a.positionDelta)<=b.maximumPositionDeltaMetres+1e-9);maxSpeedRatio=Math.max(maxSpeedRatio,norm(a.velocityDelta)/b.maximumVelocityDeltaMetresPerSecond);maxPositionRatio=Math.max(maxPositionRatio,norm(a.positionDelta)/b.maximumPositionDeltaMetres);queries++;
    }
  }
  return{profiles,queries,maxCells,maxHeadingStepDegrees:maxHeading,maxSpeedRatio,maxPositionRatio,numericalEnclosureTolerance:{velocity:1e-10,position:1e-9},limit:'Sample witnesses complement the analytic nonnegative-kernel triangle argument; not a universal floating-point enclosure proof'};
});
check('Accessor, sparse, spoof, field, frame and domain attacks reject without input getter execution',()=>{
  let calls=0,rejected=0;const getter={get id(){calls++;return'x';},cells:[]},v=[0,0,0];Object.defineProperty(v,'1',{get(){calls++;return 0;},enumerable:true});const list=[()=>createFiniteThrustProfile(getter),()=>createFiniteThrustProfile({id:'x',cells:[{fromAge:0,toAge:1,acceleration:v}]}),()=>createFiniteThrustProfile({id:'x',cells:[{fromAge:0,toAge:1,acceleration:[,0,0]}]}),()=>createFiniteThrustProfile({id:'x',cells:[{fromAge:0,toAge:1,acceleration:[0,0,0],extra:0}]}),()=>createFiniteThrustProfile({id:'x',cells:[{fromAge:0,toAge:1.06,acceleration:[12,12,0]}]}),()=>createFiniteThrustProfile({id:'x',cells:[{fromAge:0,toAge:.4,acceleration:[0,0,0]},{fromAge:.4000000000001,toAge:1,acceleration:[0,0,0]}]}),()=>createFiniteThrustProfile({id:'x',cells:new Array(13).fill({fromAge:0,toAge:1,acceleration:[0,0,0]})}),()=>sampleFiniteThrustResponse({...explicit},1),()=>sampleFiniteThrustResponse(explicit,3600.0001),()=>sampleFiniteThrustResponse(explicit,1,1000.0001),()=>sampleFiniteThrustResponse(explicit,-Infinity),()=>sampleFiniteThrustAcceleration(explicit,NaN),()=>getFiniteThrustMotionBound(explicit,Infinity),()=>compileSeededBeeThrust({eventSeed:1,bodyId:1,timeScale:.939999999}),()=>compileSeededBeeThrust({eventSeed:1,bodyId:1,frame:{right:[1,0,0],up:[0,1,0],forward:[0,0,-1]}}),()=>compileSeededBeeThrust({eventSeed:1,bodyId:1,frame:{right:[2,0,0],up:[0,1,0],forward:[0,0,1]}})];
  for(const run of list){assert.throws(run);rejected++;}assert.equal(calls,0);return{rejected,getterCalls:calls};
});
check('Input copies, deeply frozen authoring data, output arrays and repeated drag-cache eviction are independent',()=>{
  const cells=[{fromAge:0,toAge:1,acceleration:[1,2,3]}],p=createFiniteThrustProfile({id:'ownership',cells}),reference=sampleFiniteThrustResponse(p,.7,.4);cells[0].acceleration.fill(0);cells[0].toAge=.5;
  assert.deepStrictEqual(sampleFiniteThrustResponse(p,.7,.4),reference);assert.throws(()=>p.cells[0].acceleration.fill(5));
  const q=seeded[0];assert.throws(()=>q.authoring.headingsLocal[0].fill(0));assert.throws(()=>q.authoring.frame.up.fill(0));
  for(let i=0;i<40;i++){const a=sampleFiniteThrustResponse(p,.7,i*.017);for(const key of ['positionDelta','velocityDelta','motorAcceleration','responseAcceleration'])a[key].fill(1e100);sampleFiniteThrustAcceleration(p,.7).fill(1e100);}
  assert.deepStrictEqual(sampleFiniteThrustResponse(p,.7,.4),reference);const end=sampleFiniteThrustResponse(q,1.4,.2);for(const t of [2,.03,.8,1.4,.7,0])sampleFiniteThrustResponse(q,t,.2);assert.deepStrictEqual(sampleFiniteThrustResponse(q,1.4,.2),end);return{cacheChurnQueries:40,sourceAndAuthoringFrozen:true,outputMutationIsolated:true,reverseReplayExact:true};
});
const report={schema:'glass-atoll.r20-finite-thrust-independent.v1',dateUTC:new Date().toISOString(),sourceSHA256:sha,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,limits:['Pure helper only; not imported into the scene, smoke, renderer, optical sources, bounds or UI by this audit.','Authored acceleration/drag and stepped headings; no measured thrust, mass, fuel, continuous attitude or smooth motor-force envelope.','Independent Decimal oracle uses decimal reconstructions of finite JSON inputs and finite numerical tolerances; it is not exact real arithmetic.']};
fs.writeFileSync(new URL('./r20-finite-thrust-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
