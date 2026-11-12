import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {captureJointWorkIdentity,sameJointWorkIdentity,modelCompleteJointResult,planJointSmokeWork,jointWorkChunkAt} from './r24-joint-work-planner.js';
import {planSmokeLightTiles} from '../pyro-smoke-light-tiles.js';
import {planSmokeTransmissionLayout} from '../smoke-transmission-layout.js';
const results=[];
function check(name,fn){try{results.push({name,passed:true,evidence:fn()});}catch(error){results.push({name,passed:false,error:String(error.stack||error)});}}
const B=overrides=>({maxPairs:1048576,maxReductionReads:10000000,maxDraws:100000,maxOwnedBytes:512*1024*1024,maxUploadBytes:64*1024*1024,maxRasterTexels:10000000,...overrides});
const caps=(n,p,maxPairs=1048576)=>({maxSources:Math.max(1,n),maxPackets:Math.max(1,p),maxPairs});
function input(kind,n,p){
  const density64=new Float64Array(p*16),packedPackets=new Float32Array(p*(kind==='resolved'?4:16));
  for(let i=0;i<p;i++){density64.set([i*.1,2,3,1,1,0,0,0,1,0,0,0,1,.01,.012,.014],i*16);if(kind==='resolved')packedPackets.set([i*.1,2,3,1],i*4);else packedPackets.set([i*.1,2,3,.06349363593424097,1,0,1,0,0,1,.01,.012,.014,0,0,0],i*16);}
  const metadata={contextKey:'existing-context-1',kernelKey:kind==='resolved'?'isotropic-sh1-tiled64-v1':'full-SPD-sourceT64-v1',densityKey:'owned-density-1',profileKey:'complete-profiles-1',densityRevision:1,recordGeneration:2,densityTime:1,sourceTime:1.1};
  const arrays={density64,packedPackets};
  if(kind==='resolved'){
    Object.assign(metadata,{ledgerKey:'ledger-1',ledgerVersion:3,rawPerCandela:3.6e-5,anisotropy:.32,bakeMode:'tiled64'});
    arrays.ledger=new Float32Array(n*8);for(let i=0;i<n;i++)arrays.ledger.set([i*.1,5,3,.1,1,.6,.4,0],i*8);
  }else{
    const eye=kind==='mirror'?[0,-2,0]:[0,2,0];Object.assign(metadata,{sourceVersion:3,shutterSeconds:1/60,planeY:0,reflection:kind==='mirror',cameraKey:eye.join(','),eye});
    arrays.origins64=new Float64Array(n*3);arrays.endpoints64=new Float64Array(n*3);arrays.active=new Uint8Array(n).fill(1);arrays.packedSources=new Float32Array(n*12);
    for(let i=0;i<n;i++){const to=[i*.1,5,3],from=kind==='mirror'?[to[0]*2/7,0,to[2]*2/7]:eye,o=i*3;arrays.origins64.set(from,o);arrays.endpoints64.set(to,o);const d=to.map((x,c)=>x-from[c]),len=Math.hypot(...d);arrays.packedSources.set([...from.map((x,c)=>x-eye[c]),len,...to.map((x,c)=>x-eye[c]),1,...d.map(x=>x/len),0],i*12);}
  }
  return {sourceCount:n,packetCount:p,metadata,packetIds:Array.from({length:p},(_,i)=>'packet-'+i),profileIds:Array(p).fill('neutral-profile'),rowIds:Array.from({length:n},(_,i)=>'row-'+i),arrays};
}
const capture=(kind,raw)=>captureJointWorkIdentity(kind,raw,{maxCaptureBytes:32*1024*1024});
function consumer(kind,n,p,{id=kind,raw=input(kind,n,p),capacities=caps(n,p),identity=capture(kind,raw),reuseReceipt,overheadReserveBytes=0}={}){return {id,kind,sourceCount:n,packetCount:p,capacities,identity,overheadReserveBytes,...(reuseReceipt?{reuseReceipt}:{})};}
function plan(consumers,overrides={}){return planJointSmokeWork({consumers,budget:B(),maxMapPairs:1024,...overrides});}
function cover(cp){
  const hits=new Uint8Array(cp.completeOrderedCells);let pairs=0,raster=0;
  for(let j=0;j<cp.mapDraws;j++){const k=jointWorkChunkAt(cp,j);assert.ok(k.pairs<=1024);pairs+=k.pairs;raster+=k.rect.width*k.rect.height;if(k.neutral)continue;
    assert.equal(k.writes,k.end-k.begin);
    for(let y=k.rect.y;y<k.rect.y+k.rect.height;y++)for(let x=0;x<k.rect.width;x++){const address=y*k.rect.width+x;if(address<k.begin||address>=k.end)continue;assert.ok(address<hits.length);assert.equal(hits[address],0);hits[address]++;}
  }
  if(!cp.neutral)assert.ok(hits.every(v=>v===1));assert.equal(pairs,cp.neutral?0:cp.sourceCount*cp.packetCount);assert.ok(raster<=cp.work.rasterTexels);return {cells:hits.length,pairs,raster};
}

