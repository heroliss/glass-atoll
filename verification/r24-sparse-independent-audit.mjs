// Read-only CPU audit of the synthetic selector; no production/GPU imports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createSyntheticGaussianHierarchy,SYNTHETIC_HIERARCHY_DOMAIN as DOMAIN} from './r24-sparse-gaussian-hierarchy.js';
import {createSyntheticGaussianHierarchy as createOld} from './baselines/r24-sparse-before-conditioning-rejection/r24-sparse-gaussian-hierarchy.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,import.meta.url))).digest('hex');
const OLD='20c7d5a8320b5efb02ff60b8460e71081c598e8aec9605ee306b165ab2086cf2',NEW='374e8f0d6ab6e20db92572885dce7277517ff331054a2a90ace0340f71c181a4';
const checks=[];
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}}
const snapshot=c=>({revision:1,time:12,profiles:[{id:'p',extinctionPerMassRGB:c.k}],packets:[{id:'original-packet',profileId:'p',mass:c.mass,mean:[0,0,0],covariance:c.C,birthTime:11,sourceFamily:'original-family'}]});
const references=read('./r24-sparse-independent-numeric-cases.json'),bad=references.cases.find(x=>x.mustReject);

check('Original helper/report remain preserved and the failed short-ray domain witness reproduces',()=>{
  assert.equal(sha('./baselines/r24-sparse-before-conditioning-rejection/r24-sparse-gaussian-hierarchy.js'),OLD);
  const original=read('./baselines/r24-sparse-before-conditioning-rejection/r24-sparse-gaussian-witness.json');assert.equal(original.passed,true);assert.deepEqual(original.counts,{passed:7,total:7});assert.equal(original.sourceSHA256,OLD);
  const result=createOld(snapshot(bad)).query({origin:bad.o,end:bad.e,budgetRGB:bad.budget}),truth=Number(bad.tauRGB90digits[0]),gap=truth-result.omittedBoundRGB[0];
  assert.equal(result.supported,true);assert.equal(result.keptIDs.length,0);assert.ok(gap>5e-9);assert.ok(truth>bad.budget[0]);
  return {originalSampleChecks:'7/7',originalAllowedDomainFalsification:'failed on independent short-ray edge',oldBound:result.omittedBoundRGB[0],highPrecisionTau:bad.tauRGB90digits[0],underbound:gap,oldHelperSHA256:OLD};
});
check('Repaired domain rejects the known failure before amplitude/query publication; margin is unchanged',()=>{
  assert.equal(sha('./r24-sparse-gaussian-hierarchy.js'),NEW);assert.equal(DOMAIN.relativeMargin,1e-10);assert.equal(DOMAIN.distanceMargin,1e-10);
  assert.throws(()=>createSyntheticGaussianHierarchy(snapshot(bad)),/conditioning\/cancellation/);
  const qFor=t=>4/(t-5+Math.sqrt((t-5)**2-16)),targets=[65536*(1-1e-6),65536*(1+1e-6)];
  const fixture=t=>snapshot({C:[qFor(t),0,0,0,1,0,0,0,1],mass:1,k:[1,1,1]});
  createSyntheticGaussianHierarchy(fixture(targets[0]));assert.throws(()=>createSyntheticGaussianHierarchy(fixture(targets[1])),/conditioning\/cancellation/);
  return {knownFailure:'rejected',maxConditionProxy:DOMAIN.maxConditionProxy,maxPivotCancellationRatio:DOMAIN.maxPivotCancellationRatio,thresholdTargets:targets,relativeMargin:DOMAIN.relativeMargin,noUniversalCertificate:true};
});
check('Independent90-digit finite-ray references exercise short/reverse/tangent/anisotropic/nonzero-tail/zero cases',()=>{
  const evidence=[];
  for(const c of references.cases){
    if(c.mustReject)continue;
    const h=createSyntheticGaussianHierarchy(snapshot(c)),r=h.query({origin:c.o,end:c.e,budgetRGB:c.budget}),truth=c.tauRGB90digits.map(Number);
    assert.equal(r.supported,true);assert.equal(r.numericCertificate,false);assert.equal(r.keptIDs.length+r.omittedIDs.length,1);
    for(let channel=0;channel<3;channel++){
      const omitted=r.omittedIDs.length?truth[channel]:0,kept=r.keptIDs.length?truth[channel]:0,U=r.omittedBoundRGB[channel],slack=Math.max(2e-18,32*Number.EPSILON*Math.max(Math.abs(omitted),Math.abs(U))),TError=Math.exp(-kept)*(-Math.expm1(-omitted)),TBound=-Math.expm1(-U);
      assert.ok(omitted<=U+slack,c.name+' tau bound');assert.ok(TError<=TBound+slack,c.name+' T propagation');assert.ok(U<=c.budget[channel]);
    }
    evidence.push({name:c.name,kept:r.keptIDs.length,omitted:r.omittedIDs.length,referenceTauRGB:c.tauRGB90digits,bound:r.omittedBoundRGB,length:r.length});
  }
  assert.ok(evidence.find(x=>x.name==='positive-omission-tail').omitted===1);assert.ok(evidence.find(x=>x.name==='unit-short-centered').length<1e-8);return {cases:evidence,referenceDigits:references.digits,scope:'Finite numerical comparisons only, not an interval proof'};
});
check('Every original physical ID/copy/profile/mass/family/clock survives selection and caller mutation',()=>{
  const s={revision:9,time:12,profiles:[{id:'p',extinctionPerMassRGB:[.8,.7,.6]},{id:'zero',extinctionPerMassRGB:[0,0,0]}],packets:Array.from({length:32},(_,i)=>({id:i%2?'string-'+i:i,profileId:i%4?'p':'zero',mass:i%5?.01:0,mean:[i*.01,0,0],covariance:[1,0,0,0,1,0,0,0,1],birthTime:i*.01,sourceFamily:'family-'+i}))};
  const original=structuredClone(s),h=createSyntheticGaussianHierarchy(s),q={origin:[0,0,-1],end:[0,0,1],budgetRGB:[0,0,0]},r=h.query(q);
  assert.deepEqual(h.physical,original);assert.ok(Object.isFrozen(h.physical.packets[0].covariance));
  assert.deepEqual([...r.keptPacketIndices,...r.omittedPacketIndices].sort((a,b)=>a-b),Array.from({length:32},(_,i)=>i));assert.deepEqual(r.keptIDs,r.keptPacketIndices.map(i=>original.packets[i].id));assert.deepEqual(r.omittedIDs,r.omittedPacketIndices.map(i=>original.packets[i].id));assert.equal(r.stats.retainedPackets,r.keptIDs.length);assert.equal('retainedLeaves' in r.stats,false);
  s.packets[0].mean[0]=100;s.packets[1].mass=100;s.profiles[0].extinctionPerMassRGB[0]=999;assert.deepEqual(h.physical,original);assert.deepEqual(h.query(q).keptIDs,r.keptIDs);
  return {originalPackets:32,physicalMass:original.packets.reduce((sum,p)=>sum+p.mass,0),zeroOpticalMatterRetained:true,originalOrderIDsPreserved:true};
});
check('Work rejection has no candidate-list or bound publication, and camera/profile invalidation is distinct',()=>{
  const s={profiles:[{id:'p',extinctionPerMassRGB:[1,1,1]}],packets:Array.from({length:16},(_,i)=>({id:i,profileId:'p',mass:.01,mean:[0,0,0],covariance:[1,0,0,0,1,0,0,0,1]}))},h=createSyntheticGaussianHierarchy(s),q={origin:[0,0,-1],end:[0,0,1],budgetRGB:[0,0,0]};
  for(const limit of [{maxNodeVisits:0},{maxRetainedPackets:0}]){const r=h.query({...q,...limit});assert.equal(r.supported,false);for(const key of ['keptIDs','keptPacketIndices','omittedIDs','omittedPacketIndices','omittedBoundRGB'])assert.equal(key in r,false);}
  const base=h.query(q).queryKey,moved=h.query({...q,origin:[.01,0,-1]}).queryKey,tagged=h.query({...q,consumer:'mirror'}).queryKey;assert.equal(new Set([base,moved,tagged]).size,3);
  const changed=structuredClone(s);changed.profiles[0].extinctionPerMassRGB[0]=.5;assert.notEqual(createSyntheticGaussianHierarchy(changed).physicalKey,h.physicalKey);
  return {partialListsOnFailure:false,distinctQueryKeys:3,resultIsNotReusableT:true};
});
check('Independent CPU replay passes9/9 with unchanged original fixture results and explicitly limited claims',()=>{
  const now=read('./r24-sparse-gaussian-witness.json'),replayed=read('./r24-sparse-gaussian-witness-independent-replay-after-repair.json');assert.equal(now.passed,true);assert.deepEqual(now.counts,{passed:9,total:9});assert.equal(replayed.passed,true);assert.deepEqual(replayed.counts,now.counts);assert.equal(now.sourceSHA256,NEW);assert.equal(replayed.sourceSHA256,NEW);
  for(const r of [now,replayed]){assert.equal(r.numericCertificate,false);assert.equal(r.actualGPU,false);assert.equal(r.nativeSnapshotUsed,false);const summary=r.checks[1].evidence;assert.equal(summary.totalDensePairs,1616);assert.equal(summary.totalKeptPairs,416);assert.ok(summary.maximumTError>1e-10);assert.ok(summary.maximumNumericalSlack<1e-10);}
  return {replay:'9/9',syntheticFixtures:11,finiteRays:28,densePairs:1616,retainedPairs:416,visitedNodes:279,noSpeedupClaim:true,noNativeOrGPUClaim:true};
});
check('Selector/oracle source ownership is separate and production imports do not admit this helper',()=>{
  const helper=fs.readFileSync(new URL('./r24-sparse-gaussian-hierarchy.js',import.meta.url),'utf8'),runner=fs.readFileSync(new URL('./r24-sparse-gaussian-witness.mjs',import.meta.url),'utf8'),main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.equal(main.includes('r24-sparse-gaussian'),false);assert.match(runner,/function inverse\(C\)/);assert.match(runner,/const GL16/);assert.match(runner,/function adaptive/);assert.equal(helper.includes('smokeGaussianColumnGLSL'),false);assert.equal(runner.includes('smokeGaussianColumnGLSL'),false);assert.equal(helper.includes("from '../"),false);
  return {productionImports:0,sharedErfOrCholeskyOracle:false,quadratureErrorEstimateIsNotCertificate:true,unknownMetadataCloneNotGeneralMemoryGuard:true};
});
const report={schema:'glass-atoll.r24-sparse-independent-audit.v1',passed:checks.every(x=>x.passed),counts:{checks:checks.length,passed:checks.filter(x=>x.passed).length},actualGPU:false,browserActions:0,productionEdits:0,numericCertificate:false,checks,chronology:'Original7/7 missed an allowed-domain short-ray conditioning counterexample. That failure is retained; repaired source rejects it and now passes9/9 plus this audit. No universal or native admission follows.',sourceSHA256:NEW,oldSourceSHA256:OLD,SHA256:{helper:sha('./r24-sparse-gaussian-hierarchy.js'),runner:sha('./r24-sparse-gaussian-witness.mjs'),highPrecisionCases:sha('./r24-sparse-independent-numeric-cases.json'),tests:sha('./r24-sparse-independent-audit.mjs')}};
fs.writeFileSync(new URL('./r24-sparse-independent-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed),sourceSHA256:NEW},null,2));if(!report.passed)process.exitCode=1;
