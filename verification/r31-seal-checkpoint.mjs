import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin=p=>({sha256:sha(read(p)),bytes:read(p).length});
const old=json('verification/r30-final-manifest.json');
const n=json('verification/r31-native-scene-actual-gpu.json'),p=json('verification/r31-native-phase-profile-actual-gpu.json');
const promotion=json('verification/r31-disabled-shadow-promotion.json');
assert.equal(n.passed,true);assert.deepEqual(n.counts,{passed:6,total:6});
assert.equal(p.passed,false);assert.deepEqual(p.counts,{passed:4,total:5});
assert.equal(n.timedIntervals[0].gpuMs,59.307392);
assert.equal(p.timedIntervals.reduce((s,x)=>s+x.gpuMs,0),137.605376);
assert.equal(p.image,undefined);assert(p.failure.includes('sum-over100ms'));
assert.equal(pin('main.js').sha256,promotion.after.main);assert.equal(pin('sun-shadows.js').sha256,promotion.after.sunShadows);
assert.equal(pin('fireworks-audio.js').sha256,'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
const files=fs.readdirSync(root).filter(x=>/\.(?:js|mjs|html|css|json)$/.test(x)).sort();
for(const path of Object.keys(old.source))if(!files.includes(path))files.push(path);
const source=Object.fromEntries(files.sort().map(path=>[path,pin(path)]));
const common=Object.keys(old.source).filter(path=>!path.startsWith('verification/'));
const productionChanges=common.filter(path=>old.source[path].sha256!==source[path].sha256);
assert.deepEqual(productionChanges,['main.js']);
assert.notEqual(pin('sun-shadows.js').sha256,pin('verification/baselines/r31-before-disabled-shadow-promotion/sun-shadows.js').sha256);
const selected=[
 'r31-native-preplan-check.json','r31-main-layer-bounds-check.json',
 'r31-native-scene-preflight.json','r31-native-scene-layer-bounds-review.json',
 'r31-native-actual-layer-bounds-audit.json','r31-native-smoke-actual-audit.json',
 'r31-native-phase-profile-preflight.json','r31-phase-profile-layer-bounds-review.json',
 'r31-phase-profile-actual-layer-bounds-audit.json','r31-native-phase-profile-smoke-actual-audit.json',
 'r31-disabled-shadow-candidate-check.json','r31-disabled-shadow-staged-math-check.json',
 'r31-disabled-shadow-layer-bounds-review.json','r31-final-promotion-independent-audit.json',
 'r31-user-restoration-check.json','r31-current-shadow-runtime-check.json'
].map(name=>{const path='verification/'+name,r=json(path),statusField=name==='r31-native-phase-profile-smoke-actual-audit.json'?'auditPassed':'passed';assert.equal(r[statusField],true,path);return{path,...pin(path),statusField,counts:r.counts??null,actualGPU:r.actualGPU??false,scope:r.scope??r.schema};});
const retainedFailures=[
 'verification/r31-main-integration-initial-stop.json','verification/r31-seal-initial-stop.json',
 'verification/baselines/r31-layer-bounds-before-entry-inverse-fixture-fix/r31-main-layer-bounds-check.json',
 'verification/baselines/r31-layer-bounds-before-profile-source-fixture-fix/r31-phase-profile-layer-bounds-review.json',
 'verification/r31-native-phase-profile-actual-gpu.json'
].map(path=>{const r=json(path);assert.equal(r.passed,false,path);return{path,...pin(path),counts:r.counts??null,actualGPU:r.actualGPU??false,failure:r.failure??null};});
const walked=fs.readdirSync(new URL('verification/',root),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{
 const absolute=String(e.parentPath??e.path).replaceAll('\\','/')+'/'+e.name;
 const taskRoot=fs.realpathSync(root).replaceAll('\\','/');
 assert(absolute.startsWith(taskRoot+'/verification/'));return absolute.slice(taskRoot.length+1);
}).filter(path=>/(?:^|\/)r31[^/]*|(?:^|\/)R31[^/]*/.test(path)).filter(path=>!path.includes('r31-final-independent-audit')&&!path.endsWith('r31-final-manifest.json'));
const artifacts=Object.fromEntries([...new Set([...walked,'README.md','verification/plans/PROGRESS.md'])].sort().map(path=>[path,pin(path)]));
const epochs=[
 {role:'R30 prior frame',main:'bfe586ddebfb2d47eb83f285762ecf1acfe92e773862699092bf88c178545777',archive:'verification/baselines/r31-before-native-frame/main.js'},
 {role:'R31 native continuous query',main:'5b1541d2eddff1fa8a4c26eccd735657dac8b5a5e3c97a25001403cb1b1171f1',archive:'verification/baselines/r31-before-phase-profile/main.js',receipt:'verification/r31-native-scene-actual-gpu.json'},
 {role:'R31 sequential phase queries',main:'bd51038a3018bbcfea92440f80e824673aa3c00c4711b94b7f8ee8ad0e6dadfa',archive:'verification/baselines/r31-before-disabled-shadow-promotion/main.js',receipt:'verification/r31-native-phase-profile-actual-gpu.json'},
 {role:'Current promoted source; normal empty scene compile/restore only',main:promotion.after.main,archive:'main.js',sunShadows:promotion.after.sunShadows,receipt:'verification/r31-user-state-after.json'}
].map(e=>{assert.equal(pin(e.archive).sha256,e.main);return{...e,archivePin:pin(e.archive),...(e.receipt?{receiptPin:pin(e.receipt)}:{})};});
const consoleSaved=json('verification/r31-current-console.json');
const report={schema:'glass-atoll.r31-final-manifest.v1',sealedUTC:new Date().toISOString(),passed:true,sealMeaning:'Declared files, epochs and selected statuses are intact; performance gate remains failed and overall goal remains active.',goalStatus:'active',performanceTargetPassed:false,
 previousManifest:{path:'verification/r30-final-manifest.json',...pin('verification/r30-final-manifest.json'),scope:'Historical seal bytes only; its former current paths are not asserted unchanged after R31.'},
 productionChangesAgainstR30ComparedSet:productionChanges,additionalChangedDependency:{path:'sun-shadows.js',baseline:'verification/baselines/r31-before-disabled-shadow-promotion/sun-shadows.js',before:promotion.before.sunShadows,after:promotion.after.sunShadows,wasInR30SourceSet:false},source,artifacts,sourceEpochs:epochs,selectedPassingEvidence:selected,preservedFailures:retainedFailures,
 nativeFrame:{receipt:'verification/r31-native-scene-actual-gpu.json',counts:n.counts,GPUms:n.timedIntervals[0].gpuMs,coldInstrumentedCpuSubmitMs:n.cpuSubmitMs,draws:n.actualDraws,renders:n.renderCalls,elements:n.elements,nativeOps:n.nativeOps,numericalDraws:n.numericalStages.length,mainSize:[n.image.width,n.image.height],reflection:n.final.water.reflection,cpuFallbackQueries:0,imageReadType:n.image.readType,rawImageBytes:n.image.bytes,rawImageSHA256:sha(Buffer.from(n.image.rgbaBase64,'base64')),visualAcceptance:false},
 failedPhaseProfile:{receipt:'verification/r31-native-phase-profile-actual-gpu.json',counts:p.counts,queryCount:p.timedIntervals.length,phaseGPUms:p.timedIntervals.map(x=>({phase:x.phase,gpuMs:x.gpuMs})),sumGPUms:p.timedIntervals.reduce((s,x)=>s+x.gpuMs,0),ceilingMs:100,allReadyNonDisjoint:p.timedIntervals.every(x=>x.ready&&!x.disjoint),imageCPURead:false,finalConsumerAssertionsReached:false,causalComparisonToNativeFrame:false,restored:p.restoration.passed},
 currentOptimization:{receipt:'verification/r31-disabled-shadow-promotion.json',measuredSpeedup:false,pixelParity:false,scope:promotion.skippedWork,sharedShaderRuntimeCheck:'verification/r31-current-shadow-runtime-check.json'},
 userRestoration:json('verification/r31-user-restoration-check.json').counts,console:{errors:consoleSaved.filter(x=>x.level==='error').length,warnings:consoleSaved.filter(x=>x.level==='warn').length},syntax:{command:'npm run check',log:'verification/r31-syntax.log',exitCode:0},
 limits:[
  'A passing seal is not a passing performance target; failed phase profile4/5 is retained.',
  'Each native/performance receipt is bound to its captured historical main epoch, not the current optimized source. Old closed helpers reject current main before GPU submission.',
  'Prior native source subsets did not include the changed transitive sun-shadows dependency; future candidate admission must pin it and inspect actual loaded shader source explicitly.',
  'One fading-phase SDR image and one continuous GPU query do not establish sustained FPS, bright-phase photorealism, HDR-display accuracy or multi-event performance.',
  'Three sequential phase intervals are not a continuous whole-query measurement and cannot establish a causal59-to138ms regression.',
  'The current disabled-shadow arithmetic optimization has normal scene compile/link/restore evidence, not a new experimental workload speedup or universal pixel parity.',
  'Two-event requests above4m per kernel can still trigger expensive CPU SourceT fallback and missing resolved SH; this remains unresolved.',
  'Only selected evidence/statuses are sealed; no claim that every historical test is currently green. No original instantaneous environment/history bitwise restoration claim.',
  'Approved audio remains unchanged. The goal remains active.'
 ]};
fs.writeFileSync(new URL('verification/r31-final-manifest.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,goalStatus:report.goalStatus,performanceTargetPassed:report.performanceTargetPassed,sources:Object.keys(source).length,artifacts:Object.keys(artifacts).length,selectedPassingEvidence:selected.length,preservedFailures:retainedFailures.length,manifestSHA256:pin('verification/r31-final-manifest.json').sha256},null,2));
