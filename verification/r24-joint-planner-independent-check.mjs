// Independent CPU-only review; never imports a renderer or creates a context.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {captureJointWorkIdentity,sameJointWorkIdentity,modelCompleteJointResult,planJointSmokeWork,jointWorkChunkAt} from './r24-joint-work-planner.js';

const budget={maxPairs:100000000,maxReductionReads:100000000,maxDraws:100000,maxUploadBytes:100000000,maxRasterTexels:100000000,maxOwnedBytes:100000000};
const capacities={maxSources:180,maxPackets:180,maxPairs:1048576};
function input(kind,n,p){
  const metadata={contextKey:'context-1',kernelKey:kind==='resolved'?'SH1-tiled64':'finite-column-tau',densityKey:'density-1',profileKey:'profiles-1',densityRevision:9,recordGeneration:12,densityTime:2,sourceTime:2};
  if(kind==='resolved')Object.assign(metadata,{ledgerKey:'ledger-1',ledgerVersion:3,rawPerCandela:3.6e-5,anisotropy:.32,bakeMode:'tiled64'});
  else Object.assign(metadata,{sourceVersion:4,shutterSeconds:1/120,planeY:0,reflection:kind==='mirror',eye:[0,2,4],cameraKey:'0,2,4'});
  const arrays={density64:new Float64Array(p*16),packedPackets:new Float32Array(p*(kind==='resolved'?4:16))};
  if(kind==='resolved')arrays.ledger=new Float32Array(n*8);
  else Object.assign(arrays,{origins64:new Float64Array(n*3),endpoints64:new Float64Array(n*3),active:new Uint8Array(n).fill(1),packedSources:new Float32Array(n*12)});
  for(const[role,a]of Object.entries(arrays))if(role!=='active')for(let i=0;i<a.length;i++)a[i]=i*.0001;
  return{sourceCount:n,packetCount:p,metadata,packetIds:Array.from({length:p},(_,i)=>'packet-'+i),profileIds:Array.from({length:p},()=> 'profile-1'),rowIds:Array.from({length:n},(_,i)=>'row-'+i),arrays};
}
function capture(kind,n,p){const data=input(kind,n,p);return{data,receipt:captureJointWorkIdentity(kind,data,{maxCaptureBytes:10000000})};}
function consumer(kind,n,p,{id=kind,caps=capacities,identity,reuseReceipt}={}){return{id,kind,sourceCount:n,packetCount:p,capacities:caps,identity:identity??capture(kind,n,p).receipt,overheadReserveBytes:4096,...(reuseReceipt?{reuseReceipt}:{})};}
function plan(consumers,patch={}){return planJointSmokeWork({consumers,budget,maxMapPairs:320,...patch});}
const checks=[];
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,...detail});}catch(error){checks.push({name,passed:false,error:String(error),stack:error.stack});}}

