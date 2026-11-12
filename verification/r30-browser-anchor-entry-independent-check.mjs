// Saved-data and extracted-entry CPU audit. Does NOT import the pending GPU helper.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import vm from 'node:vm';
import {R30_NATIVE_REPLAY_FIXTURE as nodeFixture,r30CanonicalJSON as canonical} from './r30-native-replay-fixture.js';
import {R30_BROWSER_NATIVE_REPLAY_FIXTURE as browserFixture,R30_BROWSER_NATIVE_REPLAY_FIXTURE_DIGEST as browserDigest} from './r30-browser-native-replay-fixture.js';
const here=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,here),'utf8'),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),parse=p=>JSON.parse(read(p));
const first=parse('r30-browser-native-cpu-diagnostic.json'),repeat=parse('r30-browser-native-cpu-diagnostic-repeat.json'),main=read('../main.js'),replay=read('r30-native-replay.js'),helper=read('r30-browser-fresh-scene-gpu-check.js'),oldHelper=read('r30-fresh-scene-gpu-check.js'),checks=[];
const test=async(name,fn)=>{try{checks.push({name,passed:true,evidence:await fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}};
function method(text,name){const a=text.indexOf('    async '+name+'('),b=text.indexOf('\n    },',a);assert(a>=0&&b>a,name);return text.slice(a,b+7).trim();}
const oldEntry=method(main,'runR30FreshSceneCheck'),newEntry=method(main,'runR30BrowserFreshSceneCheck'),cpuEntry=method(main,'verifyR30BrowserNativeReplay');
function numberStream(v,path='snapshot',out=[]){if(typeof v==='number'){assert(Number.isFinite(v));const b=Buffer.alloc(8);b.writeDoubleBE(v);out.push([path,b.toString('hex')]);}else if(v&&typeof v==='object')for(const k of Object.keys(v).sort())numberStream(v[k],path+'.'+k,out);return out;}
function differences(a,b,path='host',out=[]){if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],path+'.'+k,out);}else if(!Object.is(a,b))out.push({path,first:a,repeat:b});return out;}

