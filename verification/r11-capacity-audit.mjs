import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createPyroSmokeLogicalEvents} from '../pyro-smoke-logical-events.js';
const root=new URL('../',import.meta.url), read=p=>readFileSync(new URL(p,root),'utf8'), hash=s=>createHash('sha256').update(s).digest('hex');
const stateSource=read('pyro-smoke-state.js'), frozen=hash(stateSource), checks=[], runs=[], budgetMs=15000;
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}};
async function compile(source,exportName){source=source.replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));return(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')))[exportName];}
const selectedLine="      const selected=[...pool.filter(c=>c.sameSource).sort((a,b)=>a.score-b.score||a.i-b.i||a.j-b.j).slice(0,8),...pool.filter(c=>!c.sameSource).sort((a,b)=>a.score-b.score||a.i-b.i||a.j-b.j).slice(0,8)];";
const boundedBlock=`      const compareCandidate=(a,b)=>a.score-b.score||a.i-b.i||a.j-b.j,same=[],other=[];
      for(const c of pool){const list=c.sameSource?same:other;let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>>1;if(compareCandidate(list[mid],c)<=0)lo=mid+1;else hi=mid;}if(lo<8){list.splice(lo,0,c);if(list.length>8)list.pop();}}
      const selected=[...same,...other];`;
assert.equal(stateSource.split(selectedLine).length,2,'single exact selection location');
function instrument(source){
  for(const [a,b]of [
    ['  function compact(){','  const __stages={merges:0,groupMs:0,poolMs:0,selectMs:0,diagnosticsMs:0,pairs:0,selected:0,trace:[]};let __deadline=Infinity;\n  function compact(){'],
    ['    while(packets.length>capacity){','    while(packets.length>capacity){\n      if(performance.now()>__deadline)throw Error("bounded audit wallclock exceeded");const __t0=performance.now();'],
    ['      const pool=[],seen=new Set();','      const __t1=performance.now();__stages.groupMs+=__t1-__t0;const pool=[],seen=new Set();'],
    ['      const selected=[...pool.filter','      const __t2=performance.now();__stages.poolMs+=__t2-__t1;__stages.pairs+=pool.length;\n      const selected=[...pool.filter'],
    ['      const compareCandidate=','      const __t2=performance.now();__stages.poolMs+=__t2-__t1;__stages.pairs+=pool.length;\n      const compareCandidate='],
    ['      let choice=null,quality=Infinity,choicePreferred=false;','      const __t3=performance.now();__stages.selectMs+=__t3-__t2;__stages.selected+=selected.length;__stages.trace.push(selected.map(c=>[c.i,c.j,c.sameSource,c.score]));\n      let choice=null,quality=Infinity,choicePreferred=false;'],
    ['      if(!choice)fail(\'No same-profile capacity merge candidate\');','      __stages.diagnosticsMs+=performance.now()-__t3;__stages.merges++;\n      if(!choice)fail(\'No same-profile capacity merge candidate\');'],
    ['  };return api;','  };Object.defineProperty(api,"__audit",{value:{stages:__stages,start(){__deadline=performance.now()+'+budgetMs+';}}});return api;']
  ]){if(!source.includes(a))continue;assert.equal(source.split(a).length,2,a);source=source.replace(a,b);}return source;
}
const baseline=await compile(instrument(stateSource),'createPyroSmokeState'),candidate=await compile(instrument(stateSource.replace(selectedLine,boundedBlock)),'createPyroSmokeState');
console.log('Building native willow seed42 source tape with65536 correctness state; no4096 stress yet');
const factory=await compile(read('fireworks.js'),'createFireworks'),f=factory(THREE);f.configure({autoLaunch:false,autoDirection:false,azimuth:104,elevation:80});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:'willow',seed:42}),p=f.smokeSourceProvider,g=p.describeCombustion(launch.id),end=Math.max(...g.nodes.map(n=>n.endTime))+.15;
const sourceState=createPyroSmokeState({capacity:65536}),emissions=[],original=sourceState.queueEmission;sourceState.queueEmission=e=>{const result=original(e);emissions.push(structuredClone(e));return result;};const adapter=createPyroSmokeLogicalEvents({state:sourceState,sourceProvider:p});
const times=new Set([0,end]);for(let i=1;i/30<end;i++)times.add(i/30);const tapeStart=performance.now();for(const t of [...times].sort((a,b)=>a-b)){f.update({time:t,windVector:[0,0,0]});adapter.consume(f.drainEvents(),{throughTime:t,windVector:[0,0,0]});sourceState.advanceTo(t);}f.dispose();
const tapeMs=performance.now()-tapeStart,tapeHash=hash(JSON.stringify(emissions)),prefix=emissions.slice(0,4096+16),at=Math.ceil((prefix.at(-1).time+1e-7)*20)/20;
check('native willow tape has6291 logical packets and exact authored family budget',()=>{assert.equal(emissions.length,6291);assert.equal(adapter.diagnostics().reservedArea,0);assert(Math.abs(adapter.diagnostics().materializedArea-20.35)<1e-10);return{type:'willow',seed:42,packets:emissions.length,M:adapter.diagnostics().materializedArea,tapeHash,tapeMs,firstOverflowTime:emissions[4096].time,prefixEndTime:at,prefixPackets:prefix.length};});
console.log(JSON.stringify({tapePackets:emissions.length,tapeMs,firstOverflowTime:emissions[4096].time,prefixEndTime:at}));
for(const mode of ['baseline','candidate','candidate','baseline']){
 const s=(mode==='baseline'?baseline:candidate)({capacity:4096});s.__audit.start();const start=performance.now();for(const e of prefix)s.queueEmission(e);let a=s.advanceTo(at);while(!a.completed)a=s.advanceTo(at);const wallMs=performance.now()-start,stages=structuredClone(s.__audit.stages),snapshot=s.snapshot(),diagnostics=s.diagnostics();runs.push({mode,wallMs,stages,snapshotHash:hash(JSON.stringify(snapshot)),diagnosticsHash:hash(JSON.stringify(diagnostics)),diagnostics});console.log(JSON.stringify({mode,wallMs,stages:{...stages,trace:undefined},snapshotHash:runs.at(-1).snapshotHash}));
}
check('all4 bounded actualsource replays have exact snapshot and diagnostics',()=>{assert.equal(new Set(runs.map(r=>r.snapshotHash)).size,1);assert.equal(new Set(runs.map(r=>r.diagnosticsHash)).size,1);assert(runs.every(r=>r.diagnostics.packetCount===4096&&r.diagnostics.merges===16));return{snapshotHash:runs[0].snapshotHash,diagnosticsHash:runs[0].diagnosticsHash,merges:16,forcedMerges:runs[0].diagnostics.forcedMerges};});
check('all16 selected candidate orders are bitexact across four replays',()=>{assert.equal(new Set(runs.map(r=>JSON.stringify(r.stages.trace))).size,1);return{merges:runs[0].stages.trace.length,selected:runs[0].stages.selected,pairCount:runs[0].stages.pairs};});
check('runtime state source stayed untouched',()=>{assert.equal(hash(read('pyro-smoke-state.js')),frozen);return frozen;});
const report={schema:'glass-atoll.r11-capacity-audit.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),checks,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:{state:frozen,FW:hash(read('fireworks.js')),logicalEvents:hash(read('pyro-smoke-logical-events.js')),logicalCursor:hash(read('pyro-smoke-logical-burn.js')),helper:hash(read('verification/r11-capacity-audit.mjs'))},tape:{packetCount:emissions.length,tapeHash,tapeMs,prefixPackets:prefix.length,prefixEndTime:at,wind:[0,0,0],sourceHz:30},runs:runs.map(r=>({...r,stages:{...r.stages,traceHash:hash(JSON.stringify(r.stages.trace)),trace:undefined}})),limits:['CPU Node audit and in-memory mechanical candidate ONLY; runtime files unmodified.','FourABBA orders,16overflows perrun; not full6291/default4096 replay, GPU/FPS, minute accumulation or visual acceptance.','Existing mergeDiagnostics sampled15points/36rays are not global tau bounds. Candidate preserves exact existing selection, diagnostics and moments; does not improve forced merge quality.','Stage instrumentation observer overhead affects absolute timings; costs include packet input/evolution and are not renderer measurements.']};
writeFileSync(new URL('./r11-capacity-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
