import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=n=>fs.readFileSync(path.join(root,n)),json=n=>JSON.parse(read(n).toString('utf8').replace(/^\uFEFF/,''));
const pin=n=>{const b=read(n);return {sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};};
const previous=json('verification/r28-final-manifest.json'),source={},changed=[];
for(const [n,p] of Object.entries(previous.source)){source[n]=pin(n);if(p.sha256!==source[n].sha256)changed.push(n);}
assert.deepEqual(changed.sort(),['main.js','pyro-smoke-transmission-pack.js','pyro-smoke-light-tiles.js'].sort());
assert.equal(source['fireworks-audio.js'].sha256,'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
const promotion=json('verification/r29-production-capacity-pins.json');assert.equal(promotion.calibrationPending,false);
for(const [n,p] of Object.entries(promotion.source))assert.deepEqual(source[n],p,n);
const names=[
 'r29-independent-capacity-policy-check.json','r29-root-capacity-hook-check.json','r29-deployed-capacity-independent-check.json',
 'r29-native-phase-fixture-check.json','r29-native-peaks-independent-check.json','r29-native-phase-helper-binding-audit.json',
 'r29-native-phase-source-peak-check.json','r29-native-phase-light-peak-check.json','r29-native-phase-joint-peak-check.json',
 'r29-native-calibration-input-check.json','r29-native-calibration-gpu-preflight.json','r29-runner-independent-review.json',
 'r29-source-peak-actual-gpu.json','r29-light-peak-actual-gpu.json','r29-joint-peak-actual-gpu.json',
 'r29-native-actual-independent-audit.json','r29-actual-job-receipts-independent-audit.json',
 'r29-native-phase-camera-accumulation-check.json','r29-over-capacity-fallback-independent-check.json',
 'r29-syntax-check.json','r29-user-restoration-check.json'
];
const validation=Object.fromEntries(names.map(n=>{const r=json('verification/'+n);assert.equal(r.passed,true,n);return [n,{...pin('verification/'+n),counts:r.counts??null,actualGPU:r.actualGPU===true,passed:true}];}));
const guard=json('verification/r29-native-calibration-pins.json');assert.equal(guard.pending,false);
for(const [n,p] of Object.entries(guard.sources))assert.equal(pin(path.posix.normalize('verification/'+n)).sha256,p,n);
const expected={source:{draws:5,reads:21984,prepares:1},light:{draws:6,reads:110832,prepares:1},joint:{draws:10,reads:122832,prepares:2}},actual={};
for(const [kind,e] of Object.entries(expected)){
 const n='verification/r29-'+kind+'-peak-actual-gpu.json',r=json(n);assert(r.actualGPU&&r.passed);assert.equal(r.actualDraws,e.draws);assert.equal(r.renderPasses,e.draws);assert.equal(r.prepares,e.prepares);assert.equal(r.readbackBytes,e.reads);assert.equal(r.timedIntervals.length,1);assert(r.timedIntervals[0].ready&&!r.timedIntervals[0].disjoint&&r.timedIntervals[0].gpuMs<=25);assert.deepEqual(r.glErrors,[]);assert.deepEqual(r.shaderErrors,[]);
 assert(r.native.sameGenerationOwned&&r.privateInputAndOfflineOraclesOwnedBeforeFirstAwait);assert(r.jobs.every(j=>j.fresh&&!j.reused));
 for(const [file,digest] of Object.entries(r.sourceGuard.sourceHashes))assert.equal(pin(path.posix.normalize('verification/'+file)).sha256,digest,file);
 for(const [name,digest] of Object.entries(guard.functions))assert.equal(r.sourceGuard.functionHashes[name],digest,name);
 assert.equal(r.caps.transmission.maxRequestPairs,4000000);assert.equal(r.caps.light.maxRequestPairs,4000000);assert.equal(r.caps.transmission.maxMapPairs,1000000);assert.equal(r.caps.light.maxMapPairs,1000000);assert.equal(r.caps.transmission.maxMapDraws,8);assert.equal(r.caps.light.maxMapDraws,8);
 actual[kind]={...pin(n),counts:r.counts,draws:r.actualDraws,prepares:r.prepares,readbackBytes:r.readbackBytes,timedIntervals:r.timedIntervals,native:r.native,numericAllocationBytes:r.numericAllocationBytes};
 assert.equal(pin(n).sha256,promotion.actualReceipts[kind].sha256);
}
const joint=json('verification/r29-joint-peak-actual-gpu.json');assert.equal(joint.jobs[0].sourceVersion,308);assert.equal(joint.jobs[1].recordGeneration,308);assert.equal(joint.jobs[0].snapshotRevision,joint.jobs[1].snapshotRevision);
const restored=json('verification/r29-user-state-restored.json'),restore=json('verification/r29-user-restoration-check.json');assert.equal(restore.counts.total,28);assert.equal(restore.counts.passed,28);assert.equal(restore.counts.exact,27);assert.deepEqual(json('verification/r29-console-after.json'),[]);assert.deepEqual(restored.gl.errors,[]);assert(restored.gl.programLive&&restored.gl.vertexArrayLive&&!restored.gl.programDeletePending&&!restored.state.graphicsContextInterrupted);assert.equal(restored.fireworks.active,0);assert.equal(restored.smoke.state.packetCount,0);
const server=json('verification/r29-server-state.json');assert.equal(server.listening,true);assert.deepEqual(server.listeners,[{LocalAddress:'127.0.0.1',LocalPort:5186,OwningProcess:23820}]);
const artifacts={};
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const n=dir+'/'+e.name;if(e.isDirectory()){if(n==='verification/plans'||n==='verification/baselines'||n.startsWith('verification/baselines/r29')||/^verification\/r29[^/]*($|\/)/i.test(n))walk(n);}else if((/^r29/i.test(e.name)||n.startsWith('verification/plans/R29')||n.startsWith('verification/baselines/r29')||/^verification\/r29[^/]+\//i.test(n))&&n!=='verification/r29-final-manifest.json')artifacts[n]=pin(n);}}
walk('verification');
for(const n of ['README.md','verification/plans/PROGRESS.md','verification/seal-r29.mjs','verification/r28-final-manifest.json','verification/R29-LIFETIME-PEAK-CHECKPOINT.md','verification/R29-NATIVE-PHASE-FIXTURES.md','verification/R29-CURRENT-CAMERA-ACCUMULATION-COUNTS.md'])artifacts[n]=pin(n);
const archivedFailedReports=[];for(const n of Object.keys(artifacts).filter(n=>n.endsWith('.json'))){try{const r=json(n);if(r?.passed===false)archivedFailedReports.push({path:n,sha256:artifacts[n].sha256,counts:r.counts??null});}catch{}}
const requiredFailures=[
 'verification/baselines/r29-capacity-before-serial-fixture-correction/r29-independent-capacity-policy-check.json',
 'verification/baselines/r29-independent-before-enumerable-guard-repair/r29-runner-independent-review.json',
 'verification/baselines/r29-over-capacity-before-map-count-fixture-fix/r29-over-capacity-fallback-independent-check.json',
 'verification/baselines/r29-peaks-before-reference-container-fixture-fix/r29-native-peaks-independent-check.json',
 'verification/r29-native-phase-camera-accumulation-check-before-launch-receipt-fixture-fix.json',
 'verification/r29-native-phase-source-peak-check-before-captured-manifest-archive.json',
 'verification/baselines/r29-before-seal-retention-fixture-fix/r29-seal-check.json'
];
for(const n of requiredFailures)assert(archivedFailedReports.some(r=>r.path===n),'Retain named failure: '+n);
for(const n of ['verification/r29-pin-keyset-falsification.json','verification/r29-pin-enumerability-falsification.json'])assert(artifacts[n],'Retain source-guard falsification: '+n);
const report={schema:'glass-atoll.r29-final-manifest.v1',sealedUTC:new Date().toISOString(),goalStatus:'active',passed:true,source,sourceDeltaFromR28:changed,validation,actualReceipts:actual,deployedPolicy:promotion.ceiling,calibrationPins:pin('verification/r29-native-calibration-pins.json'),userRestoration:{counts:restore.counts,automaticDerivedPeakNits:{before:700,after:1270},systemSettingsChanged:false},server,nextPlans:['verification/plans/R29-ONE-FRESH-SCENE-FRAME-DESIGN.md','verification/plans/R29-OVER-CAPACITY-AND-NEXT-ADMISSION-INDEPENDENT.md'],artifacts,archivedFailedReports,limitations:[
 'Only three isolated production numerical peak jobs; no smoke-volume/scene/real-mirror/evolving or multi-firework GPU frame acceptance.',
 'Primary complete fixtures have zero reflected optical rows. The actual current-eye CPU witness has two distinct nonzero optical views and shared world-space SH; this needs eighteen numerical draws before scene work.',
 'Two actual accepted events exceed ten million pairs per request at sampled peak. Current four-million policy is not an accumulation fix; SourceT can synchronously fall back to CPU BVH queries, SH loses resolved detail. Logical dense pairs are not measured CPU traversals or stall duration.',
 'Single retrospective timers and cold instrumented submission are not warm A/B speedup, FPS or preemption guarantees. Fixed numerical allocations are not total GPU/driver/JS memory.',
 'Full signed SH1 and Gaussian extinction model unchanged; no incoming self-shadow/full anisotropic RTE or measured pyrotechnic photometry.',
 'Current final outputs and eight partial cells per kernel are read; unused full SH zero suffix relies on unchanged full-viewport shader and CPU/state proofs, not full suffix readback.',
 'Old R28 legacy fake-GL/normalizer fixture failures remain historical; these suites were not rerun or claimed green in R29.',
 'Normal reload preserves user settings intent but not old cloud/wave instant. Automatic HDR derived peak changed700to1270 from system report; screenshot is restoration only.',
 'Overall smoke visual scale/illumination/choreography, shoreline/splash edge/skyline and photo quality remain unfinished; withdrawn shaders/audio preferences preserved.'
]};
fs.writeFileSync(path.join(root,'verification/r29-final-manifest.json'),JSON.stringify(report,null,2)+'\n');
for(const n of ['verification/R29-LIFETIME-PEAK-CHECKPOINT.md','verification/R29-NATIVE-PHASE-FIXTURES.md','verification/R29-CURRENT-CAMERA-ACCUMULATION-COUNTS.md','verification/plans/R29-NATIVE-PEAK-CALIBRATION-NOTE.md','verification/plans/R29-ONE-FRESH-SCENE-FRAME-DESIGN.md','verification/plans/R29-OVER-CAPACITY-AND-NEXT-ADMISSION-INDEPENDENT.md'])for(const m of read(n).toString('utf8').matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(n),m[1])),n+' link '+m[1]);}
console.log(JSON.stringify({passed:true,runtimePins:Object.keys(source).length,currentPassingReports:names.length,artifacts:Object.keys(artifacts).length,retainedFailedReports:archivedFailedReports.length,sourceDelta:changed,actualCounts:Object.fromEntries(Object.entries(actual).map(([k,r])=>[k,r.counts])),goalStatus:report.goalStatus,manifest:pin('verification/r29-final-manifest.json')},null,2));