await test('Two independent browser captures are full binary64 snapshot/ledger and derived pack exact repeats',()=>{
  for(const d of[first,repeat])assert(!d.actualGPU&&!d.admission&&!d.toleranceChanged&&d.ownedReplayDisposed&&!d.sceneObjectsPublished&&d.forbiddenRendererCalls===0&&d.originalSceneUntouched);
  assert.deepEqual(first.actual.snapshot,repeat.actual.snapshot);assert.deepEqual(first.actual.ledger,repeat.actual.ledger);
  const a=numberStream(first.actual.snapshot),b=numberStream(repeat.actual.snapshot);assert.deepEqual(a,b);assert.equal(a.length,41439);
  assert.deepEqual(first.comparison,repeat.comparison);assert.deepEqual(first.packing,repeat.packing);assert.deepEqual(first.actual.publicFireworkDiagnostics,repeat.actual.publicFireworkDiagnostics);
  const timing=differences(first.actual.publicHostDiagnostics,repeat.actual.publicHostDiagnostics);
  assert.deepEqual(timing.map(x=>x.path).sort(),['host.columns.lastBuildMs','host.columns.lastUpdateMs','host.columns.totalBuildMs','host.lastUpdateMs'].sort());
  return{snapshotNumbersExact:a.length,fullLedgerCapacityWords:first.actual.ledger.fullCapacityWordsU32.length,comparisonAndPackExact:true,publicHostDiagnosticTimingDifferences:timing,wholeReportIdentityClaim:false};
});
await test('Complete separately frozen browser anchor equals both captures and preserves every original recipe/function binding',()=>{
  assert.equal(browserDigest,'22601b52c49e031bdb8bf4136d6a75130039c60c757f6f8373385c55948a3d69');assert.equal(sha(canonical(browserFixture)),browserDigest);
  assert.equal(browserFixture.referenceKind,'same-browser-complete-exact-v1');assert.deepEqual(browserFixture.expected.snapshot,first.actual.snapshot);assert.deepEqual(browserFixture.expected.ledger,first.actual.ledger);
  assert.deepEqual(browserFixture.recipe,nodeFixture.recipe);assert.deepEqual(browserFixture.phase,nodeFixture.phase);assert.deepEqual(browserFixture.functionPins,nodeFixture.functionPins);
  assert.deepEqual(browserFixture.expected.publicFireworkDiagnostics,first.actual.publicFireworkDiagnostics);
  assert.deepEqual(browserFixture.expected.publicSourceScheduler,first.actual.publicHostDiagnostics.events);assert.deepEqual(browserFixture.expected.publicStateDiagnostics,first.actual.publicHostDiagnostics.state);
  assert.equal(sha(canonical(browserFixture.recipe)),browserFixture.provenance.recipeCanonicalDigest);assert.equal(sha(canonical(numberStream(browserFixture.expected.snapshot,'value'))),browserFixture.provenance.sameBrowserSnapshotFullHexDigest);
  assert.equal(browserFixture.provenance.firstCapture.sha256,sha(read('r30-browser-native-cpu-diagnostic.json')));assert.equal(browserFixture.provenance.repeatCapture.sha256,sha(read('r30-browser-native-cpu-diagnostic-repeat.json')));
  assert.equal(browserFixture.provenance.negativeZeroCountSnapshot,0);assert.equal(browserFixture.provenance.negativeZeroCountLedger,0);assert.equal(browserFixture.provenance.nonfiniteSnapshotNumbers,0);
  assert(browserFixture.provenance.noOpticalTexturesOrReferences);assert.equal(browserFixture.expected.privateRecordsScope.includes('no private body/record array'),true);
  return{wholeAnchorDigest:browserDigest,recipeDigest:browserFixture.provenance.recipeCanonicalDigest,originalNodeFixturePreserved:true,fullPhysicalDataIncluded:true,allOriginalUpdateTimesAndFactoryPinsExact:true,actualReferenceDataInjected:false};
});
await test('New main scene entry is only the three fixed name substitutions; original guard/restore and bridge stay byte exact',()=>{
  assert.equal(sha(main),'bfe586ddebfb2d47eb83f285762ecf1acfe92e773862699092bf88c178545777');
  const inverse=newEntry.replaceAll('runR30BrowserFreshSceneCheck','runR30FreshSceneCheck').replaceAll('replayR30BrowserNativePair','replayR30NativePair').replaceAll('r30-browser-fresh-scene-gpu-check.js','r30-fresh-scene-gpu-check.js');assert.equal(inverse,oldEntry);
  const originalMain=read('baselines/r30-before-cpu-diagnostic-entry/main.js');assert.equal(sha(originalMain),'1e6e2f70a42ad38749a88f907e1bd837cb59ab6e51af645dcd87557fd0e035cd');assert.equal(oldEntry,method(originalMain,'runR30FreshSceneCheck'));
  const bridge=main.slice(main.indexOf('function createR30SceneBridge(captureViews){'),main.indexOf('\nfunction frame(){')).trim();assert.equal(sha(bridge),'c1fdde519b7868c0d20a1a9ade83d1d6d50a7a4d5a299c3a3be0fb8926f4bf5f');
  return{mainSHA:sha(main),oldEntrySHA:sha(oldEntry),inverseEntrySHA:sha(inverse),bridgeSHA:sha(bridge),oldFailurePathRetained:true};
});
await test('Frozen successor measurement functions and complete timed-frame tail are unchanged from previously CPU-reviewed acf6 source',()=>{
  assert.equal(sha(helper),'19073ac5f4ee82e9221f33e3e0de06d021088783d3f69852c604272efcc7ec82');assert.equal(sha(oldHelper),'acf6d1a71bdff2b36b1e0e98bd2a0aaded6d0da46eba6c61a8cadd793e144f8b');
  const pure=s=>s.slice(s.indexOf('const TCTOR='),s.indexOf('function validatePinSchema()'));
  assert.equal(pure(helper),pure(oldHelper));
  const tail=s=>s.slice(s.indexOf('  const before=pair.pyroSmoke.diagnostics()'));
  assert.equal(tail(helper),tail(oldHelper));
  assert(helper.includes('pair.receipt.referenceDigest===browserFixtureDigest')&&helper.includes('pair.receipt.recipeIdentityDigest===browserFixture.provenance.recipeCanonicalDigest'));
  assert(helper.includes('pair.receipt.noReferenceStateInjected===true')&&helper.includes('pair.receipt.completeLedgerCapacityWordsExact===true')&&helper.includes('pair.receipt.fullPublicStateDiagnosticsExact===true'));
  return{pendingHelperImported:false,draws143:true,elements19279476:true,wholeFrameLimit100ms:true,measurementKernelStateCaptureAndCleanupByteExact:true,newReferenceQualificationOnly:true};
});

