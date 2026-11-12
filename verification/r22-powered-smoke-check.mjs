// CPU-only routing, common-end quadrature and reservation acceptance. No GL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createPyroSmokeTrajectoryEvents} from '../pyro-smoke-trajectory-events.js';
import {createPyroSmokeLogicalEvents} from '../pyro-smoke-logical-events.js';
import {pastSegmentSourceMoments,pastPiecewiseSegmentSourceMoments,SMOKE_SOURCE_TRANSPORT,createSourceWindHistory,appendSourceWindHistory,sourceThermalAge} from '../pyro-smoke-source-moments.js';
import {makePoweredBeesSmokeEntry,parsePoweredSmokeMotionProfile} from '../pyro-smoke-powered-bees.js';
const checks=[],metrics={},near=(a,b,t=1e-9)=>assert(Math.abs(a-b)<=t,`${a} vs ${b}`),check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}};
const root=new URL('../',import.meta.url),zero={...SMOKE_SOURCE_TRANSPORT,diffusivity:[0,0,0],temperatureExcessK:0,buoyantVelocity:0};
const windHistory=(end=20,wind=[0,0,0])=>appendSourceWindHistory(createSourceWindHistory({time:0,wind}),{time:end,windVector:wind,retainFrom:0});
check('no interior force knot preserves the old five-node value exactly',()=>{
  const args={start:1,end:1.3,mass:.7,samplePosition:t=>[t*t,80-t,4*t],windHistory:windHistory(2,[2,0,1])};
  assert.deepEqual(pastPiecewiseSegmentSourceMoments(args),pastSegmentSourceMoments(args));
});
check('all split nodes age to original deposit time and carry duration material weights',()=>{
  const start=.1,end=.4,depositTime=.5,W=[3,.2,-2],times=[],model={...zero,diffusivity:[.6,.12,.6]},m=pastPiecewiseSegmentSourceMoments({start,end,depositTime,integrationBreaks:[.12,.19,.29],mass:2.4,samplePosition:t=>{times.push(t);return[0,0,0];},windHistory:windHistory(1,W),transport:model});
  const averageAge=depositTime-(start+end)/2;
  for(let c=0;c<3;c++)near(m.mean[c],W[c]*averageAge,2e-15);
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)near(m.covariance[r*3+c],W[r]*W[c]*(end-start)**2/12+(r===c?.09+2*model.diffusivity[r]*averageAge:0),3e-15);
  assert.equal(m.mass,2.4);assert.equal(times.length,20);assert(times.every(t=>t>start&&t<end));assert.equal(m.diagnostics.depositTime,depositTime);near(m.diagnostics.normalizedWeightSum,1,1e-15);
  return{nodes:20,onePacket:true,mean:m.mean,covariance:m.covariance};
});
check('acute piecewise acceleration retains parallel-axis covariance and native cooling',()=>{
  const a=.02,b=.3,knots=[.047,.096,.175,.264],curve=t=>{const responses=knots.map(k=>Math.max(0,t-k)**2/2);return[20*t+responses.reduce((s,v,i)=>s+[100,-240,300,-150][i]*v,0),70+3*t-4.905*t*t,-2*t+responses.reduce((s,v,i)=>s+[80,160,-120,60][i]*v,0)];};
  const m=pastPiecewiseSegmentSourceMoments({start:a,end:b,mass:1,samplePosition:curve,windHistory:windHistory(1,[2,.1,-1]),integrationBreaks:knots}),samples=[],N=16384;
  for(let i=0;i<=N;i++){const t=a+(b-a)*i/N,age=b-t,thermal=sourceThermalAge(age),raw=curve(t),p=raw.map((v,c)=>v+[2,.1,-1][c]*age+(c===1?thermal.rise:0));samples.push({weight:(i===0||i===N?1:i%2?4:2)/(3*N),p,thermal,age});}
  const mean=[0,1,2].map(c=>samples.reduce((s,n)=>s+n.weight*n.p[c],0)),cov=Array.from({length:9},(_,j)=>samples.reduce((s,n)=>{const r=Math.floor(j/3),c=j%3;return s+n.weight*((n.p[r]-mean[r])*(n.p[c]-mean[c])+(r===c?.09+2*SMOKE_SOURCE_TRANSPORT.diffusivity[r]*n.age:0));},0));
  let error=0;for(let i=0;i<3;i++)error=Math.max(error,Math.abs(m.mean[i]-mean[i]));for(let i=0;i<9;i++)error=Math.max(error,Math.abs(m.covariance[i]-cov[i]));assert(error<1e-9);near(m.temperatureExcessK,samples.reduce((s,n)=>s+n.weight*n.thermal.temperatureExcessK,0),1e-10);assert(Math.abs(m.covariance[2])>.1);
  metrics.quadratureDenseMaximumError=error;return{denseSamples:N+1,splitNodes:m.diagnostics.quadratureNodes,maximumError:error};
});
check('invalid or unrepresentable force cells reject before any provider read',()=>{
  let reads=0;const args={start:0,end:.3,mass:1,samplePosition:()=>{reads++;return[0,0,0];},windHistory:windHistory(1)};
  for(const patch of [{integrationBreaks:[.2,.1]},{integrationBreaks:[0]},{integrationBreaks:[.3]},{integrationBreaks:[NaN]},{integrationBreaks:Array(13).fill(.1)},{depositTime:.29},{depositTime:2},{integrationBreaks:[Number.MIN_VALUE]}])assert.throws(()=>pastPiecewiseSegmentSourceMoments({...args,...patch}));
  assert.equal(reads,0);
});

