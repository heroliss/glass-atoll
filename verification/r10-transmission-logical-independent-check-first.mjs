import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createPyroSmokeColumns} from '../pyro-smoke-columns.js';
import {createFireworks} from '../fireworks.js';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createPyroSmokeLogicalEvents} from '../pyro-smoke-logical-events.js';
import {normalize as normalizeColumns} from './r10-columns-transmission-normalize.mjs';

const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const hash=p=>createHash('sha256').update(read(p)).digest('hex');
const expected={columns:'0c2a14e9b8bd4181c022a70eb0fc34d04b65f25bce8e28d20201eef6c3a11e7d',fireworks:'b37ea388471b6f50a307327fab95ccc10d7f9aaa1dc46ed921fc1abd9c890e43',host:'01c4c66e15579f429e472a0089fda9f5ba1f17d782d3cd63d69a226b30225a89',adapter:'5f7bf8b0d311f9cdac938b18612b9ff16b5c80fa26330a20d79e9e44661a1837'};
const paths={columns:'pyro-smoke-columns.js',fireworks:'fireworks.js',host:'pyro-smoke.js',adapter:'pyro-smoke-logical-events.js'};
const checks=[],findings=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}};
const near=(a,b)=>assert(Math.abs(a-b)<=3e-11*Math.max(1,Math.abs(a),Math.abs(b)));
const strip=d=>Object.fromEntries(Object.entries(d).filter(([k])=>!['lastBuildMs','lastUpdateMs','totalBuildMs','totalQueryMs','maximumQueryMs'].includes(k)));
const source=read('verification/baselines/r10-before-transmission-fast-path/pyro-smoke-columns.js').replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));
const oldColumns=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createPyroSmokeColumns;
const snapshot={time:0,revision:1,profiles:[{id:'colour',extinctionPerMassRGB:[.13,2.3,.8]},{id:'clear',extinctionPerMassRGB:[0,0,0]}],packets:Array.from({length:17},(_,i)=>({id:i,profileId:i===16?'clear':'colour',mass:.1+i*.003,mean:[i*.7-5,(i%3)-1,Math.sin(i)*2],covariance:[1.1,.27,.13,.27,.7,-.04,.13,-.04,1.7]}))};

