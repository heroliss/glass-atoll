// Read-only CPU audit of saved root-owned GPU receipts. Does not dispatch GL.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {R29_CALIBRATION_PINS as pins} from './r29-native-calibration-pins.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[],receipts={};
async function check(name,fn){try{checks.push({name,passed:true,evidence:(await fn())??null});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}}
const capT={maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8},capL={maxPackets:4096,maxSources:14000,maxBakePairs:1048576,maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8,anisotropy:.32,bakeMode:'tiled64'};
const specs={source:[5,1,21984,2707456],light:[6,1,110832,3919872],joint:[10,2,122832,6627328]};
for(const kind of ['source','light','joint'])await check('Saved '+kind+' receipt binds exact frozen production inputs, caps, complete rectangles, freshness and state',async()=>{
  const path='./r29-'+kind+'-peak-actual-gpu.json',text=read(path),r=JSON.parse(text),m=await import('./r29-native-phase-'+kind+'-peak.js'),a=m.R29_NATIVE_PHASE_FIXTURE,[draws,prepares,bytes,numericBytes]=specs[kind];receipts[kind]={r,a,path,SHA256:sha(text)};
  assert.equal(r.schema,'glass-atoll.r29-native-lifetime-GPU.v1');assert.equal(r.job,kind);assert.equal(r.runtimeRevision,pins.runtimeRevision);
  assert.equal(r.actualGPU,true);assert.equal(r.passed,true);assert(!r.failure);assert(!r.stopped);assert.deepEqual(r.shaderErrors,[]);assert.deepEqual(r.glErrors,[]);
  assert(r.checks.every(x=>x.passed));assert.deepEqual(r.counts,{passed:r.checks.length,total:r.checks.length});
  assert(r.checks.some(x=>x.name==='instrumentation descriptors restored without own-property leftovers'));
  assert(r.checks.some(x=>x.name==='outer supported Three/native READ/DRAW/MRT/PACK/UNPACK/PBO/COPY_READ state restored'));
  assert.equal(r.privateInputAndOfflineOraclesOwnedBeforeFirstAwait,true);assert.equal(r.native.sameGenerationOwned,true);assert.deepEqual(r.native.phase,a.phase);
  assert.equal(r.native.densityRevision,a.snapshot.revision);assert.equal(r.native.packets,a.snapshot.packets.length);assert.equal(r.native.emissionSources,a.ledger.count);assert.equal(r.native.recordGeneration,a.ledger.recordGeneration);assert.equal(r.native.ledgerVersion,a.ledger.version);assert.equal(r.native.ledgerTime,a.ledger.time);
  assert.deepEqual(r.native.otherConsumers,a.consumers.map(x=>({kind:x.kind,count:x.input.count,requested:x.requested,submitted:x.submitted})));
  assert.equal(r.native.otherConsumers[1].count,0);assert.equal(r.native.otherConsumers[1].submitted,false);
  assert.equal(r.sourceGuard.dataHash,pins.jobs[kind].artifactDigest);assert.equal(sha(m.r29CanonicalJSON(a)),r.sourceGuard.dataHash);
  assert.deepEqual(r.sourceGuard.sourceHashes,{...pins.sources,...pins.jobs[kind].sources});assert.deepEqual(r.sourceGuard.functionHashes,pins.functions);
  for(const [p,h]of Object.entries(r.sourceGuard.sourceHashes))assert.equal(sha(read(p)),h,p);
  assert.deepEqual(r.caps.transmission,capT);assert.deepEqual(r.caps.light,capL);assert.equal(r.caps.maxActualDraws,draws);assert.equal(r.caps.maxPrepares,prepares);assert.equal(r.caps.maxReadbackBytes,bytes);assert.equal(r.caps.maxPartialSamplesPerKernel,8);
  assert.equal(r.actualDraws,draws);assert.equal(r.renderPasses,draws);assert.equal(r.prepares,prepares);assert.equal(r.readbackBytes,bytes);assert.equal(r.numericAllocationBytes,numericBytes);assert.equal(r.qaSentinelNumericBytes,608);assert.equal(r.jobs.length,prepares);
  assert.equal(r.timedIntervals.length,1);const q=r.timedIntervals[0];assert.equal(q.ready,true);assert.equal(q.disjoint,false);assert(Number.isFinite(q.gpuMs)&&q.gpuMs>=0&&q.gpuMs<=25);assert.equal(q.actualDraws,draws);assert.equal(q.renderPasses,draws);assert.equal(q.prepares,prepares);assert.equal(q.cpuSubmitMs,r.cpuSubmitMs);assert(Number.isFinite(r.cpuSubmitMs)&&r.cpuSubmitMs>=0);
  assert.equal(r.capture.maxDeclaredBytes,100663296);assert(r.capture.declaredReservation<r.capture.maxDeclaredBytes);
  const expected=[],main=a.consumers.find(x=>x.kind==='main');let decodedBytes=0;
  for(const j of r.jobs){
    assert(j.fresh&&!j.reused);assert.equal(j.snapshotRevision,a.snapshot.revision);assert.equal(j.diagnostics.effective,true);const d=j.diagnostics;
    if(j.kind==='transmission'){
      assert.equal(d.prepares,1);assert.equal(d.count,main.input.count);assert.equal(d.sourceVersion,main.input.sourceVersion);assert.equal(d.densityRevision,a.snapshot.revision);assert.deepEqual(d.caps,capT);assert.equal(d.gpuNumericalBytes,2707456);
      const rects=main.policy.mapPlan.mapRects.map(x=>[x.x,x.y,x.width,x.height]),z=main.policy.layout.outputDraw;rects.push([z.x,z.y,z.width,z.height]);
      rects.forEach((rect,index)=>expected.push({job:j.kind,index,kind:index===rects.length-1?'reduce':'map',rect,actualDraws:1}));assert.equal(d.draws,rects.length);
      decodedBytes+=(j.readback.outputPixels.length+j.readback.partialSamples.flatMap(x=>x.tauRGBA).length)*4;assert.equal(j.sourceVersion,main.input.sourceVersion);assert.equal(j.ledgerVersion,null);
    }else{
      assert.equal(j.kind,'light');assert.equal(d.reused,false);assert.equal(d.bakes,1);assert.equal(d.packetCount,a.snapshot.packets.length);assert.equal(d.sourceCount,a.ledger.count);assert.equal(d.ledgerVersion,a.ledger.version);assert.equal(d.maxRequestPairs,4000000);assert.equal(d.maxMapPairs,1000000);assert.equal(d.maxMapDraws,8);assert.equal(d.tiled.allocatedBytes,3919872);assert.equal(j.recordGeneration,a.ledger.recordGeneration);
      const rects=a.light.policy.mapRects.map(x=>[x.x,x.y,x.width,x.height]);rects.push([0,0,...a.light.policy.finalSize]);rects.forEach((rect,index)=>expected.push({job:j.kind,index,kind:index===rects.length-1?'reduce':'map',rect,actualDraws:1}));assert.equal(d.bakePasses,rects.length);
      decodedBytes+=(j.readback.attachmentsRGBA.flat().length+j.readback.partialSamples.flatMap(x=>x.attachmentsRGBA.flat()).length)*4;
    }
    assert.equal(j.readback.partialSamples.length,8);
  }
  assert.deepEqual(r.draws,expected);assert.equal(decodedBytes,bytes);assert.equal(r.jobs.reduce((n,j)=>n+j.readbackBytes,0),bytes);
  for(const x of expected.filter(x=>x.kind==='map'))assert(x.rect[2]*x.rect[3]*64<=1000000);
  return{path,SHA256:sha(text),phase:a.phase,draws,prepares,readBytes:bytes,gpuMs:q.gpuMs,coldInstrumentedSubmitMs:r.cpuSubmitMs,numericBytes,fresh:true,mirrorSubmitted:false};
});
await check('Saved complete final values retain all native rows, finite Float32 words and signed SH; recorded error/bound summaries agree',()=>{
  const out=[];
  for(const [kind,{r,a}]of Object.entries(receipts))for(const j of r.jobs){const v=j.readback;
    if(j.kind==='transmission'){
      const ref=a.consumers.find(x=>x.kind==='main'),n=ref.input.count;assert.equal(v.outputPixels.length,n*4);assert.equal(v.validOutputRows,n);
      let physical=0,quantized=0;for(let i=0;i<n;i++)for(let c=0;c<4;c++){const x=v.outputPixels[i*4+c];assert(Object.is(Math.fround(x),x)||x===0);if(c===3)assert.equal(x,1);else{assert(x>=0&&x<=1);physical=Math.max(physical,Math.abs(x-ref.oracle.physicalRGBA[i*4+c]));quantized=Math.max(quantized,Math.abs(x-ref.oracle.quantizedRGBA[i*4+c]));}}
      assert.equal(v.maximumPhysicalTError,physical);assert.equal(v.maximumGPUVsQuantizedDoubleTError,quantized);assert(physical<=1e-5&&quantized<=8e-6);out.push({kind,kernel:j.kind,rows:n,physical,quantized});
    }else{
      const n=a.snapshot.packets.length;assert.equal(v.validPacketRows,n);assert.equal(v.coefficientWords,n*12);assert.equal(v.attachmentsRGBA.length,3);let e0=0,e1=0,negative=0,fourthNegative=0,min=Infinity,max=0,ratio=0;
      for(let i=0;i<n;i++){const ref=a.light.oracle.rows[i],scale=Math.max(...ref.C0,1e-30);for(let c=0;c<3;c++){const s=v.attachmentsRGBA[c].slice(i*4,i*4+4);assert.equal(v.attachmentsRGBA[c].length,n*4);assert(s.every(x=>Number.isFinite(x)&&(Object.is(Math.fround(x),x)||x===0)));const len=Math.hypot(s[1],s[2],s[3]);e0=Math.max(e0,Math.abs(s[0]-ref.C0[c])/scale);e1=Math.max(e1,Math.hypot(s[1]-ref.C1[c*3],s[2]-ref.C1[c*3+1],s[3]-ref.C1[c*3+2])/scale);negative+=s.slice(1).filter(x=>x<0).length;fourthNegative+=s[3]<0?1:0;min=Math.min(min,s[0]-len);max=Math.max(max,s[0]+len);ratio=Math.max(ratio,(s[0]+len)/Math.max(a.light.idealGroupBound.rows[i][c],1e-30));}}
      assert.equal(v.maximumC0ErrorOverPeakReferenceC0,e0);assert.equal(v.maximumC1VectorErrorOverPeakReferenceC0,e1);assert.equal(v.signedNegativeComponents,negative);assert.equal(v.minimumAngular,min);assert.equal(v.maximumActualAngular,max);assert.equal(v.maximumOwnGroupRatio,ratio);assert(negative>0&&fourthNegative>0&&min>=0&&e0<=.002&&e1<=.002&&ratio<=1.003&&max<=a.light.rawBound.maxRGB);
      out.push({kind,kernel:j.kind,rows:n,coefficients:n*12,e0,e1,negative,fourthNegative,minAngular:min,maxAngular:max,maximumOwnGroupRatio:ratio});
    }
  }
  return out;
});
await check('The joint evidence is one coherent fresh compute job, with no scene/mirror/FPS or accumulated-workload admission',()=>{
  const {r,a}=receipts.joint;assert.equal(r.jobs.length,2);assert.equal(r.native.mainOpticalSources,871);assert.equal(r.native.emissionSources,1431);assert.notEqual(r.native.mainOpticalSources,r.native.emissionSources);assert.equal(r.jobs[0].sourceVersion,r.jobs[1].recordGeneration);assert.equal(r.jobs[0].snapshotRevision,r.jobs[1].snapshotRevision);assert.equal(r.jobs[1].ledgerVersion,a.ledger.version);assert.equal(r.native.ledgerTime,a.phase.time);assert.equal(r.native.phase.densityTime,a.snapshot.time);assert.equal(r.timedIntervals.length,1);assert(r.limits.some(x=>x.includes('NOT a complete evolving frame/FPS/visual acceptance')));assert(r.limits.some(x=>x.includes('retrospective')));return{sameGenerationOwned:r.native.sameGenerationOwned,Tpairs:2258*871,SHpairs:2258*1431,totalPairs:2258*(871+1431),wholeGPUms:r.timedIntervals[0].gpuMs,coldInstrumentedCPUms:r.cpuSubmitMs,mirrorRows:0,fullFrameAdmitted:false};
});
const report={schema:'glass-atoll.r29-actual-job-receipts-independent-audit.v1',dateUTC:new Date().toISOString(),actualGPUByThisAudit:false,sourceGPUReceipts:true,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},runtimeSHA256:sha(read('./r29-native-calibration-runtime.js')),pinsModuleSHA256:sha(read('./r29-native-calibration-pins.js')),pinsManifestSHA256:sha(read('./r29-native-calibration-pins.json')),checks,limits:['Saved exact PAGEJSON receipts only; no GPU retry, context, browser or source change. Root owns the actual GPU submissions.','Final row/error/raw-bound summaries are independently recalculated from the stored offline references. Independent quadrature and partial reconstruction belong to the separate motion-agent numerical audit.','These fixed zero-mirror numerical compute jobs do not measure a complete normal scene, evolving frame rate or two-event accumulation. Cold instrumented CPU submission and GPU query durations are different scopes.']};
fs.writeFileSync(new URL('./r29-actual-job-receipts-independent-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed),checks:checks.filter(x=>x.passed).map(x=>({name:x.name,evidence:x.evidence}))},null,2));if(!report.passed)process.exitCode=1;