function fixture({id='candidate-1',type='chrysanthemum',powered=true,invalidMotor=false,lifeScale=1}={}){
  const launchTime=0,burstTime=1,endTime=10,sourceEvents=[{kind:'launch',time:0,seed:12},{kind:'burst',time:1,seed:13}],motion={schema:'glass-atoll.finite-thrust-profile.v1',id:'fixture-motor',motorEndAge:1,forceKnotAges:[0,.08,.17,.26,.35,.45,.57,.7,.85,1]};
  const roots=Array.from({length:192},(_,i)=>({id:i,birth:1,life:(i<32?2.2:4.2+(i%8)*.1)*lifeScale,baseVelocity:[Math.cos(i)*24,Math.sin(i)*24,i%7-3],patternPart:null,...(powered&&i<32?{motionProfile:parsePoweredSmokeMotionProfile(invalidMotor&&i===0?{...motion,forceKnotAges:[0,.2,.1,1]}:motion,2.2*lifeScale)}:{})}));
  const d={schema:'glass-atoll.smoke-kinematic-descriptor.v1',id,type,seed:11,ground:false,time:0,burstTime,endTime,baselineVelocity:[0,0,0],roots,sourceEvents,...(powered?{effectProfile:'powered-bees-v1'}:{})};
  const node=(sourceID,role,birth,life,more={})=>({sourceID,eventId:id,role,birth,life,endTime:birth+life,parentSourceID:null,bodyId:null,parentBodyId:null,familyID:null,...more});
  const g={schema:'glass-atoll.combustion-metadata.v1',id,type,seed:11,ground:false,launchTime,burstTime,endTime,nodes:[node('lift','lift',0,0,{sourceEventKind:'launch',sourceEventSeed:12}),node('carrier','mortar-carrier',0,1,{parentSourceID:'lift'}),node('burst','burst',1,0,{parentSourceID:'carrier',sourceEventKind:'burst',sourceEventSeed:13}),...roots.map(r=>node('root-'+r.id,'aerial-root',r.birth,r.life,{parentSourceID:'burst',bodyId:r.id,familyID:'family-'+r.id}))]};
  const calls=[],released=[],point=(bodyId,t)=>{const age=t-1,turn=bodyId<32?Math.max(0,age-.17)**2*.5:0;return[Math.cos(bodyId)*age*20+turn*5,70+Math.sin(bodyId)*age*20-4.905*age*age,Math.sin(bodyId)*age*20-turn*3];};
  const p={time:0,describe:()=>d,describeCombustion:()=>g,release:eventId=>released.push(eventId),sample(eventId,{kind,eventKind,time,bodyId}){assert(time<=p.time);if(kind==='root'){assert(time>=1&&time<1+roots[bodyId].life);return{eventId,time,position:point(bodyId,time)};}return{eventId,time,position:eventKind==='launch'?[0,0,0]:[0,70,0]};},sampleBody(eventId,{bodyId,time}){assert(time<=p.time&&time>=1&&time<1+roots[bodyId].life);calls.push({bodyId,time});return{eventId,bodyId,time,position:point(bodyId,time)};}};
  const events=sourceEvents.map(e=>({...e,eventId:id,type,position:e.kind==='launch'?[0,0,0]:[0,70,0]}));
  return{d,g,p,calls,released,events};
}
function harness(f=fixture(),options={}){
  let state=createPyroSmokeState({capacity:65536,maxPendingEmissions:8192});const log=[];
  const wrapped={snapshot:()=>state.snapshot(),diagnostics:()=>state.diagnostics(),queueEmission(e){log.push(structuredClone(e));return state.queueEmission(e);}};
  const adapter=createPyroSmokeTrajectoryEvents({state:wrapped,sourceProvider:f.p,...options});
  return{...f,log,wrapped,adapter,get state(){return state;},replace(value){state=value;},step(t,events=[],wind=[0,0,0]){f.p.time=t;const result=adapter.consume(events,{throughTime:t,windVector:wind});state.setWind({time:t,velocity:wind});state.advanceTo(t);return result;}};
}
function fullRun(hz=30,options={}){const x=harness(fixture(),options),end=Math.max(...x.d.roots.map(r=>r.birth+r.life))+.1,times=new Set([0,1,end]);for(let n=1;n/hz<end;n++)times.add(n/hz);for(const t of [...times].sort((a,b)=>a-b))x.step(t,t===0?[x.events[0]]:t===1?[x.events[1]]:[],t<1.6?[0,0,0]:t<2.6?[1.5,0,-.2]:[-.3,0,.4]);return x;}
check('candidate reserves all 192 logical families and samples every one of 32 motors',()=>{
  const begin=performance.now(),x=fullRun(),d=x.adapter.diagnostics(),ids=new Set(x.calls.map(q=>q.bodyId)),c=d.poweredSmoke.completedCoverage[0];
  assert.equal(ids.size,192);assert.equal(c.materializedBodies,192);assert.equal(c.materializedMotorBodies,32);assert.deepEqual(c.motorBodyIds,Array.from({length:32},(_,i)=>i));near(d.allocatedArea,20.35);near(d.materializedArea,20.35);near(d.accountingResidual,0);assert.equal(d.pendingPlans,0);assert.equal(d.reservedArea,0);assert.equal(x.released.length,1);assert.equal(new Set(x.log.map(e=>e.emissionId)).size,x.log.length);assert(x.log.filter(e=>e.kernelDiagnostics?.integrationBreaks?.length).every(e=>e.kernelDiagnostics.depositTime===e.time));
  const plans=makePoweredBeesSmokeEntry({...x.d,roots:x.d.roots.map(r=>({...r}))},0,{burstArea:20,launchArea:.35},.2,x.g);assert.equal(x.log.length,plans.plans.length);assert.equal(x.state.snapshot().packets.length,x.log.length);near(x.state.snapshot().ledger.airborne,20.35,3e-10);
  metrics.synthetic={packets:x.log.length,queries:x.calls.length,cpuWallMilliseconds:performance.now()-begin};return metrics.synthetic;
});
check('30/60/120 schedules preserve cell clocks IDs material and moments across held wind',()=>{
  const a=fullRun(30),b=fullRun(60),c=fullRun(120);let error=0;
  for(const x of [b,c]){assert.equal(x.log.length,a.log.length);for(let i=0;i<x.log.length;i++){for(const k of ['emissionId','time','sourceId','mass'])assert.equal(x.log[i][k],a.log[i][k]);for(const k of ['mean','covariance'])for(let j=0;j<a.log[i][k].length;j++)error=Math.max(error,Math.abs(x.log[i][k][j]-a.log[i][k][j]));}}
  assert(error<1e-10);return{maximumMomentDifference:error};
});
check('clear cancels reservation atomically preserves IDs and prevents late burst revival',()=>{
  const x=harness();x.step(0,[x.events[0]]);x.step(.3);const before=x.adapter.diagnostics(),physical=x.state.snapshot().ledger.airborne,next=before.nextEmissionId,fresh=createPyroSmokeState({time:.3,capacity:65536});x.adapter.clearForState(fresh,{time:.3});x.replace(fresh);x.step(1,[x.events[1]]);const d=x.adapter.diagnostics();near(d.cancelledReservedArea,20.35-physical);near(d.accountingResidual,0);assert.equal(d.nextEmissionId,next);assert.equal(d.pendingPlans,0);assert.equal(x.state.snapshot().packets.length,0);assert.equal(d.staleEvents,1);
});
check('duplicate launch is idempotent and stale prepared tokens cannot submit twice',()=>{
  const x=harness();x.p.time=0;const token=x.adapter.prepare([x.events[0]],{throughTime:0,windVector:[0,0,0]});assert.equal(x.log.length,0);x.adapter.commit(token);assert.throws(()=>x.adapter.commit(token),/Stale/);x.step(0,[x.events[0]]);assert.equal(x.log.length,1);near(x.adapter.diagnostics().allocatedArea,20.35);assert.equal(x.adapter.diagnostics().duplicates,1);
});
check('complete-event and ready-queue capacity rejection causes no IDs reservations or body reads',()=>{
  for(const options of [{maxPendingPoweredPlans:100},{queueCapacity:1}]){
    const x=harness(fixture(),options),before=x.adapter.diagnostics(),s=x.state.snapshot(),t=options.queueCapacity?.3:0;x.p.time=t;
    assert.throws(()=>x.adapter.consume([x.events[0]],{throughTime:t,windVector:[0,0,0]}),/capacity/);assert.deepEqual(x.adapter.diagnostics(),before);assert.deepEqual(x.state.snapshot(),s);assert.equal(x.calls.length,0);assert.equal(x.log.length,0);
  }
});
check('candidate body identity and physical-domain failures are precommit atomic',()=>{
  for(const bad of [()=>({eventId:'wrong',time:1.1,position:[0,0,0]}),(id,o)=>({eventId:id,...o,position:[1e9,1e9,1e9]})]){
    const x=harness();x.step(0,[x.events[0]]);x.p.sampleBody=bad;x.p.time=1.3;const d=x.adapter.diagnostics(),s=x.state.snapshot(),n=x.log.length;
    assert.throws(()=>x.adapter.consume([x.events[1]],{throughTime:1.3,windVector:[1000,0,0]}));assert.deepEqual(x.adapter.diagnostics(),d);assert.deepEqual(x.state.snapshot(),s);assert.equal(x.log.length,n);
  }
});
check('invalid motor/graph metadata rejects complete launch without changes',()=>{
  for(const mutate of [f=>{f.d.roots[0].motionProfile={...f.d.roots[0].motionProfile,forceKnotAges:[0,.7,.4,1]};},f=>{f.g.nodes.at(-1).life+=.1;},f=>{delete f.d.roots[0].motionProfile;},f=>{f.g.nodes.at(-1).bodyId=0;}]){
    const f=fixture();mutate(f);const x=harness(f),before=x.adapter.diagnostics();assert.throws(()=>x.step(0,[x.events[0]]));assert.equal(x.log.length,0);assert.equal(x.calls.length,0);assert.deepEqual(x.adapter.diagnostics(),before);
  }
});
check('unexpected queue failure discloses accepted prefix and requires explicit clear',()=>{
  const f=fixture(),state=createPyroSmokeState(),original=state.queueEmission;let writes=0;state.queueEmission=e=>{if(++writes===3)throw Error('injected queue failure');return original(e);};const a=createPyroSmokeTrajectoryEvents({state,sourceProvider:f.p});f.p.time=.3;
  assert.throws(()=>a.consume([f.events[0]],{throughTime:.3,windVector:[0,0,0]}),/injected/);const d=a.diagnostics();assert.equal(d.fault.acceptedPackets,2);assert.equal(d.fault.notRolledBack,true);near(d.allocatedArea,d.materializedArea+d.reservedArea);assert.throws(()=>a.consume([],{throughTime:.3,windVector:[0,0,0]}),/fault-locked/);a.clearForState(createPyroSmokeState({time:.3}),{time:.3});assert.equal(a.diagnostics().fault,null);
});
check('hidden point history does not enforce new wind input rules on ordinary callers',()=>{
  const x=harness(fixture({powered:false}));x.p.time=0;x.adapter.consume([x.events[0]],{throughTime:0,windVector:[NaN,0,0]});assert.equal(x.log.length,1);assert(!x.adapter.diagnostics().poweredSmoke);assert(!('windHistory' in x.adapter.diagnostics()));
});
check('mixed powered/ordinary events share one globally unique scheduler and independent reservation caps',()=>{
  const a=fixture({id:'powered'}),b=fixture({id:'ordinary',powered:false,type:'peony'}),byID=new Map([[a.d.id,a],[b.d.id,b]]),state=createPyroSmokeState({capacity:65536}),log=[];
  const p={time:0,describe:id=>byID.get(id).p.describe(id),describeCombustion:id=>byID.get(id).p.describeCombustion(id),sample:(id,o)=>byID.get(id).p.sample(id,o),sampleBody:(id,o)=>byID.get(id).p.sampleBody(id,o),release:id=>byID.get(id).p.release(id)},wrapped={snapshot:()=>state.snapshot(),diagnostics:()=>state.diagnostics(),queueEmission(e){log.push(structuredClone(e));return state.queueEmission(e);}},adapter=createPyroSmokeTrajectoryEvents({state:wrapped,sourceProvider:p,maxPendingPlans:24});
  for(let i=0;i<=180;i++){const t=i/30;p.time=t;a.p.time=t;b.p.time=t;adapter.consume(t===0?[a.events[0],b.events[0]]:t===1?[a.events[1],b.events[1]]:[],{throughTime:t,windVector:[0,0,0]});state.advanceTo(t);}
  const d=adapter.diagnostics();assert.equal(d.registeredEvents,2);assert.equal(d.poweredSmoke.registeredEvents,1);assert.equal(new Set(log.map(e=>e.emissionId)).size,log.length);for(let i=0;i<log.length;i++)assert.equal(log[i].emissionId,i);near(d.allocatedArea,40.7);near(d.materializedArea,40.7);near(d.accountingResidual,0);assert.equal(d.pendingPlans,0);assert.equal(b.calls.length,0);assert.equal(new Set(a.calls.map(c=>c.bodyId)).size,192);return{packets:log.length,totalReferenceMaterial:d.materializedArea};
});
check('candidate wind history retains the full earliest uncommitted cell and commits/prunes atomically',()=>{
  const x=harness();x.step(0,[x.events[0]]);x.step(1,[x.events[1]]);for(let i=1;i<40;i++)x.step(1+i/120,[],[i*.01,0,-i*.003]);
  const before=x.adapter.diagnostics(),old=x.p.sampleBody;x.p.time=1.6;x.p.sampleBody=()=>{throw Error('injected causal read');};assert.throws(()=>x.adapter.prepare([],{throughTime:1.6,windVector:[.4,0,-.12]}),/injected causal/);assert.deepEqual(x.adapter.diagnostics(),before);x.p.sampleBody=old;x.step(1.6,[],[.4,0,-.12]);const h=x.adapter.diagnostics().poweredSmoke.windHistory;assert(h.oldestTime<=1.3);assert.equal(h.throughTime,1.6);assert(h.samples>1);x.step(6,[],[.4,0,-.12]);x.step(7,[],[.4,0,-.12]);assert.equal(x.adapter.diagnostics().poweredSmoke.windHistory.samples,1);
});
check('explicit logical-all host uses the same candidate-only force quadrature and material clocks',()=>{
  const a=fullRun(60),f=fixture(),state=createPyroSmokeState({capacity:65536}),log=[],wrapped={snapshot:()=>state.snapshot(),diagnostics:()=>state.diagnostics(),queueEmission(e){log.push(structuredClone(e));return state.queueEmission(e);}},adapter=createPyroSmokeLogicalEvents({state:wrapped,sourceProvider:f.p});
  const end=Math.max(...f.d.roots.map(r=>r.birth+r.life))+.1,times=new Set([0,1,end]);for(let n=1;n/60<end;n++)times.add(n/60);
  for(const t of [...times].sort((a,b)=>a-b)){const wind=t<1.6?[0,0,0]:t<2.6?[1.5,0,-.2]:[-.3,0,.4];f.p.time=t;adapter.consume(t===0?[f.events[0]]:t===1?[f.events[1]]:[],{throughTime:t,windVector:wind});state.setWind({time:t,velocity:wind});state.advanceTo(t);}
  assert.equal(log.length,a.log.length);for(let i=0;i<log.length;i++)for(const field of ['emissionId','time','mass','mean','covariance','temperatureExcessK','buoyantVelocity','kernelDiagnostics'])assert.deepEqual(log[i][field],a.log[i][field]);assert.equal(new Set(f.calls.map(c=>c.bodyId)).size,192);near(adapter.diagnostics().materializedArea,20.35);return{packets:log.length,bodyQueries:f.calls.length,exactCommonEndMoments:true};
});
check('disposed powered adapter releases reservation and still reports diagnostics safely',()=>{
  const x=harness();x.step(0,[x.events[0]]);x.adapter.dispose();const d=x.adapter.diagnostics();assert.equal(d.poweredSmoke.windHistory,null);assert.equal(d.pendingPlans,0);near(d.accountingResidual,0);assert.equal(x.released.length,1);assert.throws(()=>x.step(0),/disposed/);
});

const report={schema:'glass-atoll.r22-powered-smoke-cpu.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,metrics,limits:['Synthetic physical paths validate routing/atomicity; native powered integration has a separate actual-provider acceptance.','Uniform per-life authored material only; normalized bee CDF is not the production scheduler.','One common-end Gaussian per original source cell approximates acute-turn or multimodal geometry.','CPU work only, no browser/GPU/frame-rate or optical appearance claim.']};
fs.writeFileSync(new URL('./r22-powered-smoke-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,metrics,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