check('frozen reviewed runtime bytes and strict columns inverse',()=>{
 for(const [k,p]of Object.entries(paths))assert.equal(hash(p),expected[k]);
 assert.equal(normalizeColumns(read(paths.columns),{required:true}),read('verification/baselines/r10-before-transmission-fast-path/pyro-smoke-columns.js'));
 return{sourceSHA256:expected,qualityCuts:false};
});
check('independent coloured-SPD AABB-edge queries preserve binary64T and nonclock counters',()=>{
 const a=oldColumns(snapshot),b=createPyroSmokeColumns(snapshot);let rays=0;
 const endpoints=[[-20,0,0],[20,0,0],[0,5*Math.sqrt(.7),-8],[0,5*Math.sqrt(.7)+1e-9,8],[0,0,0],[1e-9,0,0],[1e6,2,3]];
 for(const from of endpoints)for(const to of endpoints)for(const errorBudget of [0,1e-5,.01]){
  a.resetDiagnostics();b.resetDiagnostics();const old=a.between(from,to,{errorBudget}),out=new Float64Array(3);
  assert.equal(b.writeTransmissionBetween(from,to,out,{errorBudget}),out);assert.deepEqual([...out],old.T);assert.deepEqual(strip(a.diagnostics()),strip(b.diagnostics()));rays++;
 }
 return{rays,bitExact:true,errorBudgets:[0,1e-5,.01]};
});
check('out aliased to either endpoint and later queries never alias old publicT',()=>{
 const c=createPyroSmokeColumns(snapshot),from=[-10,2,1],to=[9,-1,2],old=c.between(from,to),copy=[...old.T];
 for(const useFrom of [true,false])for(const typed of [true,false]){
  const a=typed?new Float64Array(from):[...from],b=typed?new Float64Array(to):[...to],out=useFrom?a:b;
  assert.equal(c.writeTransmissionBetween(a,b,out),out);assert.deepEqual([...out],copy);
 }
 c.writeTransmissionBetween([0,0,0],[0,0,0],new Float64Array(3));assert.deepEqual(old.T,copy);
});
check('invalid inherited-readonly Array output must reject before query counters change',()=>{
 const c=createPyroSmokeColumns(snapshot),out=Array(3),proto=Object.create(Array.prototype);
 Object.defineProperty(proto,'0',{value:0,writable:false,configurable:true});Object.setPrototypeOf(out,proto);
 const before=c.diagnostics();let error;try{c.writeTransmissionBetween([-1,0,0],[1,0,0],out);}catch(e){error=e;}
 const after=c.diagnostics();assert(error instanceof TypeError);
 const witness={severity:'low API preflight gap; not a production F64 or numerical-quality blocker',file:'pyro-smoke-columns.js',lines:[261,300],error:String(error.message),raysBefore:before.rays,raysAfter:after.rays,kernelsAfter:after.kernelsEvaluated,globalPrototypeModified:false};findings.push(witness);
 assert.equal(after.rays,before.rays,'Inherited readonly output reached computation before its write failed');
});
check('G1 native child is causal, old root-only entry still rejects, past point stable after later wind',()=>{
 const f=createFireworks(THREE);try{
  f.configure({autoLaunch:false});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:'crossette',seed:42}),p=f.smokeSourceProvider,g=p.describeCombustion(launch.id),child=g.nodes.find(n=>n.role==='aerial-child');
  f.update({time:child.birth+.1,windVector:[0,0,0]});const t=child.birth+.05,point=p.sampleBody(launch.id,{bodyId:child.bodyId,time:t});
  assert(Object.isFrozen(point)&&Object.isFrozen(point.position));assert(point.position.every(Number.isFinite));
  assert.throws(()=>p.sample(launch.id,{kind:'root',bodyId:child.bodyId,time:t}));assert.throws(()=>p.sampleBody(launch.id,{bodyId:child.bodyId,time:child.birth-1e-9}));assert.throws(()=>p.sampleBody(launch.id,{bodyId:child.bodyId,time:p.time+1}));
  f.update({time:child.birth+.2,windVector:[3,0,-2]});assert.deepEqual(p.sampleBody(launch.id,{bodyId:child.bodyId,time:t}),point);
  return{childId:child.bodyId,oldRootRejects:true,pastPointUnchanged:true};
 }finally{f.dispose();}
});
check('native-provider G4 prepare failure and actual accepted-prefix clear do not replay oldevent',()=>{
 const f=createFireworks(THREE);let adapter;
 try{
  f.configure({autoLaunch:false});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:'palm',seed:42}),p=f.smokeSourceProvider;
  const provider={get time(){return p.time;},describe:id=>p.describe(id),describeCombustion:id=>p.describeCombustion(id),sample:(id,o)=>p.sample(id,o),sampleBody:(id,o)=>p.sampleBody(id,o),release:id=>p.release(id)};
  const state=createPyroSmokeState({time:0});adapter=createPyroSmokeLogicalEvents({state,sourceProvider:provider});adapter.consume(f.drainEvents(),{throughTime:0,windVector:[0,0,0]});
  const now=launch.burstTime+.4;f.update({time:now,windVector:[0,0,0]});const events=f.drainEvents(),before=JSON.stringify(adapter.diagnostics()),snapshot=JSON.stringify(state.snapshot()),sample=provider.sampleBody;let readCount=0;
  provider.sampleBody=(id,o)=>{if(++readCount===2)throw new Error('independent readonly provider fault');return sample(id,o);};
  assert.throws(()=>adapter.prepare(events,{throughTime:now,windVector:[0,0,0]}),/independent readonly provider fault/);assert.equal(JSON.stringify(adapter.diagnostics()),before);assert.equal(JSON.stringify(state.snapshot()),snapshot);provider.sampleBody=sample;
  const queue=state.queueEmission;let calls=0;state.queueEmission=e=>{const r=queue(e);if(++calls===3)throw new Error('independent accepted then throw');return r;};
  assert.throws(()=>adapter.consume(events,{throughTime:now,windVector:[0,0,0]}),/accepted then throw/);const fault=adapter.diagnostics();assert.equal(fault.fault.acceptedPackets,3);near(fault.allocatedArea,fault.materializedArea+fault.reservedArea);
  const fresh=createPyroSmokeState({time:0});adapter.clearForState(fresh,{time:0});assert.equal(adapter.diagnostics().reservedArea,0);
  adapter.consume(events,{throughTime:now,windVector:[0,0,0]});assert.equal(fresh.diagnostics().acceptedSources,0);
  const idFloor=adapter.diagnostics().nextEmissionId;f.launch({type:'fan',seed:43});adapter.consume(f.drainEvents(),{throughTime:now,windVector:[0,0,0]});assert(fresh.diagnostics().acceptedSources>0);assert(adapter.diagnostics().nextEmissionId>idFloor);
  const d=adapter.diagnostics();near(d.allocatedArea,d.materializedArea+d.reservedArea+d.cancelledReservedArea);
  return{acceptedBeforeFault:3,cancelledReserve:adapter.diagnostics().cancelledReservedArea,oldEventDidNotReplay:true,sameClockNewEventAccepted:true};
 }finally{adapter?.dispose();f.dispose();}
});
check('independent review left frozen source bytes unchanged',()=>{for(const [k,p]of Object.entries(paths))assert.equal(hash(p),expected[k]);});
const report={schema:'glass-atoll.r10-transmission-logical-independent.v1',actualGPU:false,productionIntegrated:false,dateUTC:new Date().toISOString(),sourceSHA256:expected,checks,findings,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},limits:['One invalid sparse-Array preflight finding does not change production Float64Array T, error budget or numerical quality.','No performance measurement, full application default regression, GPU/visual validation or complete arbitrary-callback atomicity proof.','G4 callback reads are readonly; fault-injected acceptance is explicit and not rolled back.']};report.passed=checks.every(c=>c.passed);
writeFileSync(new URL('./r10-transmission-logical-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,findings,failures:checks.filter(c=>!c.passed).map(c=>({name:c.name,error:c.error.split('\n')[0]}))},null,2));
process.exitCode=report.passed?0:1;