check('Explicit budgets, no aggregate defaults, invalid camera and untrusted completion flags reject',()=>{
  const c=consumer('main',16,65);assert.throws(()=>planJointSmokeWork({consumers:[c],maxMapPairs:1024}),/budget/);
  for(const key of Object.keys(B())){const b=B();delete b[key];assert.throws(()=>plan([c],{budget:b}));}
  const raw=input('main',1,1);raw.metadata.eye[0]=1;assert.throws(()=>capture('main',raw),/Camera identity/);
  assert.throws(()=>plan([{...c,reuseReceipt:{complete:true,actualGPU:true}}]),/branded verification-only/);
  assert.throws(()=>plan([{...c,identity:{...c.identity}}]),/captured full identity/);
  const nested={mutable:true},b=B({unknown:nested});assert.throws(()=>plan([c],{budget:b}),/primitive budget/);assert.equal(Object.isFrozen(nested),false);
  return {requiredBudgetFields:Object.keys(B()),noDefaultAggregateBudget:true};
});
check('Capture byte cap is checked before any payload cloning and captured typed arrays are private copies',()=>{
  const raw=input('main',16,65),old=Uint8Array.prototype.slice;let clones=0;
  Uint8Array.prototype.slice=function(...args){clones++;return old.apply(this,args);};
  try{assert.throws(()=>captureJointWorkIdentity('main',raw,{maxCaptureBytes:0}),/before cloning/);assert.equal(clones,0);}finally{Uint8Array.prototype.slice=old;}
  const a=capture('main',raw),original=capture('main',input('main',16,65));assert.equal(sameJointWorkIdentity(a,original),true);raw.arrays.endpoints64[0]+=1;assert.equal(sameJointWorkIdentity(a,original),true);assert.equal(sameJointWorkIdentity(a,capture('main',raw)),false);
  assert.equal(Object.hasOwn(a,'arrays'),false);assert.ok(Object.isFrozen(a));return {rejectedBeforeCloneCalls:clones,captureBytes:a.captureBytes};
});
check('Every original and packed array/profile/key participates in exact identity; kinds stay distinct',()=>{
  const base=capture('main',input('main',2,2));let mutations=0;
  for(const role of Object.keys(input('main',2,2).arrays)){const raw=input('main',2,2);raw.arrays[role][0]=role==='active'?0:raw.arrays[role][0]+1;assert.equal(sameJointWorkIdentity(base,capture('main',raw)),false,role);mutations++;}
  for(const field of ['profileIds','packetIds','rowIds']){const raw=input('main',2,2);raw[field][0]+='different';assert.equal(sameJointWorkIdentity(base,capture('main',raw)),false);mutations++;}
  for(const field of ['contextKey','kernelKey','densityKey','profileKey']){const raw=input('main',2,2);raw.metadata[field]+='different';assert.equal(sameJointWorkIdentity(base,capture('main',raw)),false);mutations++;}
  const negativeZero=input('main',2,2);negativeZero.metadata.planeY=-0;assert.equal(sameJointWorkIdentity(base,capture('main',negativeZero)),false);
  assert.equal(sameJointWorkIdentity(base,capture('mirror',input('mirror',2,2))),false);assert.equal(sameJointWorkIdentity(base,capture('resolved',input('resolved',2,2))),false);
  return {independentMutations:mutations,metadataNegativeZeroPreserved:true};
});
check('Tiny 16x65 model has complete disjoint tile cells, three draws and unchanged FP32 tile order',()=>{
  const c=consumer('main',16,65,{capacities:caps(16,65,3072)}),r=plan([c]),cp=r.consumers[0];assert.ok(r.supported);assert.deepEqual([cp.mapDraws,cp.reduceDraws,r.work.pairs,r.work.reductionReads],[2,1,1040,32]);const coverage=cover(cp);
  const original=[],chunked=[];
  for(let row=0;row<16;row++){const partials=[];for(let tile=0;tile<2;tile++){let sum=Math.fround(0);for(let p=tile*64;p<Math.min(65,tile*64+64);p++)sum=Math.fround(sum+Math.fround((row+1)*(p+1)*.000017));partials.push(sum);}original.push(Math.fround(Math.exp(-Math.fround(partials[0]+partials[1]))));}
  const cellValues=new Float32Array(cp.completeOrderedCells).fill(NaN);
  for(let j=0;j<cp.mapDraws;j++){const k=jointWorkChunkAt(cp,j);for(let address=k.begin;address<k.end;address++){const tile=Math.floor(address/16),row=address%16;let sum=Math.fround(0);for(let p=tile*64;p<Math.min(65,tile*64+64);p++)sum=Math.fround(sum+Math.fround((row+1)*(p+1)*.000017));cellValues[address]=sum;}}
  for(let row=0;row<16;row++)chunked.push(Math.fround(Math.exp(-Math.fround(cellValues[row]+cellValues[16+row]))));assert.deepEqual(chunked,original);assert.equal(r.effective,false);assert.equal(r.readyToPublish,false);return {...coverage,draws:r.work.draws,FP32OutputsEqual:16};
});
check('Coverage, guarded padding and incumbent neutral semantics at0/1/63/64/65 and row-wrap boundaries',()=>{
  let cases=0,cells=0;
  for(const kind of ['main','mirror','resolved'])for(const n of [0,1,15,16,17,255,256,257])for(const p of [0,1,63,64,65]){
    const r=plan([consumer(kind,n,p)]),cp=r.consumers[0];assert.ok(r.supported);const q=cover(cp);cases++;cells+=q.cells;
    if(cp.neutral){assert.equal(cp.reduceDraws,1);assert.equal(cp.mapDraws,kind==='resolved'?1:0);assert.equal(r.work.pairs,0);}
    if(kind==='resolved')assert.equal(cp.work.reductionReads,p*Math.max(1,Math.ceil(n/64))*3);
  }
  const zero=plan([consumer('resolved',0,4096)]),cp=zero.consumers[0],chunk=jointWorkChunkAt(cp,0);assert.equal(chunk.rect.width*chunk.rect.height,4096);assert.equal(zero.work.rasterTexels,8192);assert.equal(zero.work.reductionReads,12288);
  return {cases,cells,zeroResolved4096:{mapFragments:4096,totalFragments:8192,physicalReductionFetches:12288}};
});
check('Two870k views exceed explicit aggregate1m even if the ledger bake is exactly modeled-reused',()=>{
  const main=consumer('main',1740,500),mirror=consumer('mirror',1740,500),lightRaw=input('resolved',1728,500),lightIdentity=capture('resolved',lightRaw),lightCap=caps(1728,500),modeled=modelCompleteJointResult(lightIdentity,{resultKey:'sealed-CPU-model-only',capacities:lightCap}),light=consumer('resolved',1728,500,{capacities:lightCap,reuseReceipt:modeled});
  const r=plan([main,mirror,light],{maxMapPairs:1048576});assert.equal(r.supported,false);assert.equal(r.work.pairs,1740000);assert.equal(r.consumers[2].reusedModeledResult,true);assert.equal(r.consumers[2].work.draws,0);assert.ok(r.reasons.some(x=>x.reason==='aggregate-pairs-capacity'));assert.equal(r.reservedWork.pairs,0);assert.equal(r.distinctCapturedIdentities,4);
  const changed=input('resolved',1728,500);changed.arrays.ledger[0]+=.01;assert.throws(()=>plan([consumer('resolved',1728,500,{raw:changed,capacities:lightCap,reuseReceipt:modeled})]),/Reuse identity/);
  return {pairs:r.work.pairs,oldPerViewPairs:870000,modeledLedgerPairsAvoided:864000,capturedCopiesCharged:r.distinctCapturedIdentities,reservedPairs:0,productionAdmitted:r.productionAdmitted};
});
check('Reuse does not evade capture memory; same receipt is charged once and distinct full copies separately',()=>{
  const raw=input('main',2,2),a=capture('main',raw),b=capture('main',raw),cc=caps(2,2),modeled=modelCompleteJointResult(a,{resultKey:'modeled-complete',capacities:cc});
  const same=plan([consumer('main',2,2,{id:'a',identity:a}),consumer('main',2,2,{id:'b',identity:a,reuseReceipt:modeled})]);
  const distinct=plan([consumer('main',2,2,{id:'a',identity:a}),consumer('main',2,2,{id:'b',identity:b,reuseReceipt:modeled})]);assert.equal(same.distinctCapturedIdentities,1);assert.equal(distinct.distinctCapturedIdentities,2);assert.equal(distinct.capturedIdentityBytes-same.capturedIdentityBytes,a.captureBytes);assert.equal(distinct.ownedBytes-same.ownedBytes,a.captureBytes);
  const rejected=plan([consumer('main',2,2,{identity:b,reuseReceipt:modeled})],{budget:B({maxOwnedBytes:0})});assert.equal(rejected.supported,false);assert.equal(rejected.reservedWork.ownedBytes,0);return {sharedCaptureBytes:same.capturedIdentityBytes,distinctCopyBytes:distinct.capturedIdentityBytes,reusedIdentityStillCharged:true};
});
check('Physical reduction texture fetches, allocations, draw/upload/raster/memory caps are independently enforced',()=>{
  const c=consumer('resolved',65,16),r=plan([c]),cp=r.consumers[0];assert.equal(r.work.reductionReads,16*2*3);const incumbent=planSmokeLightTiles(0,0,{maxPackets:16,maxSources:65,maxBakePairs:1048576});assert.ok(cp.partialCapacity>=incumbent.partialCapacityTexels);
  for(const[key,value]of Object.entries({maxReductionReads:r.work.reductionReads-1,maxDraws:r.work.draws-1,maxUploadBytes:r.work.uploadBytes-1,maxRasterTexels:r.work.rasterTexels-1,maxOwnedBytes:r.ownedBytes-1})){const rejected=plan([c],{budget:B({[key]:value})});assert.equal(rejected.supported,false,key);assert.equal(rejected.reservedWork.pairs,0,key);}
  const s=consumer('main',65,64),sp=plan([s]).consumers[0],sl=planSmokeTransmissionLayout(65,64,s.capacities);assert.equal(sp.partialCapacity,sl.allocation.partial.width*sl.allocation.partial.height);return {physicalSHFetches:r.work.reductionReads,allIndependentCapsReject:true};
});
check('Old request gate stays at1m; rejected plans are atomic, counts and arithmetic cannot overflow',()=>{
  const rejected=plan([consumer('main',1734,755)],{budget:B({maxPairs:2000000}),maxMapPairs:1048576});assert.equal(rejected.supported,false);assert.ok(rejected.reasons.some(x=>x.reason==='old-per-request-pair-work-capacity'));assert.equal(rejected.reservedWork.pairs,0);
  const c=consumer('main',1,1);assert.throws(()=>plan([{...c,sourceCount:Number.MAX_SAFE_INTEGER}]),/safe integer/);assert.throws(()=>plan([{...c,overheadReserveBytes:Number.MAX_SAFE_INTEGER}]),/safe integer/);assert.throws(()=>plan([consumer('main',1,64)],{maxMapPairs:63}),/one original tile-row/);assert.throws(()=>plan([c],{budget:B({maxPairs:Infinity})}));
  const exact=plan([consumer('main',1024,1024)],{maxMapPairs:1048576});assert.ok(exact.supported);assert.equal(exact.work.pairs,1048576);assert.equal(exact.readyToPublish,false);return {unchangedOldCap:1048576,rejected755x1734:rejected.work.pairs,exactBoundaryAccepted:true};
});
check('Returned plans are private deeply frozen CPU models; main has no planner import and no partial publication exists',()=>{
  const c=consumer('main',16,65),budget=B(),r=plan([c],{budget});assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.consumers)&&Object.isFrozen(r.consumers[0].groups));assert.equal(Object.isFrozen(budget),false);assert.equal(r.actualGPU,false);assert.equal(r.productionAdmitted,false);assert.equal(r.effective,false);assert.equal(r.readyToPublish,false);assert.match(r.publication,/No texture publication/);
  assert.equal(fs.readFileSync(new URL('../main.js',import.meta.url),'utf8').includes('r24-joint-work-planner'),false);assert.throws(()=>jointWorkChunkAt(r.consumers[0],r.consumers[0].mapDraws));return {GPUDispatches:0,coordinatorImplemented:false,productionImportsOfPlanner:0};
});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,import.meta.url))).digest('hex');
const report={schema:'glass-atoll.r24-joint-work-planner-check.v1',passed:results.every(x=>x.passed),counts:{checks:results.length,passed:results.filter(x=>x.passed).length},actualGPU:false,browserActions:0,productionEdits:0,checks:results,SHA256:{planner:sha('./r24-joint-work-planner.js'),tests:sha('./r24-joint-work-planner-check.mjs')},limits:['Verification-only owned-input/accounting model, not a coordinator or GPU admission','Aggregate caps are explicit fixture inputs, not global defaults or permanent user requirements','No visual/performance claim or larger-request dispatch']};
fs.writeFileSync(new URL('./r24-joint-work-planner-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
