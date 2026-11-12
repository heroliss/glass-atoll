import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {createPyroSmokeTickState} from '../pyro-smoke-tick-state.js';

const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex'),source=read('pyro-smoke-tick-state.js');
const row=(id,time)=>({emissionId:id,time,mass:.01,mean:[id%4,100+id*.1,id%3],covariance:[1,0,0,0,2,0,0,0,3],sourceId:'s'+id%3,temperatureExcessK:id%4});
async function compile(s){return(await import('data:text/javascript;base64,'+Buffer.from(s.replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href))).toString('base64'))).createPyroSmokeTickState;}
function physicalSnapshot(s){const out=s.snapshot();delete out.requestedTime;return out;}

if(!isMainThread){
 const THREE=await import('../vendor/three.module.js');
 const fwText=read('fireworks.js').replace("from './fireworks-physics.js'",'from '+JSON.stringify(new URL('fireworks-physics.js',root).href));
 const createFW=(await import('data:text/javascript;base64,'+Buffer.from(fwText).toString('base64'))).createFireworks;
 const {createPyroSmokeLogicalEvents}=await import('../pyro-smoke-logical-events.js');
 const f=createFW(THREE,{seed:14271});f.configure({type:'willow',elevation:80,azimuth:104});f.update({time:0,windVector:[0,0,0]});
 const launch=f.launch({type:'willow',seed:42}),g=f.smokeSourceProvider.describeCombustion(launch.id),end=Math.max(...g.nodes.map(n=>n.endTime))+.15;
 const s=createPyroSmokeTickState(),rows=[],queue=s.queueEmission;
 s.queueEmission=e=>{const r=queue(e);rows.push(structuredClone(e));return r;};
 const a=createPyroSmokeLogicalEvents({state:s,sourceProvider:f.smokeSourceProvider}),steps=new Set([0,end]),advance=[];
 for(let i=1;i/workerData.hz<end;i++)steps.add(i/workerData.hz);
 const start=performance.now();
 for(const t of [...steps].sort((a,b)=>a-b)){
  f.update({time:t,windVector:[0,0,0]});a.consume(f.drainEvents(),{throughTime:t,windVector:[0,0,0]});
  const begin=performance.now();s.advanceFence(t);advance.push(performance.now()-begin);
 }
 const d=s.diagnostics(),result={hz:workerData.hz,completed:true,wallMs:performance.now()-start,maxAdvanceMs:Math.max(...advance),emissionCount:rows.length,emissionHash:hash(JSON.stringify(rows)),snapshotHash:hash(JSON.stringify(physicalSnapshot(s))),diagnostics:d,sourceDiagnostics:a.diagnostics(),endTime:end};
 f.dispose();a.dispose();parentPort.postMessage(result);
}else{
 const report={schema:'glass-atoll.r12-tick-fence-cpu.v1',dateUTC:new Date().toISOString(),sourceSHA256:{state:hash(source),math:hash(read('pyro-smoke-tick-math.js')),graph:hash(read('pyro-smoke-merge-graph.js')),legacy:hash(read('pyro-smoke-state.js'))},actualGPU:false,checks:[],runs:[]};
 const save=()=>writeFileSync(new URL('r12-tick-fence-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 const check=(name,fn)=>{try{report.checks.push({name,passed:true,evidence:fn()});}catch(e){report.checks.push({name,passed:false,error:String(e.stack||e).replace(/data:text\/javascript;base64,[^)]*/g,'<compiled-module>')});}save();};
 const marker='committed=s;emissionQueue=nextEmissions;windQueue=nextWind;';assert.equal(source.split(marker).length,2);
 const createFail=await compile(source.replace(marker,"if(globalThis.__r12FenceFail&&end>.05)throw Error('second-tick');"+marker));
 check('failed second tick retains first committed tick and all remaining accepted inputs, then retries exactly',()=>{
  const a=createFail({capacity:2}),b=createPyroSmokeTickState({capacity:2});for(const s of [a,b])for(let i=0;i<12;i++)s.queueEmission(row(i,.01+i*.012));
  b.advanceFence(.05);globalThis.__r12FenceFail=true;assert.throws(()=>a.advanceFence(.15),/second-tick/);delete globalThis.__r12FenceFail;
  assert.deepEqual(physicalSnapshot(a),physicalSnapshot(b));assert.equal(a.snapshot().requestedTime,.15);assert.equal(a.snapshot().time,.05);assert.equal(a.diagnostics().pendingEmissions,8);assert.equal(a.diagnostics().lastEmissionId,11);assert.equal(a.diagnostics().lastAdvanceSteps,1);assert.equal(a.diagnostics().lastAdvanceFences,0);assert.deepEqual(a.diagnostics().lastAdvanceFailure,{requestedTime:.15,committedTime:.05,failedCommitEndTime:.1,failedCommitKind:'tick',completedSteps:1,completedSameClockFences:0});
  a.advanceFence(.15);b.advanceFence(.15);assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.diagnostics(),b.diagnostics());return{retainedCommittedTime:.05,retainedPending:8};
 });
 const createSameClockFail=await compile(source.replace(marker,"if(globalThis.__r12SameClockFail)throw Error('same-clock-fence');"+marker));
 check('failed same-clock fence reports zero progress and invalid targets preserve the failure record',()=>{
  const s=createSameClockFail({capacity:1});s.queueEmission(row(0,0));globalThis.__r12SameClockFail=true;assert.throws(()=>s.advanceFence(0),/same-clock-fence/);delete globalThis.__r12SameClockFail;
  assert.equal(s.snapshot().packets.length,0);assert.equal(s.diagnostics().pendingEmissions,1);assert.deepEqual(s.diagnostics().lastAdvanceFailure,{requestedTime:0,committedTime:0,failedCommitEndTime:0,failedCommitKind:'same-clock',completedSteps:0,completedSameClockFences:0});const before=s.diagnostics();assert.throws(()=>s.advanceFence(NaN));assert.deepEqual(s.diagnostics(),before);const copy=s.diagnostics();copy.lastAdvanceFailure.failedCommitEndTime=123;assert.deepEqual(s.diagnostics(),before);s.advanceFence(0);assert.equal(s.diagnostics().lastAdvanceFailure,null);assert.equal(s.diagnostics().lastAdvanceFences,1);assert.equal(s.snapshot().packets.length,1);return{failedBoundary:0,retryCompleted:true};
 });
 const pushMarker='s.packets.push(p);owned.add(p);';assert.equal(source.split(pushMarker).length,2);
 const createObserved=await compile(source.replace(pushMarker,pushMarker+'globalThis.__r12StagePeak?.(s.packets.length);'));
 check('private stage reaches the exact capacity+pending bound while public density never exceeds capacity',()=>{
  const s=createObserved({capacity:16,maxPendingEmissions:24});for(let i=0;i<16;i++)s.queueEmission(row(i,0));s.advanceFence(0);for(let i=16;i<40;i++)s.queueEmission(row(i,0));
  const before=s.snapshot();assert.throws(()=>s.queueEmission(row(40,0)),/Pending emission capacity/);assert.deepEqual(s.snapshot(),before);let peak=0;
  globalThis.__r12StagePeak=n=>{peak=Math.max(peak,n);assert.equal(s.snapshot().packets.length,16);};s.advanceFence(0);delete globalThis.__r12StagePeak;
  assert.equal(peak,40);assert.equal(s.diagnostics().maxStagingPackets,40);assert.equal(s.diagnostics().stagingPeakPacketCount,40);assert.equal(s.diagnostics().packetCount,16);assert.equal(s.diagnostics().peakPacketCount,16);assert.equal(s.diagnostics().lastEmissionId,39);assert(Math.abs(s.diagnostics().ledger.airborne-.4)<1e-15);return{privatePeak:peak,publicPeak:16};
 });
 check('same-clock new causal operations are allowed after a fence and wind normalization is last-write-wins',()=>{
  const s=createPyroSmokeTickState({capacity:2});s.queueEmission(row(0,0));s.advanceFence(0);s.queueEmission(row(1,0));s.setWind({time:5e-11,velocity:[1,0,0]});s.setWind({time:0,velocity:[2,0,0]});assert.equal(s.snapshot().packets.length,1);assert.equal(s.snapshot().pendingWindEvents,1);s.advanceFence(0);assert.equal(s.snapshot().packets.length,2);assert.deepEqual(s.snapshot().currentWind,[2,0,0]);s.advanceFence(.05);assert.equal(s.snapshot().packets[0].mean[0],.1);return{causalSameClockAccepted:true};
 });
 async function job(hz){return new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:{hz}}),timer=setTimeout(()=>{w.terminate();resolve({hz,completed:false,error:'hard30s-worker-bound'});},30000);w.on('message',r=>{clearTimeout(timer);w.terminate();resolve(r);});w.on('error',e=>{clearTimeout(timer);reject(e);});});}
 for(const hz of [30,60,120]){const r=await job(hz);report.runs.push(r);save();console.log(JSON.stringify({hz,completed:r.completed,wallMs:r.wallMs,maxAdvanceMs:r.maxAdvanceMs,snapshotHash:r.snapshotHash,emissionHash:r.emissionHash}));}
 check('native 30/60/120 delivery preserves the full6291 input stream and physical final snapshot',()=>{
  assert(report.runs.every(r=>r.completed));const first=report.runs[0];for(const r of report.runs){assert.equal(r.emissionCount,6291);assert.equal(r.emissionHash,first.emissionHash);assert.equal(r.snapshotHash,first.snapshotHash);assert.equal(r.diagnostics.packetCount,4096);assert.equal(r.diagnostics.stagingPeakPacketCount,4137);assert(Math.abs(r.diagnostics.ledger.emitted-20.35)<1e-10);assert.equal(r.sourceDiagnostics.reservedArea,0);assert.equal(r.diagnostics.pendingEmissions,0);}return report.runs.map(r=>({hz:r.hz,wallMs:r.wallMs,maxAdvanceMs:r.maxAdvanceMs}));
 });
 check('source freeze unchanged after all bounded tests',()=>{for(const [k,p]of [['state','pyro-smoke-tick-state.js'],['math','pyro-smoke-tick-math.js'],['graph','pyro-smoke-merge-graph.js'],['legacy','pyro-smoke-state.js']])assert.equal(hash(read(p)),report.sourceSHA256[k]);return report.sourceSHA256;});
 report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.passed=report.checks.every(c=>c.passed);save();console.log(JSON.stringify({counts:report.counts,failed:report.checks.filter(c=>!c.passed)}));if(!report.passed)process.exitCode=1;
}
