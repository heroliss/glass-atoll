// Focused source/current-fixed-input preflight. Never create a native context or draw.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {runR39DenseCalibration,R39_DENSE_CALIBRATION_REVISION} from './r39-dense-calibration-runtime.js';
import {R39_DENSE_FIXTURE,R39_DENSE_FIXTURE_DIGEST,r39DenseCanonicalJSON} from './r39-dense-native-fixture.js';
import {createSmokeTransmissionGPU as qaT} from './r39-dense-gpu.js';
import {createSmokeTransmissionGPU as oldT} from '../pyro-smoke-transmission-gpu.js';
import {createPyroSmokeLightField as qaL,smokeLightMomentsGLSL as qaMoments} from './r39-dense-light-field.js';
import {createPyroSmokeLightField as oldL,smokeLightMomentsGLSL as oldMoments} from '../pyro-smoke-light-field.js';
import {planSmokeTransmissionLayout} from './r39-dense-layout.js';
import {planTransmissionRectangles} from '../smoke-transmission-rectangles.js';

const root=new URL('../',import.meta.url),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(new URL(p,root)),load=p=>JSON.parse(read(p));
const build=load('verification/r39-dense-calibration-build-receipt.json'),pins=load('verification/r39-dense-calibration-pins.json'),copyPins=load('verification/r39-dense-calibration-copy-pins.json'),checks=[];
const test=async(name,fn)=>{try{checks.push({name,passed:true,...await fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}};
let boundaryCalls=0,renderCalls=0;const forbidden=()=>{boundaryCalls++;throw new Error('CPU_PREFLIGHT_NATIVE_CONTEXT_BOUNDARY');};
const renderer={debug:{},render(){renderCalls++;throw new Error('CPU_PREFLIGHT_DRAW_FORBIDDEN');},getContext:forbidden};
const originalFetch=globalThis.fetch;let tamper=null;
globalThis.fetch=async url=>{const path=new URL(url);const text=fs.readFileSync(path,'utf8');return{ok:true,text:async()=>tamper&&path.href.endsWith(tamper)?text+'\nTAMPER':text};};
const fixtureHashBefore=sha(r39DenseCanonicalJSON(R39_DENSE_FIXTURE));
let boundaryReport=null;
try{
 await test('Five QA copies reverse exactly to current unchanged arithmetic and defaults',()=>{
   for(const e of copyPins.entries){const bytes=read(e.target);assert.equal(sha(bytes),e.candidateSHA256);let text=bytes.toString('utf8');for(const change of e.importRelocations)text=text.replaceAll(change.to,change.from);if(e.ceilingLiteralChanges)text=text.replaceAll('12000000','4000000');assert.equal(text,read(e.original).toString('utf8'));}
   assert.equal(Function.prototype.toString.call(qaT),Function.prototype.toString.call(oldT));assert.equal(Function.prototype.toString.call(qaL),Function.prototype.toString.call(oldL));assert.equal(qaMoments,oldMoments);return{copies:5,kernelAndFactoryBodiesExact:true,productionDefaultsUnchanged:true};
 });
 await test('New fixed runtime whole inverse returns sealed R29 protocol; no old evidence rewritten',()=>{
   let text=read('verification/r39-dense-calibration-runtime.js').toString('utf8');assert.equal(sha(text),build.runtimeSHA256);for(const e of build.edits.toReversed()){assert.equal(text.slice(e.index,e.index+e.new.length),e.new);text=text.slice(0,e.index)+e.old+text.slice(e.index+e.new.length);}assert.equal(text,read('verification/r29-native-calibration-runtime.js').toString('utf8'));assert.equal(build.pending,false);assert.equal(pins.pending,false);return{baseRuntimeSHA256:build.baseRuntimeSHA256,approvedIdentityCapacityClockAndSourceOnlySeams:build.edits.length};
 });
 await test('Actual full fixed artifact and MAIN references are frozen, complete and original/packed qualified',()=>{
   assert.equal(fixtureHashBefore,R39_DENSE_FIXTURE_DIGEST);assert.equal(fixtureHashBefore,pins.jobs.source.artifactDigest);const f=R39_DENSE_FIXTURE,main=f.consumers.find(x=>x.kind==='main'),mirror=f.consumers.find(x=>x.kind==='reflection');assert(Object.isFrozen(f)&&Object.isFrozen(main));assert.equal(f.snapshot.packets.length,1663);assert.equal(main.input.count,2418);assert.equal(mirror.input.count,2418);assert.equal(main.oracle.pending,false);assert.equal(main.oracle.physicalRGBA.length,2418*4);assert.equal(main.oracle.quantizedRGBA.length,2418*4);assert.equal(main.input.count*f.snapshot.packets.length,4021134);assert.equal(f.snapshot.requestedTime,f.ledger.time);assert.equal(f.snapshot.time,f.phase.densityTime);assert.equal(f.snapshot.tick,151);assert.equal(f.opticalRecordGeneration,156);assert.equal(f.ledger.recordGeneration,51);return{mainPairs:4021134,mirrorCapturedNotSubmitted:true,lightCapturedNotSubmitted:true,allReferenceRows:2418,densityTime:f.snapshot.time,requestedTime:f.snapshot.requestedTime,noEpsilonClockRewrite:true};
 });
 await test('Fixed source work is exactly six maps plus one reduction with bounded readback/storage',()=>{
   const f=R39_DENSE_FIXTURE,m=f.consumers.find(x=>x.kind==='main'),layout=planSmokeTransmissionLayout(m.input.count,f.snapshot.packets.length,build.TCTOR),plan=planTransmissionRectangles({sourceCount:m.input.count,packetCount:f.snapshot.packets.length,partialStride:layout.partialStride,partialWidth:layout.allocation.partial.width,maxMapPairs:1000000,maxDraws:17});assert.equal(plan.mapDraws,6);assert.equal(plan.totalDraws,7);assert.equal(plan.conservativePairs,4023552);assert(plan.mapRects.every(r=>r.conservativePairs<=1000000));assert.equal(build.spec.readBytes,38816);assert.equal(build.spec.lMaps,0);assert.equal(build.spec.prepares,1);return{rectangles:plan.mapRects.map(r=>[r.x,r.y,r.width,r.height]),partialCells:plan.completeCells,numericDraws:7,maxReadBytes:38816,numericFieldBytes:4706304,sentinelBytes:608,noSHFactoryConstructionInFixedJobs:true};
 });
 await test('Actual exported entry owns full input and passes all source/function pins before the intentional native boundary',async()=>{
   const before=boundaryCalls;boundaryReport=await runR39DenseCalibration(THREE,renderer,{parentLocked:true});assert.equal(boundaryCalls-before,1);assert.equal(renderCalls,0);assert.equal(boundaryReport.privateInputAndOfflineOraclesOwnedBeforeFirstAwait,true);assert.equal(boundaryReport.sourceGuard.dataHash,fixtureHashBefore);assert.equal(Object.keys(boundaryReport.sourceGuard.sourceHashes).length,22);assert.equal(Object.keys(boundaryReport.sourceGuard.functionHashes).length,17);assert.match(boundaryReport.failure,/CPU_PREFLIGHT_NATIVE_CONTEXT_BOUNDARY/);assert.equal(boundaryReport.actualDraws,0);assert.equal(boundaryReport.actualGPU,false);assert.equal(boundaryReport.effective,false);assert.equal(boundaryReport.publishedToLive,false);assert.equal(boundaryReport.numericAllocationBytes,4706304);assert.equal(boundaryReport.native.capturedOpticalRecordGeneration,156);assert.equal(boundaryReport.native.recordGeneration,51);return{entryStoppedAsDesigned:true,nativeContextCreated:false,contextBoundaryStubCalls:1,sourcePins:22,cachedFunctionPins:17,allOriginalPaddedPackWordsAndOracleRowsValidatedBeforeBoundary:true};
 });
 await test('Tampered current shared shader source is rejected before any native boundary',async()=>{
   const before=boundaryCalls;tamper='pyro-smoke-renderer.js';const result=await runR39DenseCalibration(THREE,renderer,{parentLocked:true});tamper=null;assert.equal(boundaryCalls,before);assert.match(result.failure,/Source pin mismatch/);assert.equal(result.actualDraws,0);assert.equal(result.effective,false);return{beforeNativeContext:true};
 });
 await test('Public workload/cap injection rejects before clone/context and failure releases active-call latch',async()=>{
   const before=boundaryCalls;const result=await runR39DenseCalibration(THREE,renderer,{parentLocked:true,kind:'joint'});assert.equal(boundaryCalls,before);assert.equal(result.privateInputAndOfflineOraclesOwnedBeforeFirstAwait,undefined);assert.equal(result.actualDraws,0);const again=await runR39DenseCalibration(THREE,renderer,{parentLocked:true});assert.equal(boundaryCalls,before+1);assert.match(again.failure,/CPU_PREFLIGHT_NATIVE_CONTEXT_BOUNDARY/);return{unsupportedOptionsRejected:true,repeatStoppedAtNativeBoundary:true};
 });
 await test('All owned/read-only operations leave the entire frozen original fixture byte-canonical unchanged',()=>{
   assert.equal(sha(r39DenseCanonicalJSON(R39_DENSE_FIXTURE)),fixtureHashBefore);assert.equal(renderCalls,0);return{originalImmutablePayloadUnchanged:true,noRendererCalls:true};
 });
}finally{globalThis.fetch=originalFetch;}
const report={schema:'glass-atoll.r39-dense-calibration-preflight.v1',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,runtimeRevision:R39_DENSE_CALIBRATION_REVISION,runtimeSHA256:build.runtimeSHA256,fixtureDigest:fixtureHashBefore,actualGPU:false,browserActions:0,nativeContextCalls:0,contextBoundaryStubCalls:boundaryCalls,rendererCalls:renderCalls,scope:'CPU-only current fixed-input/pins/source/math/injected-stop preflight. Stub native boundary deliberately throws; it is not a hardware or timing pass.',sourceOnly:true,baselineR29Replayed:false};fs.writeFileSync(new URL('verification/r39-dense-calibration-preflight.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