function cpuHarness(mode='pass'){
  const events=[],realRenderer={getContext(){throw Error('REAL context forbidden');},render(){throw Error('REAL render forbidden');}},params={paused:true,graphics:{systemCalibration:true,peakNits:700}};
  const ctx=vm.createContext({Object,Reflect,JSON,Error,structuredClone,qaRenderLock:false,qaFrozenWorkload:null,renderBenchmark:{active:false},graphicsContextInterrupted:false,parameters:params,qualityApplying:false,
    fireworks:{diagnostics:()=>({active:0,queued:0})},pyroSmoke:{packetCount:0},clock:{getDelta(){events.push('clock');}},THREE:{},renderer:realRenderer,createFireworks(){},createPyroSmoke(){},terrainHeight(){},createAtollAirSurface(){},
    frozenWorkloadInfo:()=>({parameters:structuredClone(params)}),requestAnimationFrame:resolve=>resolve()});
  let disposed=false;
  const pair={receipt:{passed:true,referenceKind:'same-browser-complete-exact-v1'},assertReady(){events.push('assertReady');},dispose(){events.push('dispose');disposed=true;if(mode==='dispose-throws')throw Error('Injected disposal error');},get disposed(){return disposed;}};
  ctx.load=async()=>({replayR30BrowserNativePair:async(_three,inert,options)=>{
    assert.notEqual(inert,realRenderer);assert(Object.isFrozen(inert));assert.deepEqual(Object.keys(inert).sort(),['getContext','render']);assert.equal(ctx.qaRenderLock,true);assert.equal(options.createFireworks,ctx.createFireworks);
    if(mode==='native-attempt')inert.getContext();await options.yieldControl();return pair;
  }});
  vm.runInContext(cpuEntry.replace('async verifyR30BrowserNativeReplay','async function verifyR30BrowserNativeReplay').replace(/,$/,'').replace(/\bimport\(/g,'load(')+'\nthis.verify=verifyR30BrowserNativeReplay;',ctx);
  return{ctx,events};
}
await test('Actual extracted positive CPU entry only passes an inert facade and always disposes/unlocks, even on failure',async()=>{
  const success=cpuHarness(),r=await success.ctx.verify();assert(r.strictBrowserReplayPassed&&!r.actualGPU&&r.ownedReplayDisposed&&r.forbiddenRendererCalls===0&&r.originalSceneUntouched&&!r.sceneObjectsPublished);assert.equal(success.ctx.qaRenderLock,false);
  const attempt=cpuHarness('native-attempt');await assert.rejects(()=>attempt.ctx.verify(),/may not render or obtain a graphics context/);assert.equal(attempt.ctx.qaRenderLock,false);
  const disposal=cpuHarness('dispose-throws');await assert.rejects(()=>disposal.ctx.verify(),/Injected disposal/);assert.equal(disposal.ctx.qaRenderLock,false);assert(disposal.events.includes('clock'));
  const blocked=cpuHarness();blocked.ctx.renderBenchmark.active=true;await assert.rejects(()=>blocked.ctx.verify(),/Pause an empty/);assert.equal(blocked.events.length,0);
  return{actualPhysicalReplayRun:false,actualRendererNeverPassed:true,inertNativeAttemptThrows:true,disposalFailureStillUnlocks:true,busyGuardBeforeReplay:true};
});
const report={schema:'glass-atoll.r30-browser-anchor-entry-independent.v1',actualGPU:false,browserActions:0,physicalReplays:0,pendingGPUHelperImported:false,passed:checks.every(c=>c.passed),summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourcePins:{main:sha(main),replay:sha(replay),browserLiteral:sha(read('r30-browser-native-replay-fixture.js')),browserFixtureDigest:browserDigest,successorHelperReadOnly:sha(helper)},checks,
  decision:'Saved same-browser exact repeat and fixed complete anchor are justified. Root must still obtain the positive strict browser-reference replay receipt through the inert facade before any successor composed-frame GPU gate. This CPU/source audit never grants an automatic GPU retry or changes any epsilon/model/kernel.',
  limits:['Full host diagnostics are not identical: four elapsed timing fields differ; full physical snapshot/state/scheduler/fireworks/ledger are exact.','User-agent match is provenance, not a general engine identity proof; complete exact replay remains authoritative.','Snapshot repeat does not prove complete private browser body/record arrays, arbitrary inputs, HDR display transport or sustained FPS.']};
fs.writeFileSync(new URL('r30-browser-anchor-entry-independent-check.json',here),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
