import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=n=>fs.readFileSync(path.join(root,n));
const json=n=>JSON.parse(read(n).toString('utf8').replace(/^\uFEFF/,''));
const pin=n=>{const b=read(n);return{sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};};
const previous=json('verification/r26-final-manifest.json'),source={},changed=[];
for(const [name,before]of Object.entries(previous.source)){
  source[name]=pin(name);
  if(source[name].sha256!==before.sha256)changed.push(name);
}
assert.deepEqual(changed.sort(),['main.js','package.json','pyro-smoke-transmission-gpu.js','pyro-smoke-transmission-pack.js','smoke-transmission-layout.js'].sort());
source['smoke-transmission-rectangles.js']=pin('smoke-transmission-rectangles.js');
const promoted=json('verification/r27-production-promotion-pins.json');
assert.equal(promoted.productionPromotionPendingHardwareCheck,false);
for(const [name,expected]of Object.entries(promoted.source))assert.equal(source[name].sha256,expected,name);
assert.equal(source['fireworks-audio.js'].sha256,'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
assert.equal(source['pyro-smoke-renderer.js'].sha256,'4f152a1470d8351b997728691bc2e0ec15ee0962b55926179917cb42ce7ee3dd');

const currentReports=[
  'r27-native-transmission-fixture-check.json','r27-native-input-independent-check.json',
  'r27-active-policy-independent-check.json','r27-deployed-transmission-check.json',
  'r27-deployed-integration-independent-check.json','r27-production-helper-independent-check.json',
  'r27-production-native-gpu-preflight.json','r27-production-root-audit.json',
  'r27-production-native-actual-gpu.json','r27-production-actual-independent-audit.json',
  'r27-production-native-receipt-independent-audit.json','r27-native-production-actual-read-audit.json',
  'r27-user-restoration-check.json'
];
const chronologicalReports=[
  'r27-native-hook-root-audit.json','r27-production-staging-check.json','r27-production-staging-independent-check.json',
  'r27-complete-native-gpu-preflight.json','r27-complete-native-helper-independent-check.json',
  'r27-complete-native-independent-read-check.json','r27-complete-native-actual-gpu.json',
  'r27-native-actual-independent-audit.json','r27-complete-native-receipt-independent-audit.json',
  'r27-native-candidate-actual-read-audit.json'
];
function summarize(names,phase){
  return Object.fromEntries(names.map(name=>{
    const r=json('verification/'+name);assert.equal(r.passed,true,name);
    return[name,{phase,passed:true,counts:r.counts??r.summary??null,actualGPU:r.actualGPU===true,sha256:pin('verification/'+name).sha256}];
  }));
}
const validation={current:summarize(currentReports,'current deployed / immutable input / saved receipt'),chronological:summarize(chronologicalReports,'frozen candidate or prepromotion proof; original source guards may intentionally differ from current deployment')};
const actualReceipts={};
for(const [name,expected]of [
  ['r27-complete-native-actual-gpu.json','86a90df6d76f2c5e418c2743652561a4003574df5404444005699f6481e8f0e1'],
  ['r27-production-native-actual-gpu.json','e55220fb5c9fcaf0e8f6e12be4ab01cb5c53060e636b3f4c243de6ea8cfbf987']
]){
  const n='verification/'+name,r=json(n);
  assert.equal(pin(n).sha256,expected);assert.equal(r.actualGPU,true);assert.equal(r.passed,true);
  assert.equal(r.actualDraws,4);assert.equal(r.prepares,1);assert.equal(r.readbackBytes,27856);
  assert.deepEqual(r.glErrors,[]);assert.deepEqual(r.shaderErrors,[]);
  actualReceipts[name]={sha256:expected,draws:4,prepares:1,readbackBytes:27856,timedIntervals:r.timedIntervals,cpuSubmitMs:r.cpuSubmitMs};
}
const deployed=json('verification/r27-production-native-actual-gpu.json').productionDiagnostics;
assert.deepEqual(deployed.caps,{maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:1400000,maxMapPairs:1000000,maxMapDraws:8});
assert.equal(deployed.pairs,1309170);assert.equal(deployed.count,1734);assert.equal(deployed.effective,true);
const generation=json('verification/r27-native-transmission-fixture-generation.json');
assert.equal(generation.snapshotPackets,755);assert.equal(generation.resolved.emissionSourceCount,1728);
assert.equal(generation.resolved.logicalPairs,1304640);assert.equal(generation.resolved.effective,false);
assert.equal(generation.fixtureDigest,'b400c7e03f674a15a1590d92fcc016b91638322e4ebc6b8eca2b2534d5aa860d');
assert.equal(pin('verification/r27-native-transmission-fixture.js').sha256,generation.moduleSHA256);
assert.equal(pin('verification/r27-native-transmission-fixture.json').sha256,generation.jsonSHA256);
const restoration=json('verification/r27-user-restoration-check.json');assert.equal(restoration.counts.exact,28);
assert.deepEqual(json('verification/r27-final-console.json'),[]);
const legacy=json('verification/r27-legacy-recheck-assessment.json');
assert.equal(legacy.assessmentPassed,true);assert.equal(legacy.allLegacyTestsPassed,false);
assert.equal(json('verification/r17-smoke-transmission-admission-check.json').passed,true);
assert.equal(json('verification/r23-layout-planner-check.json').passed,true);
assert.equal(json('verification/r16-smoke-transmission-pack-check.json').passed,false);
assert.equal(json('verification/r27-legacy-pack-baseline-check.json').passed,false);

const artifacts={};
function walk(dir){
  for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    const n=dir+'/'+e.name;
    if(e.isDirectory()){
      if(n==='verification/plans'||n==='verification/baselines'||n.startsWith('verification/baselines/r27')||/^verification\/r27-/i.test(n))walk(n);
    }else if((/^r27/i.test(e.name)||n.startsWith('verification/plans/R27')||n.startsWith('verification/baselines/r27')||/^verification\/r27-[^/]+\//i.test(n))&&!n.endsWith('/r27-final-manifest.json'))artifacts[n]=pin(n);
  }
}
walk('verification');
for(const n of ['README.md','verification/plans/PROGRESS.md','verification/seal-r27.mjs',
  'verification/r26-final-manifest.json','verification/r16-smoke-transmission-pack-check.json',
  'verification/r17-smoke-transmission-admission-check.json','verification/r23-layout-planner-check.json'])artifacts[n]=pin(n);
for(const doc of ['verification/R27-NATIVE-SOURCET-CHECKPOINT.md','verification/R27-NATIVE-TRANSMISSION-FIXTURE.md']){
  const text=read(doc).toString('utf8');
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    if(/^(?:https?:|#)/.test(match[1]))continue;
    const target=path.resolve(path.dirname(path.join(root,doc)),match[1]);
    if(target.endsWith('r27-final-manifest.json'))continue;
    assert(fs.existsSync(target),'Missing checkpoint link: '+match[1]);
  }
}
const report={
  schema:'glass-atoll.r27-final-manifest.v1',sealedUTC:new Date().toISOString(),goalStatus:'active',
  source,sourceDeltaFromR26:{changed,added:['smoke-transmission-rectangles.js'],scope:'Complete synchronous SourceT upgrade with explicit live request/map policy; exactly two QA entry methods and syntax list addition. All other inherited runtime pins unchanged.'},
  validation,actualReceipts,
  nativeWorkload:{artifactDigest:generation.fixtureDigest,packets:755,mainRows:1734,mainPairs:1309170,reflectionRows:0,reflectionSubmitted:false,lightingLedgerRows:1728,lightingPairs:1304640,lightingStillRejected:true},
  deployedCaps:deployed.caps,allocation:{gpuNumericalBytes:deployed.gpuNumericalBytes,cpuInputBufferBytes:deployed.cpuInputBufferBytes},
  syntax:{command:'npm run check',exitCodeObserved:0,log:'verification/r27-runtime-syntax-check.log'},
  legacyAssessment:{assessmentPassed:true,allLegacyTestsPassed:false,report:'verification/r27-legacy-recheck-assessment.json',R16:'7/8 on both current and exact prepromotion baseline: historical 14001-row throw assertion is obsolete',R17:'12/12',R23:'8/8'},
  userRestoration:{exact:28,total:28,paused:true,derivedHDRPeakBefore:700,derivedHDRPeakAfter:700,consoleErrors:[],screenshot:'verification/r27-restored-ui.png'},
  server:{address:'127.0.0.1',port:5186,pid:23820,verification:'Get-NetTCPConnection -LocalPort 5186 -State Listen observed at final seal; no server restart'},
  artifacts,
  nextPlan:'verification/plans/R27-NEXT-EXACT-SH-GATE-INDEPENDENT.md',
  limitations:[
    'One actual native main-view SourceT numerical request per gate; no native scene/volume draw, reflected draw or resolved SH bake in these four draws.',
    'Cold instrumented GPU/CPU intervals are not a speedup A/B, full-frame benchmark, evolving simulation or 60FPS proof.',
    'SH lighting retains its independent old request ceiling and rejects the frozen 755x1728 ledger; SourceT requests above1.4m still fall back.',
    'Exact chunks bound individual work but do not reduce the complete pair count; timer is retrospective after all synchronous draws are queued.',
    'Current N8/contact lifetime counts must be measured before a larger budget; historical3.986m belongs to a distinct N10/no-contact fixture.',
    'All documented failures and historical reports remain archived; no historical suite-all-green claim.',
    '28 settings restored exactly; ordinary reload does not replay prior physical cloud/wave instant. Restored screenshot is not photo-quality acceptance.',
    'Ongoing smoke scale/illumination/choreography, shore runup/splash dark edge, skyline and overall visual/performance goal remains active.'
  ]
};
fs.writeFileSync(path.join(root,'verification/r27-final-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,runtimePins:Object.keys(source).length,currentPassingReports:currentReports.length,chronologicalPassingReports:chronologicalReports.length,artifacts:Object.keys(artifacts).length,sourceDelta:changed,goalStatus:report.goalStatus,allLegacyTestsPassed:false},null,2));
