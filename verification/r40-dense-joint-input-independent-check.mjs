// Full saved-array/identity/work audit only; no physical replay, oracle rerun or GL.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {R39_DENSE_JOINT_FIXTURE as f,R39_DENSE_JOINT_FIXTURE_DIGEST as digest,r39DenseCanonicalJSON as canonical} from './r39-dense-joint-fixture.js';
import {R39_DENSE_FIXTURE as original,R39_DENSE_FIXTURE_DIGEST as oldDigest} from './r39-dense-native-fixture.js';
import {captureR39DenseJointEpoch,planR39DenseJointWork,R39_DENSE_JOINT_HARD_CAPS} from './r39-dense-joint-planner.js';
import {packSmokeLightPackets} from '../pyro-smoke-light-field.js';
import {boundSmokeLightField} from '../pyro-smoke-light-bound.js';
import {groupBoundOracle} from './pyro-smoke-light-field-oracle.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const generation=JSON.parse(read('verification/r39-dense-remaining-reference.json')),main=f.consumers.find(c=>c.kind==='main'),mirror=f.consumers.find(c=>c.kind==='reflection'),checks=[];
const floats=w=>new Float32Array(new Uint32Array(w).buffer),words=a=>Array.from(new Uint32Array(a.buffer,a.byteOffset,a.length));
const test=(name,fn)=>{try{checks.push({name,passed:true,...fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}};
let newPlan,originalCopyDigest;

test('New complete literal preserves original MAIN and every original physical/ledger value exactly',()=>{
 assert.equal(sha(read('verification/r39-dense-joint-fixture.js')),generation.moduleSHA256);assert.equal(sha(read('verification/r39-dense-joint-fixture.json')),generation.jsonSHA256);
 assert.equal(sha(canonical(f)),digest);assert.equal(digest,generation.canonicalDigest);assert.equal(sha(canonical(original)),oldDigest);
 assert.equal(canonical(main),canonical(original.consumers.find(c=>c.kind==='main')));
 for(const k of ['snapshot','ledger','currentEmissionRecords','physicalEvents','phase','scheduler','stateDiagnostics'])assert.equal(canonical(f[k]),canonical(original[k]),k);
 originalCopyDigest=sha(canonical({snapshot:f.snapshot,ledger:f.ledger,currentEmissionRecords:f.currentEmissionRecords,physicalEvents:f.physicalEvents}));assert.equal(originalCopyDigest,generation.physicalDigest);
 for(const [path,hash]of Object.entries(generation.sourcePins))assert.equal(sha(read(path)),hash,path);
 assert.equal(f.snapshot.requestedTime,7.55);assert.equal(f.phase.time,7.55);assert.equal(f.ledger.time,7.55);assert.equal(f.snapshot.time,7.550000000000001);assert.equal(f.phase.densityTime,f.snapshot.time);assert.equal(f.opticalRecordGeneration,156);assert.equal(f.ledger.recordGeneration,51);
 return{originalMAINExact:true,wholePhysicalEpochExact:true,physicalDigest:originalCopyDigest,requestedAndCommittedClocksSeparate:true,opticalGeneration:156,ledgerGeneration:51,cpuReferencesOnly:true};
});
test('All distinct view rays/ordering/masks and complete physical/quantized T references retain per-eye identity',()=>{
 let differingReferenceComponents=0;const summaries=[];
 for(const c of [main,mirror]){
  const old=original.consumers.find(x=>x.kind===c.kind);for(const k of ['input','orderedSources','captureMetadata','policy','packing'])assert.equal(canonical(c[k]),canonical(old[k]),c.kind+'.'+k);
  assert.equal(c.input.count,2418);assert.equal(c.input.active.length,2418);assert(c.input.active.every(x=>x===1));assert.equal(c.orderedSources.length,2418);
  for(let row=0;row<2418;row++)assert.deepEqual(c.input.endpoints64.slice(row*3,row*3+3),c.orderedSources[row].position);
  assert.equal(c.captureMetadata.sourceTransmission.recordsGeneration,156);assert.equal(c.input.sourceVersion,c.kind==='main'?101:102);assert.equal(c.input.densityRevision,3472);
  assert.equal(c.oracle.pending,false);let min=1,maxDifference=0;
  for(const key of ['physicalRGBA','quantizedRGBA']){assert.equal(c.oracle[key].length,9672);for(let i=0;i<9672;i++){const x=c.oracle[key][i];assert(Number.isFinite(x)&&x>=0&&x<=1);if(i%4===3)assert.equal(x,1);min=Math.min(min,x);}}
  for(let i=0;i<9672;i++)maxDifference=Math.max(maxDifference,Math.abs(c.oracle.physicalRGBA[i]-c.oracle.quantizedRGBA[i]));
  assert(maxDifference<=1e-5);summaries.push({kind:c.kind,sourceVersion:c.input.sourceVersion,rows:2418,minT:min,maximumOriginalVsPackedDoubleDifference:maxDifference});
 }
 assert.notEqual(main.input.cameraKey,mirror.input.cameraKey);assert.notEqual(canonical(main.input.origins64),canonical(mirror.input.origins64));assert.notEqual(canonical(main.input.endpoints64),canonical(mirror.input.endpoints64));
 for(let i=0;i<9672;i++)if(!Object.is(main.oracle.physicalRGBA[i],mirror.oracle.physicalRGBA[i]))differingReferenceComponents++;
 assert(differingReferenceComponents>0);return{summaries,differingReferenceComponents,noMAINReferenceSubstitution:true};
});
test('Complete packed SH inputs, all groups and raw/ideal bounds recompute without packet mass',()=>{
 const packed=packSmokeLightPackets(f.snapshot,{capacity:4096,version:f.light.packing.packetVersion});assert.deepEqual(words(packed.data),f.light.packing.packedPacketWordsU32);
 const packetUpload=new Float32Array(16384),sourceUpload=new Float32Array(112640),data=floats(f.ledger.dataWordsU32);packetUpload.set(packed.data);sourceUpload.set(data.subarray(0,f.ledger.count*8));
 assert.deepEqual(words(packetUpload),f.light.packing.packetUploadWordsU32);assert.deepEqual(words(sourceUpload),f.light.packing.sourceUploadWordsU32);assert.equal(data.length,112000);
 const ledger={...f.ledger,data},raw=boundSmokeLightField({ledger,packets:packed,anisotropy:.32}),ideal=groupBoundOracle(packed,ledger,{g:.32});assert.deepEqual(raw,f.light.rawBound);assert.deepEqual(ideal,f.light.idealGroupBound);
 const alternate={...f.snapshot,packets:f.snapshot.packets.map((p,i)=>({...p,mass:i%2?0:1e20}))};assert.deepEqual(words(packSmokeLightPackets(alternate,{capacity:4096,version:1}).data),words(packed.data));
 assert.equal(raw.diagnostics.packetMassUsed,false);assert.equal(raw.margin.shaderRelativeError,.002);assert.equal(raw.ledgerVersion,51);assert.equal(raw.diagnostics.groups,2);
 return{fullPaddedLedgerWords:112000,packetUploadWords:16384,sourceUploadWords:112640,groupRows:f.ledger.groups.reduce((n,g)=>n+g.count,0),rawBound:raw.maxRGB,idealBound:ideal.maximumRawRadiance,packetMassIndependent:true};
});
test('ALL 19956 reference coefficients retain signed fourth components, row association and positive angular/group bounds',()=>{
 const o=f.light.oracle;assert(!o.pending&&o.authorized);assert.equal(o.nodes,256);assert.equal(o.rows.length,1663);assert.equal(o.attachmentsRGBA.length,3);let negatives=0,negativeFourth=0,minimum=Infinity,maximum=0,ownRatio=0;
 for(let i=0;i<1663;i++){
  const row=o.rows[i];assert.equal(row.index,i);assert.equal(row.C0.length,3);assert.equal(row.C1.length,9);
  for(let c=0;c<3;c++){
   const a=o.attachmentsRGBA[c];assert.equal(a.length,6652);const expected=[row.C0[c],...row.C1.slice(c*3,c*3+3)];assert.deepEqual(a.slice(i*4,i*4+4),expected);assert(expected.every(Number.isFinite));assert(expected[0]>=0);
   const radius=Math.hypot(...expected.slice(1)),lo=expected[0]-radius,hi=expected[0]+radius;assert.equal(lo,row.minimum[c]);assert.equal(hi,row.maximum[c]);assert(lo>=0);assert(hi<=f.light.idealGroupBound.rows[i][c]*1.003);assert(hi<=f.light.rawBound.maxRGB);
   minimum=Math.min(minimum,lo);maximum=Math.max(maximum,hi);ownRatio=Math.max(ownRatio,hi/Math.max(f.light.idealGroupBound.rows[i][c],1e-30));negatives+=expected.slice(1).filter(v=>v<0).length;if(expected[3]<0)negativeFourth++;
  }
 }
 assert.equal(negatives,9504);assert.equal(negativeFourth,3703);assert.equal(minimum,o.minimumAngular);assert.equal(maximum,o.maximumAngular);assert.equal(ownRatio,o.maximumOwnGroupBoundRatio);assert.deepEqual(o.colouredSentinel,o.rows[o.colouredSentinel.index]);
 let witnessError=0;for(const w of o.convergence.witnesses){const base=o.rows[w.index],hi=w.reference512,scale=Math.max(...base.C0,1e-30);let local=0;for(let c=0;c<3;c++){local=Math.max(local,Math.abs(base.C0[c]-hi.C0[c])/scale);for(let k=0;k<3;k++)local=Math.max(local,Math.abs(base.C1[c*3+k]-hi.C1[c*3+k])/scale);}assert.equal(local,w.maximumNormalizedCoefficientDifference);witnessError=Math.max(witnessError,local);}assert.equal(witnessError,o.convergence.maximumNormalizedCoefficientDifference);assert(witnessError<2e-6);
 return{coefficients:19956,negativeC1:negatives,negativeFourthChannels:negativeFourth,minimumAngular:minimum,maximumAngular:maximum,maximumOwnGroupRatio:ownRatio,selectedStored256vs512:witnessError,noCoefficientClampOrAlphaInterpretation:true,oracleRecomputed:false};
});
test('Stored partial probes use exact global addresses and original64 accumulation, never index-zipped across consumers',()=>{
 const sets=[];for(const c of [main,mirror]){const p=c.oracle.partialSamples,n=c.input.count;assert.equal(p.length,8);assert.equal(new Set(p.map(x=>x.address)).size,8);for(const s of p){assert(s.address>=0&&s.address<c.policy.mapPlan.completeCells);assert.equal(s.row,s.address%n);assert.equal(s.tile,Math.floor(s.address/n));assert.equal(s.tauRGBA.length,4);assert(s.tauRGBA.every(x=>Number.isFinite(x)&&x>=0));assert.equal(s.tauRGBA[3],0);}sets.push({kind:c.kind,addresses:p.map(x=>x.address)});}
 const p=f.light.oracle.partialSamples;assert.equal(p.length,8);assert.equal(new Set(p.map(x=>x.address)).size,8);let signedPartials=0;
 for(const s of p){assert(s.address>=0&&s.address<f.light.policy.partialCells);assert.equal(s.packetIndex,s.address%1663);assert.equal(s.tile,Math.floor(s.address/1663));assert.equal(s.sourceBegin,s.tile*64);assert.equal(s.sourceEnd,Math.min(2413,s.sourceBegin+64));assert.equal(s.normalization,'raw map partial BEFORE once-only final1/(4pi)');for(const channel of s.attachmentsRGBA){assert.equal(channel.length,4);assert(channel.every(Number.isFinite));assert(channel[0]>=0);signedPartials+=channel.slice(1).filter(x=>x<0).length;}}
 sets.push({kind:'SH',addresses:p.map(x=>x.address)});return{sets,negativeSHPartialC1:signedPartials,actualFutureReadAddressesMustBeMappedByAddress:true,partialNumericalOracleRerun:false};
});
test('Final e29 planner captures this complete joint epoch and atomically models exactly two T fields plus SH once',()=>{
 assert.equal(sha(read('verification/r39-dense-joint-planner.js')),'e29f7eb5aad3565b98f761b04e1f0680c516739e2377caf1001ca91efa240130');
 const identity=captureR39DenseJointEpoch(f,{maxOwnedInputBytes:R39_DENSE_JOINT_HARD_CAPS.maxOwnedInputBytes}),options={policy:'candidate-12m',transmissionStorage:'two-retained',budget:{...R39_DENSE_JOINT_HARD_CAPS}};newPlan=planR39DenseJointWork(identity,options);
 assert(newPlan.supported&&newPlan.ownershipValidated);assert(!newPlan.actualGPU&&!newPlan.effective&&!newPlan.productionAdmitted&&!newPlan.readyToPublish);assert.deepEqual(newPlan.jobs.map(j=>j.name),['Tmain','Tmirror','SH']);assert.deepEqual(newPlan.jobs.map(j=>j.mapDraws),[6,6,6]);assert.equal(newPlan.work.draws,21);assert.equal(newPlan.work.logicalPairs,12055087);assert.equal(newPlan.work.conservativeSlots,12091520);assert.equal(newPlan.work.gpuNumericalBytes,19329024);assert.equal(newPlan.work.readbackBytes,157840);assert.equal(newPlan.fieldStorage.SHFields,1);assert.equal(newPlan.fieldStorage.SourceTFields,2);
 for(let i=0;i<3;i++){const job=newPlan.jobs[i],rects=i<2?f.consumers[i].policy.mapPlan.mapRects:f.light.policy.mapRects;assert.deepEqual(job.mapRects.map(r=>[r.x,r.y,r.width,r.height]),rects.map(r=>[r.x,r.y,r.width,r.height]));assert(job.mapRects.every(r=>r.conservativePairs<=1000000));}
 const current=planR39DenseJointWork(identity,{...options,policy:'current-4m'});assert(!current.supported);assert.equal(current.reasons.length,3);assert(current.reasons.every(x=>x.reason==='pair-work-capacity'));assert(Object.values(current.reservedWork).every(x=>x===0));
 return{ownedInputBytes:identity.captureBytes,counts:identity.counts,allThreeJobs:newPlan.jobs.map(j=>({name:j.name,pairs:j.requiredPairs,partialCells:j.partialCells,draws:j.draws,allocationBytes:j.gpuNumericalBytes,readBytes:j.readbackBytes})),work:newPlan.work,retained2TRequired:true,cpuModelOnly:true};
});
const result={schema:'glass-atoll.r40-dense-joint-input-independent-check.v1',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},actualGPU:false,browserUsed:false,physicalReplay:false,largeOracleRerun:false,fixtureModuleSHA256:sha(read('verification/r39-dense-joint-fixture.js')),fixtureJSONSHA256:sha(read('verification/r39-dense-joint-fixture.json')),fixtureDigest:digest,sourceSHA256:sha(read('verification/r40-dense-joint-input-independent-check.mjs')),checks,limits:['Checks full alreadycomputed reference arrays, structural/numerical algebra and exact packing/bounds; does not independently repeat all2413-by1663-by256 Laplace nodes.','Stored convergence witnesses are crosschecked without rerunning their512-node integrals.','CPU3job plan is not hardware completion/publication/frame-time admission.','Future runtime must audit its ACTUAL partial addresses; stored probe arrays are not implicitly aligned to another probe order.']};
fs.writeFileSync(new URL('verification/r40-dense-joint-input-independent-check.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,counts:result.counts,failed:checks.filter(c=>!c.passed)},null,2));if(!result.passed)process.exitCode=1;
