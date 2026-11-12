// Bounded integrity/read audit of completed offline references; no replay or GL.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {R39_DENSE_JOINT_FIXTURE as joint,R39_DENSE_JOINT_FIXTURE_DIGEST as digest,r39DenseCanonicalJSON as canonical} from './r39-dense-joint-fixture.js';
import {R39_DENSE_FIXTURE as original,R39_DENSE_FIXTURE_DIGEST as originalDigest} from './r39-dense-native-fixture.js';
const here=new URL('./',import.meta.url),root=new URL('../',import.meta.url);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const report=JSON.parse(read('verification/r39-dense-remaining-reference.json'));
const checks=[],check=(name,fn)=>{try{const detail=fn();checks.push({name,passed:true,detail});}catch(e){checks.push({name,passed:false,error:String(e.stack??e).slice(0,2400)});}};
const main=joint.consumers.find(c=>c.kind==='main'),mirror=joint.consumers.find(c=>c.kind==='reflection');
check('Frozen static module, JSON, canonical digest, generator and source pins',()=>{
 assert.equal(sha(read('verification/r39-dense-joint-fixture.js')),report.moduleSHA256);
 assert.equal(sha(read('verification/r39-dense-joint-fixture.json')),report.jsonSHA256);
 assert.equal(sha(canonical(joint)),digest);assert.equal(digest,report.canonicalDigest);
 assert.equal(canonical(JSON.parse(read('verification/r39-dense-joint-fixture.json'))),canonical(joint));
 assert.equal(sha(read('verification/r39-dense-remaining-reference.mjs')),report.worker.generatorSHA256);
 for(const [p,h] of Object.entries(report.sourcePins))assert.equal(sha(read(p)),h,p);
 assert.equal(sha(canonical(original)),originalDigest);
 const frozen=v=>{if(v&&typeof v==='object'){assert(Object.isFrozen(v));for(const x of Object.values(v))frozen(x);}};frozen(joint);
 return {moduleSHA256:report.moduleSHA256,jsonSHA256:report.jsonSHA256,canonicalDigest:digest,sourcePins:Object.keys(report.sourcePins).length};
});
check('Original MAIN and complete physical epoch preserved; independent clock namespaces',()=>{
 for(const key of ['snapshot','ledger','currentEmissionRecords','physicalEvents'])assert.equal(canonical(joint[key]),canonical(original[key]),key);
 assert.equal(canonical(main),canonical(original.consumers.find(c=>c.kind==='main')));
 assert.equal(sha(canonical(main)),report.originalMAINDigest);
 assert.equal(joint.snapshot.packets.length,1663);assert.equal(joint.ledger.count,2413);
 assert.equal(joint.snapshot.requestedTime,joint.ledger.time);assert.equal(joint.phase.time,joint.ledger.time);
 assert.equal(joint.snapshot.time,7.550000000000001);assert.equal(joint.ledger.time,7.55);
 assert.equal(joint.ledger.recordGeneration,51);
 return {MAINExact:true,packets:1663,ledgerSources:2413,densityTime:joint.snapshot.time,requestedTime:joint.snapshot.requestedTime,ledgerGeneration:51};
});
check('Complete distinct mirror rays, exact original packing and all-row T references',()=>{
 const old=original.consumers.find(c=>c.kind==='reflection');
 for(const key of ['input','orderedSources','captureMetadata','policy','packing'])assert.equal(canonical(mirror[key]),canonical(old[key]),key);
 assert.equal(main.input.count,2418);assert.equal(mirror.input.count,2418);
 assert.notEqual(canonical(main.input.endpoints64),canonical(mirror.input.endpoints64));
 assert.notEqual(main.input.cameraKey,mirror.input.cameraKey);
 assert.notDeepEqual(main.oracle.physicalRGBA,mirror.oracle.physicalRGBA);
 assert.equal(mirror.oracle.pending,false);
 let maximumDifference=0,minimum=1;
 for(const name of ['physicalRGBA','quantizedRGBA']){
  const a=mirror.oracle[name];assert.equal(a.length,2418*4);
  for(let i=0;i<2418;i++)for(let c=0;c<4;c++){
   const x=a[i*4+c];assert(Number.isFinite(x));assert(x>=0&&x<=1);
   if(c===3||!mirror.input.active[i])assert.equal(x,1);
   minimum=Math.min(minimum,x);
  }
 }
 for(let i=0;i<2418*4;i++)maximumDifference=Math.max(maximumDifference,Math.abs(mirror.oracle.physicalRGBA[i]-mirror.oracle.quantizedRGBA[i]));
 assert.equal(maximumDifference,report.mirrorMaximumOriginalVsPackedDoubleDifference);
 assert.equal(minimum,Math.min(...mirror.oracle.physicalRGBA,...mirror.oracle.quantizedRGBA));
 return {rows:2418,pairs:2418*1663,distinctOriginalRays:true,maximumOriginalPackedDifference:maximumDifference};
});
check('All 19,956 SH coefficients, signed channels and complete bound admissions',()=>{
 const a=joint.light.oracle;assert.equal(a.pending,false);assert.equal(a.nodes,256);assert.equal(a.rows.length,1663);
 let signed=0,fourth=0,minimum=Infinity,maximum=0,own=0;
 for(let i=0;i<1663;i++){
  const r=a.rows[i];assert.equal(r.index,i);assert.equal(r.C0.length,3);assert.equal(r.C1.length,9);
  for(const x of [...r.C0,...r.C1,...r.minimum,...r.maximum])assert(Number.isFinite(x));
  for(let c=0;c<3;c++){
   assert(r.C0[c]>=0);const v=r.C1.slice(c*3,c*3+3),radius=Math.hypot(...v);
   assert.equal(r.minimum[c],r.C0[c]-radius);assert.equal(r.maximum[c],r.C0[c]+radius);
   assert(r.minimum[c]>=0);assert(r.maximum[c]<=joint.light.idealGroupBound.rows[i][c]*1.003+1e-30);
   const attachment=a.attachmentsRGBA[c];assert.equal(attachment.length,1663*4);
   assert.deepEqual(attachment.slice(i*4,i*4+4),[r.C0[c],...v]);
   minimum=Math.min(minimum,r.minimum[c]);maximum=Math.max(maximum,r.maximum[c]);
   own=Math.max(own,r.maximum[c]/Math.max(joint.light.idealGroupBound.rows[i][c],1e-30));
  }
  signed+=r.C1.filter(x=>x<0).length;for(const k of [2,5,8])if(r.C1[k]<0)fourth++;
 }
 assert(maximum<=joint.light.rawBound.maxRGB);assert(signed>0&&fourth>0);
 assert.equal(signed,report.negativeC1);assert.equal(fourth,report.negativeFourthChannels);
 assert.equal(minimum,report.minimumSHAngular);assert.equal(maximum,report.maximumSHAngular);assert.equal(own,report.maximumOwnGroupBoundRatio);
 assert.equal(a.convergence.nodes,512);assert(a.convergence.witnesses.length>0&&a.convergence.witnesses.length<=6);
 assert.equal(a.convergence.maximumNormalizedCoefficientDifference,report.maximumSelected256vs512);assert(report.maximumSelected256vs512<2e-6);
 return {coefficients:1663*12,pairs:1663*2413,negativeC1:signed,negativeFourth:fourth,maximumOwnGroupRatio:own,selectedConvergence:report.maximumSelected256vs512};
});
check('Eight original-order partial references per consumer, including row/tile endpoints',()=>{
 for(const c of [main,mirror]){
  const samples=c.oracle.partialSamples;assert.equal(samples.length,8);assert.equal(new Set(samples.map(s=>s.address)).size,8);
  assert(samples.some(s=>s.address===0));assert(samples.some(s=>s.address===c.policy.mapPlan.completeCells-1));
  for(const s of samples){assert.equal(s.tile,Math.floor(s.address/c.input.count));assert.equal(s.row,s.address%c.input.count);assert.equal(s.tauRGBA.length,4);for(const x of s.tauRGBA)assert(Number.isFinite(x)&&x>=0);assert.equal(s.tauRGBA[3],0);}
 }
 const a=joint.light.oracle.partialSamples;assert.equal(a.length,8);assert.equal(new Set(a.map(s=>s.address)).size,8);
 assert(a.some(s=>s.address===0));assert(a.some(s=>s.address===joint.light.policy.partialCells-1));
 for(const s of a){assert.equal(s.packetIndex,s.address%1663);assert.equal(s.tile,Math.floor(s.address/1663));assert.equal(s.sourceBegin,s.tile*64);assert.equal(s.sourceEnd,Math.min(2413,s.sourceBegin+64));assert(s.normalization.includes('BEFORE'));assert.equal(s.attachmentsRGBA.length,3);for(const row of s.attachmentsRGBA){assert.equal(row.length,4);for(const x of row)assert(Number.isFinite(x));}}
 return {MAIN:8,mirror:8,SH:8};
});
check('One bounded worker, no replay/GPU, pending numerical jobs remain explicit',()=>{
 assert.equal(report.passed,true);assert.equal(report.actualGPU,false);assert.equal(report.physicalReplayRepeated,false);
 assert(report.worker.wallMs>0&&report.worker.wallMs<180000);assert.equal(report.worker.workerWallBoundSeconds,180);
 assert.equal(joint.provenance.offlineOraclesPending,false);
 assert.deepEqual(joint.provenance.cpuReferenceCompleteJobs,['main-source','reflection-source','resolved-light']);
 assert.deepEqual(joint.provenance.admittedNumericalJobs,['main-source-only']);
 assert.equal(joint.provenance.remainingReference.unchangedMAINDigest,report.originalMAINDigest);
 return {wallMs:report.worker.wallMs,CPUReferenceComplete:true,additionalGPUAdmitted:false};
});
const result={schema:'glass-atoll.r39-dense-remaining-reference-check.v1',passed:checks.every(x=>x.passed),passedChecks:checks.filter(x=>x.passed).length,totalChecks:checks.length,actualGPU:false,physicalReplayRepeated:false,scriptSHA256:sha(fs.readFileSync(new URL(import.meta.url))),reportSHA256:sha(read('verification/r39-dense-remaining-reference.json')),canonicalDigest:digest,checks};
fs.writeFileSync(new URL('r39-dense-remaining-reference-check.json',here),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