await check('private byte ownership, metadata ownership and unforgeable modeled receipts',()=>{
  const a=capture('main',5,65),b=capture('main',5,65);assert.equal(sameJointWorkIdentity(a.receipt,b.receipt),true);
  a.data.arrays.endpoints64[0]=999;a.data.metadata.eye[0]=20;a.data.metadata.cameraKey='20,2,4';a.data.rowIds[0]='changed';
  assert.equal(sameJointWorkIdentity(a.receipt,b.receipt),true);
  const changed=captureJointWorkIdentity('main',a.data,{maxCaptureBytes:10000000});assert.equal(sameJointWorkIdentity(changed,b.receipt),false);
  assert.throws(()=>sameJointWorkIdentity({...b.receipt},b.receipt));
  assert.throws(()=>plan([consumer('main',5,65,{identity:b.receipt,reuseReceipt:{actualGPU:true,effective:true}})]));
  return{isolatedBorrowedArrayMutation:true};
});
await check('cross-kind, main/mirror and capacity reuse isolation',()=>{
  const a=capture('main',5,65),b=capture('mirror',5,65),c=capture('resolved',5,65);assert.equal(sameJointWorkIdentity(a.receipt,b.receipt),false);assert.equal(sameJointWorkIdentity(a.receipt,c.receipt),false);
  const reuse=modelCompleteJointResult(a.receipt,{resultKey:'CPU model only',capacities});
  assert.throws(()=>plan([consumer('mirror',5,65,{identity:b.receipt,reuseReceipt:reuse})]));
  assert.throws(()=>plan([consumer('main',5,65,{identity:a.receipt,caps:{...capacities,maxPairs:1048575},reuseReceipt:reuse})]));
  const used=plan([consumer('main',5,65,{identity:a.receipt,reuseReceipt:reuse})]);assert.equal(used.supported,true);assert.deepEqual(used.work,{pairs:0,reductionReads:0,draws:0,uploadBytes:0,rasterTexels:0});assert.ok(used.ownedBytes>0);assert.equal(used.actualGPU,false);assert.equal(used.readyToPublish,false);assert.equal(used.effective,false);assert.equal(used.productionAdmitted,false);
});
await check('every aggregate cap rejects atomically, including captured and field bytes',()=>{
  const consumers=[consumer('main',16,65),consumer('mirror',17,64),consumer('resolved',18,65)],base=plan(consumers);assert.equal(base.supported,true);
  for(const[key,cap]of Object.entries({pairs:'maxPairs',reductionReads:'maxReductionReads',draws:'maxDraws',uploadBytes:'maxUploadBytes',rasterTexels:'maxRasterTexels'})){
    assert.ok(base.work[key]>0);const x=plan(consumers,{budget:{...budget,[cap]:base.work[key]-1}});assert.equal(x.supported,false);assert.ok(x.reasons.some(r=>r.reason==='aggregate-'+key+'-capacity'));assert.equal(x.reservedWork.pairs,0);assert.equal(x.reservedWork.ownedBytes,0);
  }
  const x=plan(consumers,{budget:{...budget,maxOwnedBytes:base.ownedBytes-1}});assert.equal(x.supported,false);assert.ok(x.reasons.some(r=>r.reason==='aggregate-owned-bytes-capacity'));assert.equal(x.reservedWork.ownedBytes,0);
  assert.equal(base.work.pairs,16*65+17*64+18*65);assert.equal(base.work.reductionReads,16*2+17+65*3);return{independentPairs:base.work.pairs,independentReductionReads:base.work.reductionReads};
});
await check('independent exact chunk coverage, pair cap and conservative padded raster charge',()=>{
  let cases=0,cells=0;const sizes=[[0,0],[0,65],[65,0],[1,1],[16,65],[63,64],[64,63],[65,65],[129,130],[130,129]];
  for(const kind of ['main','mirror','resolved'])for(const[n,p]of sizes)for(const limit of[64,127,320,1000]){
    const result=plan([consumer(kind,n,p)],{maxMapPairs:limit});assert.equal(result.supported,true);const c=result.consumers[0],seen=new Uint8Array(c.completeOrderedCells);let pairs=0,raster=0;
    for(let j=0;j<c.mapDraws&&c.groups.length;j++){
      const k=jointWorkChunkAt(c,j);assert.ok(k.pairs<=limit);assert.equal(k.writes,k.end-k.begin);assert.ok(k.rect.y*c.partialWidth<=k.begin);assert.ok((k.rect.y+k.rect.height)*c.partialWidth>=k.end);assert.ok(k.end<=c.partialCapacity);pairs+=k.pairs;raster+=k.rect.width*k.rect.height;
      for(let tile=k.tileBegin;tile<k.tileEnd;tile++)for(let row=k.rowBegin;row<k.rowEnd;row++){const i=tile*c.items+row;assert.ok(i>=k.begin&&i<k.end);assert.equal(seen[i],0);seen[i]++;cells++;}
      assert.equal(k.writes,(k.tileEnd-k.tileBegin)*(k.rowEnd-k.rowBegin));
    }
    if(n&&p){assert.equal(pairs,n*p);for(const v of seen)assert.equal(v,1);}else{assert.equal(result.work.pairs,0);if(kind==='resolved'){assert.equal(c.mapDraws,1);const zero=jointWorkChunkAt(c,0);assert.equal(zero.neutral,true);assert.equal(zero.pairs,0);assert.equal(zero.writes,zero.rect.width*zero.rect.height);assert.ok(zero.writes>=p);assert.ok(zero.writes<=c.partialCapacity);raster+=zero.writes;}else assert.equal(c.mapDraws,0);}
    assert.ok(result.work.rasterTexels>=raster);assert.throws(()=>jointWorkChunkAt(c,c.mapDraws));cases++;
  }
  return{cases,independentlyVisitedCells:cells};
});
await check('strict request caps, finite input and safe arithmetic',()=>{
  const x=plan([consumer('main',64,49,{caps:{...capacities,maxPairs:3072}})]);assert.equal(x.supported,false);assert.ok(x.reasons.some(r=>r.reason==='old-per-request-pair-work-capacity'));assert.equal(x.reservedWork.pairs,0);
  for(const bad of [NaN,Infinity,-1,.1,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>plan([consumer('main',1,1)],{budget:{...budget,maxPairs:bad}}));
  assert.throws(()=>plan([consumer('main',1,1),consumer('mirror',1,1)],{budget:{...budget,maxOwnedBytes:Number.MAX_SAFE_INTEGER},maxMapPairs:0}));
  const a=consumer('main',1,1);a.overheadReserveBytes=Number.MAX_SAFE_INTEGER;assert.throws(()=>plan([a]));
  const invalid=input('main',1,1);invalid.arrays.density64[0]=NaN;assert.throws(()=>captureJointWorkIdentity('main',invalid,{maxCaptureBytes:1000000}));assert.throws(()=>captureJointWorkIdentity('main',input('main',1,1),{maxCaptureBytes:0}));
  const shared=input('main',1,1);shared.arrays.origins64=new Float64Array(new SharedArrayBuffer(24));assert.throws(()=>captureJointWorkIdentity('main',shared,{maxCaptureBytes:1000000}));
});
await check('native complete-request threshold and declared count extrema stay bounded',()=>{
  const caps={maxSources:18000,maxPackets:4096,maxPairs:1048576};
  for(const kind of ['main','mirror','resolved']){
    const limitCaps=kind==='resolved'?{...caps,maxSources:14000}:caps;
    const accepted=plan([consumer(kind,256,4096,{caps:limitCaps})],{maxMapPairs:1048576});assert.equal(accepted.supported,true);assert.equal(accepted.work.pairs,1048576);const c=accepted.consumers[0];assert.ok(c.completeOrderedCells<=c.partialCapacity);assert.equal(c.mapDraws,1);
    const rejected=plan([consumer(kind,257,4096,{caps:limitCaps})],{maxMapPairs:1048576});assert.equal(rejected.supported,false);assert.ok(rejected.reasons.some(r=>r.reason==='old-per-request-pair-work-capacity'));assert.equal(rejected.reservedWork.pairs,0);
    const tooMany=input(kind,1,1);tooMany.sourceCount=limitCaps.maxSources+1;assert.throws(()=>captureJointWorkIdentity(kind,tooMany,{maxCaptureBytes:10000000}));tooMany.sourceCount=1;tooMany.packetCount=4097;assert.throws(()=>captureJointWorkIdentity(kind,tooMany,{maxCaptureBytes:10000000}));
  }
  assert.throws(()=>plan([consumer('main',1,64)],{maxMapPairs:63}));
  return{thresholdPairs:1048576,rejectedPairs:1052672,consumers:3};
});
await check('unknown budget extensions cannot alias or freeze caller-owned payloads',()=>{
  const payload={stillOwnedByCaller:true},given={...budget,extra:payload};let rejected=false,result;try{result=plan([consumer('main',1,1)],{budget:given});}catch{rejected=true;}
  assert.equal(Object.isFrozen(payload),false);assert.equal(Object.isFrozen(given),false);
  if(!rejected)assert.equal('extra'in result.budget,false);
});
await check('verification scope and frozen result without a production entry import',()=>{
  const x=plan([consumer('main',1,1)]);assert.equal(Object.isFrozen(x),true);assert.equal(Object.isFrozen(x.consumers[0]),true);assert.equal(x.verificationOnly,true);assert.equal(x.actualGPU,false);assert.equal(x.productionAdmitted,false);assert.equal(x.effective,false);assert.equal(x.readyToPublish,false);
  const source=fs.readFileSync(new URL('./r24-joint-work-planner.js',import.meta.url),'utf8');assert.equal(/\b(?:document|window|navigator|WebGLRenderer|WebGPURenderer)\b/.test(source),false,'No direct browser globals');assert.equal(/\.getContext\s*\(|\.render\s*\(|\.prepare\s*\(|\.bake\s*\(|\bfetch\s*\(/.test(source),false,'No graphics or network entry call');
  for(const file of fs.readdirSync(new URL('../',import.meta.url)))if(file.endsWith('.js')||file.endsWith('.html'))assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/r24-joint-work-planner/);
});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex');
const report={schema:'glass-atoll.r24-joint-planner-independent-check.v1',scope:'CPU accounting and private identity model only; no GPU/rendering/numerical optics acceptance',actualGPU:false,productionEdits:0,browserActions:0,checks,counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},passed:checks.every(x=>x.passed),sourceSHA256:hash('./r24-joint-work-planner.js'),audioSHA256:hash('../fireworks-audio.js')};
fs.writeFileSync(new URL('./r24-joint-planner-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failures:checks.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;
