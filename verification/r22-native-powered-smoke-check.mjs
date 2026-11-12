// Actual producer/provider -> unique smoke scheduler -> physical state. CPU only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import * as THREE from '../vendor/three.module.js';
import {sampleBody} from '../fireworks-physics.js';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createPyroSmokeTrajectoryEvents} from '../pyro-smoke-trajectory-events.js';
import {buildLogicalBurnProfile} from '../pyro-smoke-logical-burn.js';
const root=new URL('../',import.meta.url),source=fs.readFileSync(new URL('../fireworks.js',import.meta.url),'utf8'),needle='api.configure({});return api;';assert.equal(source.split(needle).length,2);
const code=source.replace(needle,'api.configure({});Object.defineProperty(api,"__qaSimulation",{value:simulation});return api;').replaceAll(/from '\.\/([^']+)'/g,(_,file)=>'from '+JSON.stringify(new URL(file,root).href)),factory=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).createFireworks;
const checks=[],metrics={},near=(a,b,t=1e-9)=>assert(Math.abs(a-b)<t,`${a} vs ${b}`),check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}};
function run({gain=1,hz=60,powered=true,clearAt=null}={}){
  const f=factory(THREE);f.configure({autoLaunch:false,autoDirection:false,azimuth:104,elevation:80});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:'chrysanthemum',seed:9324,intensityScale:gain,starDragModel:'bounded-descent',...(powered?{effectProfile:'powered-bees-v1'}:{})}),native=f.__qaSimulation.active.find(e=>e.id===launch.id),raw=f.smokeSourceProvider,queries=[],released=[],logs=[],costs=[];
  const provider={get time(){return raw.time;},describe:id=>raw.describe(id),describeCombustion:id=>raw.describeCombustion(id),sample:(id,o)=>raw.sample(id,o),release(id){released.push(id);return raw.release(id);},sampleBody(id,o){const result=raw.sampleBody(id,o),body=native.heads.find(b=>b.id===o.bodyId),oracle=sampleBody(body,o.time,f.__qaSimulation.windTimeline);assert(o.time<=raw.time);assert.deepEqual(result.position,oracle.position);queries.push({bodyId:o.bodyId,time:o.time,motor:!!body.thrustProfile});return result;}};
  const descriptor=provider.describe(launch.id),graph=provider.describeCombustion(launch.id);
  if(powered){assert.equal(descriptor.effectProfile,'powered-bees-v1');assert.equal(descriptor.roots.length,192);const motors=descriptor.roots.filter(r=>r.motionProfile);assert.equal(motors.length,32);for(const r of motors){assert(Object.isFrozen(r.motionProfile)&&Object.isFrozen(r.motionProfile.forceKnotAges));assert.deepEqual(r.motionProfile.forceKnotAges,[0,...native.heads.find(b=>b.id===r.id).thrustProfile.cells.map(c=>c.toAge)]);}}
  let state=createPyroSmokeState({capacity:4096,maxPendingEmissions:8192}),adapter,explicitlyCleared=0;const wrapped={snapshot:()=>state.snapshot(),diagnostics:()=>state.diagnostics(),queueEmission(e){logs.push(structuredClone(e));return state.queueEmission(e);}};
  adapter=createPyroSmokeTrajectoryEvents({state:wrapped,sourceProvider:provider});
  const end=Math.max(...graph.nodes.map(n=>n.endTime))+.2,times=new Set([0,end,launch.burstTime]);if(clearAt!==null)times.add(clearAt);for(let n=1;n/hz<end;n++)times.add(n/hz);
  for(const time of [...times].sort((a,b)=>a-b)){
    const wind=time<launch.burstTime+.5?[0,0,0]:[1.2,0,.3];f.update({time,windVector:wind});const events=f.drainEvents(),copy=JSON.stringify(events),start=performance.now();adapter.consume(events,{throughTime:time,windVector:wind});costs.push(performance.now()-start);assert.equal(JSON.stringify(events),copy);state.setWind({time,velocity:wind});state.advanceTo(time);
    const d=adapter.diagnostics();near(d.allocatedArea,d.materializedArea+d.reservedArea+d.cancelledReservedArea);near(state.diagnostics().ledger.emitted+state.diagnostics().ledger.pendingMass+explicitlyCleared,d.materializedArea);
    if(time===clearAt){explicitlyCleared+=state.diagnostics().ledger.emitted;const fresh=createPyroSmokeState({time:state.snapshot().time,capacity:4096,wind});adapter.clearForState(fresh,{time:state.snapshot().time});state=fresh;}
  }
  const diagnostic=adapter.diagnostics(),snapshot=state.snapshot(),motorIds=native.heads.filter(b=>b.thrustProfile).map(b=>b.id);adapter.dispose();f.dispose();return{launch,descriptor,graph,native,queries,released,logs,costs,diagnostic,snapshot,motorIds,end};
}
let actual;
check('native candidate provider reserves all actual 192 heads and covers every one of 32 motor IDs',()=>{
  actual=run();const x=actual,d=x.diagnostic,coverage=d.poweredSmoke.completedCoverage[0],logical=buildLogicalBurnProfile(x.graph);
  assert.equal(new Set(x.queries.map(q=>q.bodyId)).size,192);assert.deepEqual([...new Set(x.queries.filter(q=>q.motor).map(q=>q.bodyId))].sort((a,b)=>a-b),x.motorIds);assert.deepEqual(coverage.motorBodyIds,x.motorIds);assert.equal(coverage.materializedBodies,192);assert.equal(coverage.materializedMotorBodies,32);assert.equal(x.logs.length,logical.cellCount);near(d.materializedArea,20.35);near(x.snapshot.ledger.airborne,20.35);assert.equal(d.reservedArea,0);assert.equal(d.pendingPlans,0);assert.equal(x.released.length,1);assert.equal(x.snapshot.packets.length,x.logs.length);assert(x.logs.some(p=>p.kernelDiagnostics?.quadratureNodes>5));
  const sorted=x.costs.slice().sort((a,b)=>a-b),cost={p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],maximum:sorted.at(-1),total:sorted.reduce((s,v)=>s+v,0)};
  metrics.native={packets:x.logs.length,actualBodyQueries:x.queries.length,motorBodies:32,logicalBodies:192,eventMaterial:20.35,sourceConsumeMilliseconds:cost,frameRateClaim:false};return metrics.native;
});
check('zero optical gain cannot change native smoke material, IDs, timing or actual motor paths',()=>{
  const x=run({gain:0}),reference=actual??run();assert.equal(x.logs.length,reference.logs.length);assert.deepEqual(x.queries,reference.queries);for(let i=0;i<x.logs.length;i++)assert.deepEqual(x.logs[i],reference.logs[i]);near(x.diagnostic.materializedArea,20.35);return{packets:x.logs.length,identicalAtGainZero:true};
});
check('actual 30 and 60 Hz source routes preserve common-end moments and unique emission IDs',()=>{
  const x=run({hz:30}),reference=actual??run();assert.equal(x.logs.length,reference.logs.length);let maximum=0;for(let i=0;i<x.logs.length;i++){for(const field of ['emissionId','time','sourceId','mass'])assert.equal(x.logs[i][field],reference.logs[i][field]);for(const field of ['mean','covariance'])for(let c=0;c<x.logs[i][field].length;c++)maximum=Math.max(maximum,Math.abs(x.logs[i][field][c]-reference.logs[i][field][c]));}assert(maximum<1e-9);return{maximumMomentDifference:maximum};
});
check('actual clear before burst cancels motor material without revived late burst or body reads',()=>{
  const x=run({clearAt:1}),d=x.diagnostic;assert.equal(x.queries.length,0);assert.equal(d.pendingPlans,0);assert.equal(x.snapshot.packets.length,0);near(d.cancelledReservedArea,20);near(d.materializedArea,.35);near(d.accountingResidual,0);assert.equal(d.staleEvents,1);return{cancelledReferenceMaterial:d.cancelledReservedArea,lateBodyQueries:0};
});
const report={schema:'glass-atoll.r22-native-powered-smoke-cpu.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,metrics,limits:['Actual native producer/provider and CPU state accepted; no GPU, renderer, browser or visual/performance admission.','Single-event consumed CPU timings are observations, not a 60 fps guarantee.','Uniform per-life material allocation; bee-CDF material scheduler is not admitted.','Fixed downstream capacity 4096 and ordinary 2048-plan cap are unchanged; candidate plan cap is separately bounded at 16384.']};fs.writeFileSync(new URL('./r22-native-powered-smoke-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,metrics,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
