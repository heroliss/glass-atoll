import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance,PerformanceObserver} from 'node:perf_hooks';
import {createPyroSmokeColumns as candidate} from '../pyro-smoke-columns.js';
import {createPyroSmokeColumns as baseline} from './baselines/smoke-columns-c1e845/pyro-smoke-columns.js';

const started=performance.now(),checks=[],test=(name,fn)=>{try{checks.push({name,passed:true,detail:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),clone=structuredClone;
let seed=0x1867ab91;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const profiles=[{id:'reference',extinctionPerMassRGB:[.4,.7,1]},{id:'other',extinctionPerMassRGB:[1,.5,.2]}];
function initial(count=4096){return{time:0,revision:0,profiles:clone(profiles),packets:Array.from({length:count},(_,i)=>({id:i%2?-i-1:i,profileId:'reference',mass:.002+random()*.001,mean:[random()*360-180,random()*120+5,random()*360-180],covariance:[2+random()*3,.15,.05,.15,2+random()*3,.1,.05,.1,2+random()*3]}))};}
function at(source,frame){
  const shift=frame*.025,packets=source.packets.map((p,i)=>({...p,mean:[p.mean[0]+shift+frame*.0001*(i%17),p.mean[1]+Math.sin(frame*.05)*.03,p.mean[2]-frame*.015],covariance:p.covariance.map((v,j)=>v+([0,4,8].includes(j)?frame*.0008:0))}));
  const offset=frame%packets.length;return{...source,time:frame/20,revision:frame,packets:[...packets.slice(offset),...packets.slice(0,offset)]};
}
const rays=Array.from({length:8},(_,i)=>{const origin=[-220,15+i*13,-130+i*34],to=[220,10+i*7,100-i*25],delta=to.map((v,c)=>v-origin[c]),end=Math.hypot(...delta);return{origin,direction:delta.map(v=>v/end),start:0,end,errorBudget:0};});
function compare(a,b,selected=rays){let max=0;for(const ray of selected){const x=a.query(ray),y=b.query(ray);for(let c=0;c<3;c++){const e=Math.abs(x.tauRGB[c]-y.tauRGB[c]);max=Math.max(max,e);assert(e<=2e-12+2e-11*Math.abs(y.tauRGB[c]),JSON.stringify({e,x:x.tauRGB,y:y.tauRGB}));}}return max;}
function fn(source,name){const start=source.indexOf(`function ${name}(`);assert(start>=0,name);const body=source.indexOf('){',start)+1;assert(body>start);let depth=0;for(let i=body;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}throw Error(name);}
const source=read('../pyro-smoke-columns.js'),old=read('./baselines/smoke-columns-c1e845/pyro-smoke-columns.js');
test('sealed c1e845 baseline and kernel/query arithmetic unchanged',()=>{
  assert.equal(sha(old),'c1e8457b68f3d8c0843a71eaf5f44d644053bc080faede7e2c099abc372ca987');
  const hashes={};for(const name of ['cholesky','whiten','erfPositive','erfcPositive','erfDifference','finiteColumn','preparePacket','query']){assert.equal(fn(source,name),fn(old,name),name);hashes[name]=sha(fn(source,name));}return hashes;
});
test('same negative/positive ID set refits even if input order changes',()=>{
  const s=initial(128),a=candidate(s),b=baseline(s),next=at(s,3);a.update(next);b.update(next);assert.equal(a.diagnostics().lastUpdateKind,'refit');assert.equal(a.diagnostics().packetCount,128);return{maximumUncappedTauDifference:compare(a,b)};
});
test('new/removed/merge IDs rebuild without dropping negative merge IDs',()=>{
  const s=initial(32),a=candidate(s),b=baseline(s),next=clone(s);next.packets.splice(0,2,{...next.packets[0],id:-100000,mass:next.packets[0].mass+next.packets[1].mass});a.update(next);b.update(next);assert.equal(a.diagnostics().lastUpdateKind,'structural-rebuild');assert.equal(a.diagnostics().packetCount,31);compare(a,b);
  next.packets[3].id=-100001;a.update(next);b.update(next);assert.equal(a.diagnostics().lastUpdateKind,'structural-rebuild');compare(a,b);
});
test('duplicate/missing IDs fall back to rebuild and retain all mass packets',()=>{
  const s=initial(32);s.packets[0].id=s.packets[1].id;const a=candidate(s),b=baseline(s);a.update(s);b.update(s);assert.equal(a.diagnostics().lastUpdateKind,'structural-rebuild');assert.equal(a.diagnostics().packetCount,32);compare(a,b);
});
test('same IDs still revalidate mass/covariance/profiles and commit atomically',()=>{
  const s=initial(64),a=candidate(s),b=baseline(s),next=at(s,4);next.packets[0].mass*=2;next.packets[1].profileId='other';next.profiles[0].extinctionPerMassRGB=[.5,.8,1.1];a.update(next);b.update(next);assert.equal(a.diagnostics().lastUpdateKind,'refit');compare(a,b);
  const saved=a.query(rays[0]),bad=clone(next);bad.packets.at(-1).covariance=[1,1,0,1,1,0,0,0,1];assert.throws(()=>a.update(bad));assert.deepEqual(a.query(rays[0]).tauRGB,saved.tauRGB);assert.equal(a.diagnostics().sourceRevision,4);
});
test('spare-buffer Cholesky matches baseline across full SPD covariances and repeated swaps',()=>{
  const s=initial(128);s.packets.forEach((p,i)=>{
    const a=.02+(i%13)*.15,b=((i%7)-3)*.12,d=.03+(i%11)*.18,e=((i%5)-2)*.16,f=((i%9)-4)*.11,g=.04+(i%17)*.12;
    p.covariance=[a*a,a*b,a*e,a*b,b*b+d*d,b*e+d*f,a*e,b*e+d*f,e*e+f*f+g*g];
  });
  const a=candidate(s),b=baseline(s);let maximumError=0;
  for(let frame=1;frame<=4;frame++){
    const next=at(s,frame);a.update(next);b.update(next);assert.equal(a.diagnostics().lastUpdateKind,'refit');
    const selected=next.packets.filter((_,i)=>i%8===0).map(p=>({origin:[p.mean[0]-10,p.mean[1],p.mean[2]],direction:[1,0,0],start:0,end:20,errorBudget:0}));
    maximumError=Math.max(maximumError,compare(a,b,selected));
  }
  return{packets:128,swaps:4,uncappedRays:64,maximumError};
});
test('refit deterioration has an explicit rebuild threshold, then coherent updates refit',()=>{
  const s=initial(512);s.packets.forEach((p,i)=>{p.mean=[i*100,0,0];p.covariance=[.04,0,0,0,.04,0,0,0,.04];});
  const a=candidate(s),b=baseline(s),scrambled=clone(s),positions=scrambled.packets.map(p=>p.mean);for(let i=positions.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[positions[i],positions[j]]=[positions[j],positions[i]];}scrambled.packets.forEach((p,i)=>p.mean=positions[i]);a.update(scrambled);b.update(scrambled);const d=a.diagnostics();assert.equal(d.lastUpdateKind,'quality-rebuild');assert(d.lastFallbackGrowth>d.refitRebuildThreshold);compare(a,b);
  const next=at(scrambled,1);a.update(next);b.update(next);assert.equal(a.diagnostics().lastUpdateKind,'refit');compare(a,b);return{fallbackGrowth:d.lastFallbackGrowth,threshold:d.refitRebuildThreshold};
});

let benchmark=null;
const gcEntries=[],gcObserver=new PerformanceObserver(list=>gcEntries.push(...list.getEntries().map(e=>({durationMs:e.duration,kind:e.detail?.kind??null}))));gcObserver.observe({entryTypes:['gc']});
test('64 warmed continuous updates match all uncapped baseline rays and report real CPU/heap costs',()=>{
  const s=initial(),a=candidate(s),b=baseline(s);for(let f=1;f<=8;f++){const input=at(s,f);a.update(input);b.update(input);}
  globalThis.gc?.();const heapBefore=process.memoryUsage().heapUsed,records=[],heapSamples=[heapBefore];let maxDifference=0,refitCount=0,maxQueryNodeGrowth=0;
  for(let i=0;i<64;i++){
    const input=at(s,i+9),order=i%2?['candidate','baseline']:['baseline','candidate'],row={frame:i+9,order};
    for(const variant of order){const t=performance.now();(variant==='candidate'?a:b).update(input);row[variant+'Ms']=performance.now()-t;}
    maxDifference=Math.max(maxDifference,compare(a,b));const d=a.diagnostics();if(d.lastUpdateKind==='refit')refitCount++;row.kind=d.lastUpdateKind;row.trackedNewPacketRecords=d.trackedNewPacketRecords;row.trackedNewNodeRecords=d.trackedNewNodeRecords;row.qualityGrowth=d.treeQualityGrowth;
    let currentNodes=0,baselineNodes=0;for(const r of rays){currentNodes+=a.query({...r,errorBudget:1e-5}).visitedNodes;baselineNodes+=b.query({...r,errorBudget:1e-5}).visitedNodes;}
    row.queryVisitedRatio=currentNodes/Math.max(1,baselineNodes);maxQueryNodeGrowth=Math.max(maxQueryNodeGrowth,row.queryVisitedRatio);records.push(row);heapSamples.push(process.memoryUsage().heapUsed);
  }
  assert.equal(refitCount,64);assert(maxDifference<2e-12);const heapBeforeFinalGC=process.memoryUsage().heapUsed;globalThis.gc?.();const heapAfterGC=process.memoryUsage().heapUsed;
  const stats=key=>{const values=records.map(r=>r[key]).sort((a,b)=>a-b);return{count:64,meanMs:values.reduce((a,b)=>a+b,0)/64,medianMs:(values[31]+values[32])/2,p95Ms:values[60],maximumMs:values[63],minimumMs:values[0]};};
  benchmark={packetCount:4096,warmupUpdates:8,measuredUpdates:64,alternatingOrder:true,candidate:stats('candidateMs'),baseline:stats('baselineMs'),maximumUncappedTauDifference:maxDifference,refitCount,maximumVisitedNodeRatioToFreshBaseline:maxQueryNodeGrowth,trackedNewPacketRecordsTotal:records.reduce((n,r)=>n+r.trackedNewPacketRecords,0),trackedNewNodeRecordsTotal:records.reduce((n,r)=>n+r.trackedNewNodeRecords,0),heap:{gcExposed:!!globalThis.gc,beforeBytes:heapBefore,beforeFinalGCBytes:heapBeforeFinalGC,afterGCBytes:heapAfterGC,maximumSampledBytes:Math.max(...heapSamples),note:'Whole-process used heap including generated input snapshots and both interleaved variants; net/peak are not total allocated bytes. Record counts track only named prepared records, not all temporary JS arrays.'},finalDiagnostics:a.diagnostics(),records};return{candidate:benchmark.candidate,baseline:benchmark.baseline,maximumUncappedTauDifference:maxDifference,maximumVisitedNodeRatio: maxQueryNodeGrowth,trackedNewPacketRecordsTotal:benchmark.trackedNewPacketRecordsTotal,trackedNewNodeRecordsTotal:benchmark.trackedNewNodeRecordsTotal,heap:benchmark.heap};
});
await new Promise(resolve=>setImmediate(resolve));gcObserver.disconnect();
const report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256:sha(source),baselineSHA256:sha(old),runtimeIntegrated:false,benchmark,gcObserved:{count:gcEntries.length,totalDurationMs:gcEntries.reduce((n,e)=>n+e.durationMs,0),note:'Process-wide GC including both variants/fixtures; not attributed to a variant.'},wallMs:performance.now()-started,checks};
fs.writeFileSync(new URL('pyro-smoke-columns-update-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,sourceSHA256:report.sourceSHA256,benchmark:benchmark?{candidate:benchmark.candidate,baseline:benchmark.baseline,maximumUncappedTauDifference:benchmark.maximumUncappedTauDifference,maximumVisitedNodeRatio:benchmark.maximumVisitedNodeRatioToFreshBaseline,trackedNewPacketRecordsTotal:benchmark.trackedNewPacketRecordsTotal,trackedNewNodeRecordsTotal:benchmark.trackedNewNodeRecordsTotal}:null,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
