import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createSmokeMergeGraph} from '../pyro-smoke-merge-graph.js';
import {mergePair} from '../pyro-smoke-tick-math.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const protectedPaths=['pyro-smoke-tick-state.js','pyro-smoke-tick-math.js','pyro-smoke-merge-graph.js','pyro-smoke-state.js','fireworks.js','fireworks-audio.js'];
const hashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(read(p))]));
const text=read('pyro-smoke-tick-state.js'),legacy=read('pyro-smoke-state.js');
async function compile(s,key='createPyroSmokeTickState'){
  const code=s.replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));
  return(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')))[key];
}
const create=await compile(text),checks=[];
const check=async(name,fn)=>{try{checks.push({name,passed:true,evidence:await fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[in-memory QA]')});}};
const near=(a,b,tol=2e-12)=>assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} vs ${b}`);
const row=(id,time=0,extra={})=>({time,emissionId:id,sourceId:'s'+id%3,mass:.1+id*.001,mean:[id%4,100+id*.2,id%2],covariance:[2,.1,.03,.1,1,.02,.03,.02,3],temperatureExcessK:id%4*3,buoyantVelocity:id%3*.1,...extra});
const observe=s=>({snapshot:s.snapshot(),diagnostics:s.diagnostics()});
const physical=s=>{const p=s.snapshot();delete p.requestedTime;return p;};
const unchangedAfterReject=(s,fn)=>{const before=observe(s);assert.throws(fn);assert.deepEqual(observe(s),before);};
const failOnce=async(marker,guard)=>{assert.equal(text.split(marker).length,2);return compile(text.replace(marker,`if(globalThis.__r12IndependentFault&&(${guard}))throw Error('independent injected fault');`+marker));};

await check('protected actual legacy and accepted audio/FW source hashes remain frozen',()=>{
  assert.equal(hashes['pyro-smoke-state.js'],'67fa049f11928d23edf7b57798fd899fdbacb8956c3d939a479839642b429172');
  assert.equal(hashes['fireworks.js'],'bb6a0080f34d714379eb860a45f1e595c2d82241fb62cd04dfb4cb2b601b949b');
  assert.equal(hashes['fireworks-audio.js'],'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
  assert(!/pyro-smoke-tick-state|pyro-smoke-merge-graph/.test(read('pyro-smoke.js')));
  return hashes;
});
await check('iterator-bearing indexed mean is either atomically rejected or copied as exactly three finite values',()=>{
  const s=create(),mean=[0,0,0];mean[Symbol.iterator]=function*(){yield 0;yield 0;};
  const before=observe(s);let rejected=false;try{s.queueEmission(row(0,0,{mean}));}catch{rejected=true;assert.deepEqual(observe(s),before);}
  if(!rejected){s.advanceFence(0);assert.deepEqual(s.snapshot().packets[0].mean,[0,0,0]);assert(Number.isFinite(s.sampleMedium([0,0,0]).density));}
  return{iteratorYieldCount:2,declaredLength:3,rejected};
});
await check('iterator-bearing indexed wind is either atomically rejected or copied as exactly three finite values',()=>{
  const s=create(),velocity=[1,2,3];velocity[Symbol.iterator]=function*(){yield 1;yield 2;};
  const before=observe(s);let rejected=false;try{s.setWind({time:0,velocity});}catch{rejected=true;assert.deepEqual(observe(s),before);}
  if(!rejected){s.advanceFence(0);assert.deepEqual(s.snapshot().currentWind,[1,2,3]);}
  return{iteratorYieldCount:2,rejected};
});
await check('iterator-bearing indexed covariance is either atomically rejected or copied as exactly nine finite values',()=>{
  const s=create(),covariance=[1,0,0,0,1,0,0,0,1];covariance[Symbol.iterator]=function*(){yield* [1,0,0,0,1,0,0,0,1,42];};
  const before=observe(s);let rejected=false;try{s.queueEmission(row(0,0,{covariance}));}catch{rejected=true;assert.deepEqual(observe(s),before);}
  if(!rejected){s.advanceFence(0);assert.deepEqual(s.snapshot().packets[0].covariance,[1,0,0,0,1,0,0,0,1]);}
  return{declaredLength:9,iteratorYieldCount:10,rejected};
});
await check('revised indexed contract never reads iterator hooks and captures source/profile getters once',()=>{
  let iteratorReads=0,sourceReads=0,albedoReads=0;
  const indexed=v=>Object.defineProperty(v,Symbol.iterator,{get(){iteratorReads++;throw Error('iterator must not be read');}});
  const profiles={reference:{extinctionPerMassRGB:indexed([1,2,3]),get singleScatteringAlbedo(){albedoReads++;return .9;}}};
  const s=create({profiles,wind:indexed([0,0,0]),diffusivity:indexed([.6,.12,.6])});
  const e=row(0,0,{mean:indexed([0,100,0]),covariance:indexed([1,0,0,0,1,0,0,0,1])});Object.defineProperty(e,'sourceId',{get(){sourceReads++;return 'once';}});
  s.queueEmission(e);s.advanceFence(0);assert.equal(iteratorReads,0);assert.equal(sourceReads,1);assert.equal(albedoReads,1);assert.equal(s.snapshot().packets[0].sourceId,'once');
  const bad={length:3,0:0,1:0,2:NaN};unchangedAfterReject(s,()=>s.queueEmission(row(1,0,{mean:bad})));return{iteratorReads,sourceReads,albedoReads};
});
await check('hostile getters iterators and coercions see old C plus Q and cannot reenter mutators',()=>{
  const s=create();s.queueEmission(row(0,.1));const before=observe(s),seen=[];
  const blocked=label=>{assert.deepEqual(observe(s),before);assert.throws(()=>s.queueEmission(row(99,0)),/in progress/);assert.throws(()=>s.setWind({time:0,velocity:[0,0,0]}),/in progress/);assert.throws(()=>s.advanceTo(0),/in progress/);seen.push(label);};
  for(const key of ['time','emissionId','profileId','sourceId','mass','mean','covariance','temperatureExcessK','buoyantVelocity']){
    const e=row(1,0);Object.defineProperty(e,key,{get(){blocked(key);throw Error('getter-'+key);}});unchangedAfterReject(s,()=>s.queueEmission(e));
  }
  unchangedAfterReject(s,()=>s.queueEmission(row(1,0,{sourceId:{toString(){blocked('toString');throw Error('coercion');}}})));
  const mean=[1,2,3];Object.defineProperty(mean,1,{get(){blocked('indexed-value');throw Error('indexed value failure');}});
  unchangedAfterReject(s,()=>s.queueEmission(row(1,0,{mean})));
  unchangedAfterReject(s,()=>s.setWind({get time(){blocked('wind-time');throw Error('wind getter');},velocity:[1,2,3]}));
  s.queueEmission(row(1,0));assert.equal(s.diagnostics().pendingEmissions,2);return{callbacks:seen};
});
await check('all public snapshots profiles diagnostics failures and query results are detached copies',()=>{
  const profile={extinctionPerMassRGB:[2,3,4],singleScatteringAlbedo:[.1,.2,.3]},wind=[1,0,0],diff=[.6,.1,.4];
  const s=create({capacity:1,profiles:{reference:profile},wind,diffusivity:diff,dispersionModel:'taylor'});
  const e=row(0);e.dispersionQ=.8;s.queueEmission(e);s.queueEmission({...row(1),dispersionQ:.5});s.advanceFence(.1);
  const before=observe(s),density=s.sampleMedium([0,100,0]),column=s.columnOpticalDepth({origin:[0,80,0],direction:[0,1,0],end:50});
  e.mean[0]=999;e.covariance[0]=999;profile.extinctionPerMassRGB[0]=999;profile.singleScatteringAlbedo[0]=999;wind[0]=999;diff[0]=999;
  const copy=s.snapshot();copy.currentWind[0]=999;copy.packets[0].mean[0]=999;copy.packets[0].covariance[0]=999;copy.profiles[0].singleScatteringAlbedoRGB[0]=999;copy.profiles[0].extinctionPerMassRGB[0]=999;copy.dispersion.diffusivity[0]=999;
  const d=s.diagnostics();d.recentMerges[0].sampledOpticalDepthRGBAbsoluteError[0]=999;d.ledger.airborne=999;d.limits[0]='changed';d.dispersion.diffusivity[0]=999;
  const a=s.sampleMedium([0,100,0]);a.extinctionRGB[0]=999;a.scatteringRGB[0]=999;
  const b=s.columnOpticalDepth({origin:[0,80,0],direction:[0,1,0],end:50});b.transmissionRGB[0]=999;b.opticalDepthRGB[0]=999;
  assert.deepEqual(observe(s),before);assert.deepEqual(s.sampleMedium([0,100,0]),density);assert.deepEqual(s.columnOpticalDepth({origin:[0,80,0],direction:[0,1,0],end:50}),column);return{copiedPackets:1,mergedDiagnostics:true};
});
await check('wind at emission time wins before later transport, same-clock replacement is bounded LWW',()=>{
  const s=create({diffusivity:[0,0,0],maxPendingWindEvents:2});s.queueEmission(row(0,.025,{mean:[0,0,0],temperatureExcessK:0,buoyantVelocity:0}));
  s.setWind({time:.025,velocity:[1,0,0]});s.setWind({time:.025,velocity:[3,0,0]});s.setWind({time:.05,velocity:[9,0,0]});
  unchangedAfterReject(s,()=>s.setWind({time:.075,velocity:[8,0,0]}));
  assert.equal(s.snapshot().packets.length,0);assert.deepEqual(s.snapshot().currentWind,[0,0,0]);
  s.advanceFence(.05);near(s.snapshot().packets[0].mean[0],.075);assert.deepEqual(s.snapshot().currentWind,[9,0,0]);
  s.setWind({time:.05+5e-11,velocity:[4,0,0]});assert.deepEqual(s.snapshot().currentWind,[9,0,0]);s.advanceFence(.05);assert.deepEqual(s.snapshot().currentWind,[4,0,0]);
  const before=s.snapshot();s.advanceFence(.05);assert.deepEqual(s.snapshot(),before);s.advanceFence(.1);near(s.snapshot().packets[0].mean[0],.275);return{firstTransport:.075,secondTransport:.275};
});
await check('ordinary numeric transport failure atomically retains tick1 and pending birth, can recover using same-clock wind',()=>{
  const s=create({wind:[1e6,0,0],diffusivity:[0,0,0]});s.queueEmission(row(0,0,{mean:[1e9-75000,0,0],temperatureExcessK:0,buoyantVelocity:0}));s.advanceFence(0);
  s.queueEmission(row(1,.075,{mean:[1e9-75000,0,0],temperatureExcessK:0,buoyantVelocity:0}));
  assert.throws(()=>s.advanceFence(.1),/transported mean.x/);const after=s.snapshot();assert.equal(after.time,.05);assert.equal(after.pendingEmissions,1);assert.equal(after.ledger.emitted,.1);assert.equal(s.diagnostics().lastEmissionId,1);
  assert.deepEqual(s.diagnostics().lastAdvanceFailure,{requestedTime:.1,committedTime:.05,failedCommitEndTime:.1,failedCommitKind:'tick',completedSteps:1,completedSameClockFences:0});
  // The zero-time fence belonged to the preceding advance, not this failed call.
  return{retainedTime:after.time};
});
await check('ordinary numeric failure recovery preserves accepted IDs and material exactly once',()=>{
  const s=create({wind:[1e6,0,0],diffusivity:[0,0,0]});s.queueEmission(row(0,0,{mean:[1e9-75000,0,0],temperatureExcessK:0,buoyantVelocity:0}));s.advanceFence(0);s.queueEmission(row(1,.075,{mean:[1e9-75000,0,0],temperatureExcessK:0,buoyantVelocity:0}));assert.throws(()=>s.advanceFence(.1));
  const d=s.diagnostics();assert.deepEqual(d.lastAdvanceFailure,{requestedTime:.1,committedTime:.05,failedCommitEndTime:.1,failedCommitKind:'tick',completedSteps:1,completedSameClockFences:0});
  const failureCopy=s.diagnostics();failureCopy.lastAdvanceFailure.failedCommitEndTime=123;for(const t of [NaN,Infinity,-1,1e100])unchangedAfterReject(s,()=>s.advanceFence(t));
  s.setWind({time:.05,velocity:[0,0,0]});const result=s.advanceFence(.1);assert.equal(result.fences,1);assert.equal(result.steps,1);assert.equal(s.diagnostics().lastAdvanceFailure,null);near(s.snapshot().ledger.emitted,.201);assert.equal(s.snapshot().pendingEmissions,0);assert.equal(s.diagnostics().lastEmissionId,1);const frozen=s.snapshot();s.advanceTo(.1);assert.deepEqual(s.snapshot(),frozen);return{airborne:s.snapshot().ledger.airborne,sourceIds:s.snapshot().packets.map(p=>p.id)};
});
await check('successful zero-time commit survives later failed tick with exact per-call telemetry',async()=>{
  const inject=await failOnce('committed=s;emissionQueue=nextEmissions;windQueue=nextWind;','advanceTick');const s=inject({capacity:2});s.queueEmission(row(0,0));s.queueEmission(row(1,.01));
  globalThis.__r12IndependentFault=true;try{assert.throws(()=>s.advanceFence(.1),/independent injected/);}finally{delete globalThis.__r12IndependentFault;}
  assert.equal(s.snapshot().time,0);assert.equal(s.snapshot().packets.length,1);assert.equal(s.snapshot().pendingEmissions,1);
  assert.deepEqual(s.diagnostics().lastAdvanceFailure,{requestedTime:.1,committedTime:0,failedCommitEndTime:.05,failedCommitKind:'tick',completedSteps:0,completedSameClockFences:1});
  s.advanceFence(.1);assert.equal(s.snapshot().packets.length,2);near(s.snapshot().ledger.emitted,.201);return{retainedSameClockMass:.1,retryMass:.201};
});
await check('failed late stage after evolution and merge leaves dirty committed kernels observationally unchanged',async()=>{
  const marker='const nextEmissions=emissionQueue.slice(eHead),nextWind=windQueue.slice(wHead);';const inject=await failOnce(marker,'true');
  const s=inject({capacity:2}),control=create({capacity:2});
  for(const t of [s,control]){t.queueEmission(row(0));t.queueEmission(row(1));t.advanceFence(.05);for(let i=2;i<12;i++)t.queueEmission(row(i,.06));}
  const old=physical(s),density=s.sampleMedium([2,102,1]),column=s.columnOpticalDepth({origin:[1,70,0],direction:[0,1,0],end:80});
  globalThis.__r12IndependentFault=true;try{assert.throws(()=>s.advanceFence(.1));}finally{delete globalThis.__r12IndependentFault;}
  assert.deepEqual(physical(s),old);assert.deepEqual(s.sampleMedium([2,102,1]),density);assert.deepEqual(s.columnOpticalDepth({origin:[1,70,0],direction:[0,1,0],end:80}),column);
  s.advanceFence(.1);control.advanceFence(.1);assert.deepEqual(observe(s),observe(control));return{retainedQueue:10,rollbackIncludesCovarianceAndKernels:true};
});

// Independent rebuild-every-merge candidate enumeration from contract section5.
function rebuiltCandidates(packets){
  const groups=new Map(),sources=new Map(),seen=new Set(),candidates=[];
  const group=(map,k,i)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(i);};
  packets.forEach((p,i)=>{group(groups,p.profileId,i);if(p.sourceId!==null)group(sources,JSON.stringify([p.profileId,p.sourceId]),i);});
  const ordered=a=>a.sort((i,j)=>packets[i].mean[0]-packets[j].mean[0]||packets[i].id-packets[j].id);
  const add=(i,j)=>{if(i>j)[i,j]=[j,i];const key=i+','+j;if(seen.has(key))return;seen.add(key);const a=packets[i],b=packets[j],sameSource=a.sourceId!==null&&a.sourceId===b.sourceId;
    const distance2=a.mean.reduce((sum,v,k)=>sum+(v-b.mean[k])**2,0),scale=a.covariance[0]+a.covariance[4]+a.covariance[8]+b.covariance[0]+b.covariance[4]+b.covariance[8];candidates.push({i,j,sameSource,score:distance2/scale});};
  for(const a of sources.values()){ordered(a);for(let k=1;k<a.length;k++)add(a[k-1],a[k]);}
  for(const a of groups.values()){ordered(a);for(let k=0;k<a.length;k++)for(let j=k+1;j<Math.min(a.length,k+5);j++)add(a[k],a[j]);}
  const compare=(a,b)=>a.score-b.score||a.i-b.i||a.j-b.j;
  return[...candidates.filter(c=>c.sameSource).sort(compare).slice(0,8),...candidates.filter(c=>!c.sameSource).sort(compare).slice(0,8)];
}
await check('graph every selected edge equals independent full rebuild through ties negative IDs mixed profiles and null sources',()=>{
  let merges=0,selections=0,rebuildConstrained=0;let rngState=88471;const random=()=>((rngState=(Math.imul(rngState,1664525)+1013904223)>>>0)/4294967296);
  for(let run=0;run<180;run++){
    const n=10+Math.floor(random()*30),profiles=1+run%3;let packets=Array.from({length:n},(_,i)=>({id:i,profileId:'p'+i%profiles,sourceId:i%7===0?null:'s'+Math.floor(random()*5),mass:.01+random(),mean:run%4===0?[0,0,0]:[Math.floor(random()*6),Math.floor(random()*3),Math.floor(random()*4)],covariance:[10**(-3+random()*6),0,0,0,10**(-3+random()*6),0,0,0,10**(-3+random()*6)],birthTime:0,temperatureExcessK:random()*100,buoyantVelocity:random(),sourceCount:1,_dirty:true}));
    const graph=createSmokeMergeGraph(packets);
    while(packets.length>profiles){
      const actual=graph.select(),expected=rebuiltCandidates(packets);assert.deepEqual(actual.map(({i,j,sameSource,score})=>({i,j,sameSource,score})),expected);selections+=actual.length;
      if(!actual.length)break;const choice=actual[Math.floor(random()*actual.length)],merged=mergePair(packets[choice.i],packets[choice.j],-(++merges));
      packets.splice(choice.j,1);packets.splice(choice.i,1,merged);graph.merged(choice.nodeA,choice.nodeB,merged);
      const d=graph.diagnostics();assert.equal(d.live,packets.length);assert(d.heapEntries<=d.edges*4+64);if(d.heapEntries>d.edges*2)rebuildConstrained++;
    }
  }
  return{runs:180,merges,selections,rebuildConstrained};
});
await check('valid bounded profile/source identifiers containing NUL preserve tuple source grouping',()=>{
  // Same profile has two far-apart endpoints of the same source. Interleaved
  // different-profile nodes must not erase their source-adjacent edge.
  const packets=[];for(let i=0;i<14;i++){const variance=i%2?1e-12:1;packets.push({id:i,profileId:i%2?'a\0b':'a',sourceId:i%2?'c':i===0||i===12?'b\0c':'other'+i,mass:1,mean:[i,0,0],covariance:[variance,0,0,0,variance,0,0,0,variance],birthTime:0,temperatureExcessK:0,buoyantVelocity:0,sourceCount:1,_dirty:true});}
  const actual=createSmokeMergeGraph(packets).select().map(({i,j,sameSource,score})=>({i,j,sameSource,score}));assert.deepEqual(actual,rebuiltCandidates(packets));return{tuples:14};
});

function batchOracleSource(){let s=legacy;for(const [from,to]of[
  ['packets.push(p);try{compact();}catch(error){packets.pop();throw error;}','packets.push(p);'],
  ['}evolve(at,end);tick++;steps++;','}evolve(at,end);compact();tick++;steps++;'],
  ['let steps=0;\n      while(tick<goal','let steps=0;compact();\n      while(tick<goal']
]){assert.equal(s.split(from).length,2);s=s.replace(from,to);}return s;}
const batch=await compile(batchOracleSource(),'createPyroSmokeState');
await check('same explicit fence protocol matches frozen67fa naive batch under future out-of-ID-time births and variable wind',()=>{
  let count=0;for(const dispersionModel of ['brownian','taylor'])for(const origin of [0,4000])for(const capacity of [2,5,11]){
    const opts={time:origin,capacity,dispersionModel,profiles:{reference:{},second:{extinctionPerMassRGB:[.2,3,.5]}}},a=create(opts),b=batch(opts);
    for(let turn=0;turn<4;turn++){
      for(let j=0;j<15;j++){const id=turn*15+j,at=origin+turn*.05+.001+(14-j)*.003,e=row(id,at,{profileId:id%3?'reference':'second',mean:[id%5,100+id%4,id%2]});if(dispersionModel==='taylor')e.dispersionQ=(id%4)/3;for(const s of[a,b])s.queueEmission(e);}
      for(const s of[a,b]){s.setWind({time:origin+turn*.05+.02,velocity:[turn%2?-.7:.4,.01,-.3]});s.advanceTo(origin+(turn+1)*.05);}
      const sa=a.snapshot();delete sa.stateModel;assert.deepEqual(sa,b.snapshot());
    }
    for(const x of [[0,100,0],[2,103,1]])assert.deepEqual(a.sampleMedium(x),b.sampleMedium(x));assert.deepEqual(a.columnOpticalDepth({origin:[2,90,0],direction:[0,1,0],end:30}),b.columnOpticalDepth({origin:[2,90,0],direction:[0,1,0],end:30}));count++;
  }
  return{cases:count,origins:[0,4000],sameFenceProtocol:true};
});
await check('actual G4 accepted-prefix before and after-accept faults clear all pending matter and IDs remain monotonic',async()=>{
  const THREE=await import('../vendor/three.module.js'),{createFireworks}=await import('../fireworks.js'),{createPyroSmokeLogicalEvents}=await import('../pyro-smoke-logical-events.js');let cases=0;
  for(const acceptedThenThrow of [false,true]){
    const f=createFireworks(THREE,{seed:14271});f.update({time:0,windVector:[0,0,0]});f.launch({type:'palm',seed:42});f.update({time:.3,windVector:[0,0,0]});
    const s=create(),adapter=createPyroSmokeLogicalEvents({state:s,sourceProvider:f.smokeSourceProvider}),queue=s.queueEmission;let calls=0;
    s.queueEmission=e=>{calls++;if(calls===4&&!acceptedThenThrow)throw Error('independent beforeaccept');const result=queue(e);if(calls===4&&acceptedThenThrow)throw Error('independent afteraccept');return result;};
    try{assert.throws(()=>adapter.consume(f.drainEvents(),{throughTime:.3,windVector:[0,0,0]}),/independent/);const d=adapter.diagnostics(),accepted=acceptedThenThrow?4:3;assert.equal(d.fault.acceptedPackets,accepted);assert.equal(s.diagnostics().pendingEmissions,accepted);near(d.materializedArea,s.diagnostics().ledger.pendingMass);near(d.accountingResidual,0);assert.equal(d.nextEmissionId,accepted);
      const next=create({time:.3});adapter.clearForState(next,{time:.3});const cleared=adapter.diagnostics();assert.equal(cleared.nextEmissionId,accepted);assert.equal(cleared.fault,null);assert(cleared.cancelledReservedArea>0);near(cleared.accountingResidual,0);
      f.launch({type:'fan',seed:71});f.update({time:.6,windVector:[0,0,0]});adapter.consume(f.drainEvents(),{throughTime:.6,windVector:[0,0,0]});assert(next.diagnostics().lastEmissionId>=accepted);next.advanceFence(.6);assert(next.snapshot().packets.length>0);near(adapter.diagnostics().accountingResidual,0);cases++;
    }finally{adapter.dispose();f.dispose();}
  }
  return{cases,coverage:'actual palm prefix then ground fan, clear at source causal watermark, no host/renderer'};
});
await check('actual G4 crossette includes parent and child matter and ground bouquet closes its source budget',async()=>{
  const THREE=await import('../vendor/three.module.js'),{createFireworks}=await import('../fireworks.js'),{createPyroSmokeLogicalEvents}=await import('../pyro-smoke-logical-events.js'),evidence=[];
  for(const type of ['crossette','bouquet']){
    const f=createFireworks(THREE);f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type,seed:71}),g=f.smokeSourceProvider.describeCombustion(launch.id),end=Math.max(...g.nodes.map(n=>n.endTime))+.31;
    f.update({time:end,windVector:[0,0,0]});const s=create({capacity:65536}),adapter=createPyroSmokeLogicalEvents({state:s,sourceProvider:f.smokeSourceProvider});
    try{adapter.consume(f.drainEvents(),{throughTime:end,windVector:[0,0,0]});const before=s.snapshot();assert.equal(before.packets.length,0);assert(before.pendingEmissions>0);near(adapter.diagnostics().materializedArea,before.ledger.pendingMass);s.advanceFence(end);const d=adapter.diagnostics();near(d.accountingResidual,0);near(d.reservedArea,0);assert.equal(d.completedCoverage.length,1);assert.equal(d.completedCoverage[0].materializedBodies,d.completedCoverage[0].bodyCount);
      const children=g.nodes.filter(n=>n.role==='aerial-child').length;if(type==='crossette')assert.equal(children,144);else assert.equal(children,0);near(s.snapshot().ledger.emitted,type==='crossette'?20.35:2);evidence.push({type,children,bodies:d.completedCoverage[0].bodyCount,emissions:s.diagnostics().acceptedSources,mass:s.snapshot().ledger.emitted});
    }finally{adapter.dispose();f.dispose();}
  }
  return evidence;
});
await check('all captured production/legacy/audio/FW sources remain byte-identical throughout independent audit',()=>{for(const p of protectedPaths)assert.equal(hash(read(p)),hashes[p],p);return hashes;});
const report={schema:'glass-atoll.r12-tick-independent-audit.v1',dateUTC:new Date().toISOString(),actualGPU:false,hostIntegrated:false,sourceFreeze:hashes,
  counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},passed:checks.every(c=>c.passed),checks,
  limits:['Independent contract-focused additional tests; not all native6291 cells or a fresh GPU/performance acceptance run.','Frozen67fa naive oracle is only compared after identical explicit fences; its immediate pre-fence density is not used as the candidate contract.','Production fault probes are compiled in memory; no production callback or source edits.','Malformed iterable and NUL-identifier tests exercise inputs accepted by current declared bounded numeric/string domains, not the normal native source output.']};
fs.writeFileSync(new URL('r12-tick-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,passed:report.passed,checks:checks.map(c=>({name:c.name,passed:c.passed,evidence:c.evidence,error:c.error}))},null,2));
if(!report.passed)process.exitCode=1;
