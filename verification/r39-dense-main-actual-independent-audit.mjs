// Saved-data CPU audit only. Never invokes a renderer, browser or new physical replay.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {R39_DENSE_FIXTURE as fixture,R39_DENSE_FIXTURE_DIGEST as digest,r39DenseCanonicalJSON as canonical} from './r39-dense-native-fixture.js';
import {R39_DENSE_CALIBRATION_PINS as pins} from './r39-dense-calibration-pins.js';
import {createPyroSmokeColumns} from '../pyro-smoke-columns.js';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p).toString('utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),before=sha(read('verification/r39-dense-main-actual-gpu.json'));
const outer=json('verification/r39-dense-main-actual-gpu.json'),r=outer.report,main=fixture.consumers.find(v=>v.kind==='main'),job=r.jobs[0],raw=job.readback;
const checks=[];let recoveredOutput,partialEvidence=[],serialization,outputErrors;
function test(name,fn){try{checks.push({name,passed:true,...fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}}
const fromWords=w=>new Float32Array(new Uint32Array(w).buffer);
const floatWord=x=>new Uint32Array(new Float32Array([x]).buffer)[0];
function recover(values){
 const data=new Float32Array(values),words=new Uint32Array(data.buffer);let changed=0,maxAbsolute=0,maxFractionOfNearestHalfGap=0;
 for(let i=0;i<values.length;i++){
  const x=values[i],f=data[i];assert(Number.isFinite(x)&&Number.isFinite(f)&&x>=0);const difference=Math.abs(x-f);
  if(!Object.is(x,f))changed++;
  maxAbsolute=Math.max(maxAbsolute,difference);
  const w=words[i],up=fromWords([w+1])[0],down=w===0?-up:fromWords([w-1])[0],halfGap=Math.min(up-f,f-down)/2;
  assert(difference<halfGap,'Float32 recovery is not unique');maxFractionOfNearestHalfGap=Math.max(maxFractionOfNearestHalfGap,difference/halfGap);
 }
 return{data,summary:{values:values.length,nonExactTransportDecimals:changed,maxAbsoluteDecimalToNearestFloat32:maxAbsolute,maxFractionOfNearestHalfGap,wordSHA256:sha(new Uint8Array(data.buffer))}};
}

test('Saved actual receipt is one completed private MAIN job with intact fixed input identities',()=>{
 assert.equal(outer.status,'completed');assert.equal(outer.calls,1);assert.equal(outer.error,null);assert(r.passed&&r.actualGPU&&r.effective&&!r.publishedToLive);
 assert.deepEqual(r.counts,{passed:4,total:4});assert.equal(r.jobs.length,1);assert.equal(job.kind,'transmission');assert(job.fresh&&!job.reused);
 assert.equal(r.native.packets,1663);assert.equal(r.native.mainOpticalSources,2418);assert.equal(r.native.reflectionOpticalSources,2418);assert.equal(r.native.emissionSources,2413);
 assert.deepEqual(r.native.submittedConsumers,['main']);assert.deepEqual(r.native.unsubmittedConsumers,['reflection','light']);assert.equal(r.native.densityRevision,fixture.snapshot.revision);
 assert.deepEqual(r.native.phase,fixture.phase);assert.equal(r.native.densityCommittedTime,7.550000000000001);assert.equal(r.native.densityRequestedTime,7.55);assert.equal(r.native.ledgerTime,7.55);
 assert.equal(r.native.capturedOpticalRecordGeneration,156);assert.equal(r.native.recordGeneration,51);assert.equal(job.sourceVersion,101);assert.equal(job.snapshotRevision,3472);
 assert.equal(sha(canonical(fixture)),digest);assert.equal(r.sourceGuard.dataHash,digest);
 return{actualGPUReceipt:true,auditActualGPU:false,originalPackets:1663,allMainRows:2418,sourceVersion:101,densityRequestedVsCommittedDistinct:true,opticalGeneration:156,ledgerGeneration:51,mirrorAndSHPending:true};
});
test('Every saved source/function pin binds the fixed runtime, original model and immutable data',()=>{
 assert.deepEqual(r.sourceGuard.functionHashes,pins.functions);const expected={...pins.sources,...pins.jobs.source.sources};assert.deepEqual(r.sourceGuard.sourceHashes,expected);
 for(const [path,expectedHash]of Object.entries(expected))assert.equal(sha(fs.readFileSync(new URL(path,new URL('./',import.meta.url)))),expectedHash,path);
 assert.equal(sha(Function.prototype.toString.call(canonical)),pins.jobs.source.canonicalFunctionSHA256);
 return{sourcePins:Object.keys(expected).length,cachedFunctionPins:Object.keys(pins.functions).length,runtimeSHA256:pins.sources['./r39-dense-calibration-runtime.js'],approvedAudioSHA256:pins.sources['../fireworks-audio.js']};
});
test('ALL 2418 RGBA output rows recover unique Float32 words and meet both full reference gates',()=>{
 assert.equal(raw.outputPixels.length,2418*4);const recovered=recover(raw.outputPixels);recoveredOutput=recovered.data;serialization=recovered.summary;
 let physical=0,quantized=0,neutral=0,min=1,max=0;
 for(let row=0;row<2418;row++){
  for(let c=0;c<3;c++){const i=row*4+c,v=recoveredOutput[i];assert(v>=0&&v<=1);physical=Math.max(physical,Math.abs(v-main.oracle.physicalRGBA[i]));quantized=Math.max(quantized,Math.abs(v-main.oracle.quantizedRGBA[i]));min=Math.min(min,v);max=Math.max(max,v);}
  assert.equal(recoveredOutput[row*4+3],1);assert.equal(main.oracle.physicalRGBA[row*4+3],1);assert.equal(main.oracle.quantizedRGBA[row*4+3],1);
  if(main.input.active[row]===0){neutral++;assert(recoveredOutput.subarray(row*4,row*4+4).every(v=>v===1));}
 }
 assert(physical<=1e-5&&quantized<=8e-6);
 // Saved summary numbers also crossed by-value JSON transport. Check their
 // last-bit transport drift separately; full optical gates above are unchanged.
 const doubleWord=x=>new BigUint64Array(new Float64Array([x]).buffer)[0];
 const summaryMetricTransport=[['physical',physical,raw.maximumPhysicalTError],['quantized',quantized,raw.maximumGPUVsQuantizedDoubleTError]].map(([name,recomputed,saved])=>{const a=doubleWord(recomputed),b=doubleWord(saved),ulps=a>b?a-b:b-a;assert(ulps<=2n,'Summary decimal drift exceeds bounded transport qualification');return{name,recomputed,saved,binary64ULPDistance:Number(ulps)};});
 assert.equal(raw.validOutputRows,2418);assert.equal(raw.neutralRows,neutral);
 outputErrors={maximumOriginalDoubleError:physical,maximumPackedDoubleError:quantized,minimumRGB:min,maximumRGB:max,neutralRows:neutral};
 return{...outputErrors,serialization,summaryMetricTransport,scope:'Math.fround recovers the uniquely nearest original Float32 readback words after tool JSON decimal transport; this is not an epsilon physical-identity claim.'};
});
test('Eight ACTUAL partial addresses map to their own row/tile and independent bounded scalar-column references',()=>{
 const addresses=raw.partialSamples.map(x=>x.address);assert.deepEqual(addresses,[0,62867,60450,2417,15615,15616,31434,1]);assert.equal(new Set(addresses).size,8);
 const source=read('verification/r39-dense-native-fixture.mjs').toString('utf8'),line=source.split(/\r?\n/).find(x=>x.startsWith('function partialReference('));assert(line);
 // Reuse the existing independent binary64 scalar-column recipe at these eight
 // addresses, never zip against the different frozen fixture probe list.
 const reference=vm.runInNewContext('('+line+')',{createPyroSmokeColumns})(
  {packets:1663,packetData:fromWords(main.packing.packetWordsU32),sourceData:fromWords(main.packing.sourceWordsU32)},addresses,2418);
 let maxAbsoluteTauError=0,maxSliceTransmittanceError=0,packetQueriesUpperBound=0;
 partialEvidence=reference.map((ref,i)=>{
  const decoded=recover(raw.partialSamples[i].tauRGBA),gpu=Array.from(decoded.data);assert.equal(gpu[3],0);assert.equal(ref.tauRGBA[3],0);
  const errors=gpu.map((v,c)=>Math.abs(v-ref.tauRGBA[c]));for(let c=0;c<3;c++){maxAbsoluteTauError=Math.max(maxAbsoluteTauError,errors[c]);maxSliceTransmittanceError=Math.max(maxSliceTransmittanceError,Math.abs(Math.exp(-gpu[c])-Math.exp(-ref.tauRGBA[c])));}
  const row=ref.address%2418,tile=Math.floor(ref.address/2418);assert.equal(ref.row,row);assert.equal(ref.tile,tile);packetQueriesUpperBound+=Math.max(0,Math.min(64,1663-tile*64));
  const frozen=main.oracle.partialSamples.find(x=>x.address===ref.address);if(frozen)assert.deepEqual(Array.from(ref.tauRGBA),frozen.tauRGBA);
  return{address:ref.address,row,tile,actualFloat32TauRGBA:gpu,independentPackedDoubleTauRGBA:Array.from(ref.tauRGBA),absoluteTauErrorRGBA:errors,matchedExistingFixtureAddress:!!frozen,serialization:decoded.summary};
 });
 assert(packetQueriesUpperBound<=512);assert(maxAbsoluteTauError<=1e-5&&maxSliceTransmittanceError<=8e-6);
 return{addresses,independentReferences:8,packetQueriesUpperBound,maxAbsoluteTauError,maxSliceTransmittanceError,engineeringGate:{absoluteTau:1e-5,sliceTransmittance:8e-6,relativeGate:false},scope:'Additional offline bounded-address audit only. In-browser runtime partial validation was finite/nonnegative/alpha sanity, not this numerical oracle. No relative accuracy is asserted near underflow; no full partial texture or general tau bound is certified.'};
});
test('Exact complete schedule, allocation and retrospective timer remain within this one-job contract',()=>{
 assert.equal(r.actualDraws,7);assert.equal(r.renderPasses,7);assert.equal(r.prepares,1);assert.equal(r.readbackBytes,38816);assert.equal(job.readbackBytes,38816);
 assert.deepEqual(r.draws.map(x=>x.rect),[...main.policy.mapPlan.mapRects.map(x=>[x.x,x.y,x.width,x.height]),[0,0,256,10]]);assert(r.draws.every(x=>x.actualDraws===1));
 assert.equal(job.diagnostics.pairs,4021134);assert.equal(job.diagnostics.mapPlan.conservativePairs,4023552);assert.equal(job.diagnostics.mapPlan.completeCells,62868);assert.equal(job.diagnostics.gpuNumericalBytes,4706304);assert.equal(r.numericAllocationBytes,4706304);assert.equal(r.qaSentinelNumericBytes,608);
 assert.deepEqual(job.diagnostics.caps,{maxMapDraws:16,maxMapPairs:1000000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:12000000,maxSources:18000});
 const q=r.timedIntervals;assert.equal(q.length,1);assert(q[0].ready&&!q[0].disjoint&&q[0].gpuMs<=25);assert.equal(q[0].gpuMs,2.864128);assert.equal(q[0].actualDraws,7);assert.equal(q[0].prepares,1);
 return{actualDraws:7,prepares:1,logicalPairs:4021134,complete64Slots:4023552,readBytes:38816,numericalGpuBytes:4706304,sentinelBytes:608,retrospectiveGpuMs:q[0].gpuMs,coldInstrumentedCpuSubmitMs:r.cpuSubmitMs,noFullFrameOrSpeedupClaim:true};
});
test('Saved full native-state/descriptor restoration and GL health are clean; raw receipt stays immutable',()=>{
 assert.deepEqual(r.glErrors,[]);assert.deepEqual(r.shaderErrors,[]);assert(r.checks.every(x=>x.passed));assert(r.checks.some(x=>x.name==='instrumentation descriptors restored without own-property leftovers'&&x.passed));assert(r.checks.some(x=>x.name==='outer supported Three/native READ/DRAW/MRT/PACK/UNPACK/PBO/COPY_READ state restored'&&x.passed));
 assert.equal(sha(read('verification/r39-dense-main-actual-gpu.json')),before);
 return{savedStateReceiptPassed:true,savedDescriptorReceiptPassed:true,glErrors:0,shaderErrors:0,originalActualReceiptUnchanged:true,independentLiveStateReinspection:false};
});
const result={schema:'glass-atoll.r39-dense-main-saved-actual-independent-audit.v1',passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},auditActualGPU:false,browserUsed:false,physicalReplay:false,rawGpuReceiptActualGPU:r.actualGPU,rawReceiptSHA256:before,fixtureDigest:digest,sourceSHA256:sha(read('verification/r39-dense-main-actual-independent-audit.mjs')),checks,additionalActualAddressPartialReferences:partialEvidence,limits:['Saved MAIN SourceT numerical output only; mirror and SH remain unsubmitted/pending; no joint/full-frame/FPS/visual approval.','New CPU work is arithmetic over all saved output rows plus at most512 scalar packet queries for actual partial addresses; no all-pair reference rerun.','Float32 recovery addresses by-value JSON decimal transport and does not certify exact raw text, signed-zero transport, or universal engine equality.','State/descriptor/GL health are independently audited saved receipts, not a new live renderer check.']};
fs.writeFileSync(new URL('verification/r39-dense-main-actual-independent-audit.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,counts:result.counts,failed:checks.filter(x=>!x.passed),outputErrors,partial:checks.find(x=>x.name.startsWith('Eight ACTUAL'))},null,2));if(!result.passed)process.exitCode=1;
