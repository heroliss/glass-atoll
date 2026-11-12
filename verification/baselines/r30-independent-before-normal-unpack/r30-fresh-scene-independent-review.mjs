// Independent CPU-only review of the fixed R30 helper; never calls its GPU entry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {r30DrawWork,r30AssertViewCoherence,r30WorkBudget,r30ImagePayload,R30_SCENE_SOURCE_PATHS} from './r30-fresh-scene-gpu-check.js';
import {R30_SCENE_PINS as pins} from './r30-fresh-scene-pins.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=read('./r30-fresh-scene-gpu-check.js'),main=read('../main.js'),results=[];
const test=(name,run)=>{try{results.push({name,passed:true,evidence:run()});}catch(e){results.push({name,passed:false,error:String(e.stack??e)});}};

test('Frozen current complete source table and actual bridge pin match the reviewed deployed bytes',()=>{
  assert.equal(sha(source),'ff52b70a729637debce5a22d16b29d16a236a0ce76c8b897ce5b4195ff5aacdf');
  assert.equal(sha(main),'1e6e2f70a42ad38749a88f907e1bd837cb59ab6e51af645dcd87557fd0e035cd');
  assert(Object.isFrozen(pins)&&Object.isFrozen(pins.sources)&&Object.isFrozen(pins.functions));
  assert.deepEqual(Object.keys(pins.sources),Array.from(R30_SCENE_SOURCE_PATHS));
  for(const [path,digest]of Object.entries(pins.sources))assert.equal(sha(read(path)),digest,path);
  const bridge=main.slice(main.indexOf('function createR30SceneBridge(captureViews){'),main.indexOf('\nfunction frame(){')).trim();
  assert.equal(sha(bridge),pins.functions.bridgeFactory);assert.equal(Object.keys(pins.functions).length,12);
  return{sources:Object.keys(pins.sources).length,cachedFunctionPins:12,mainSHA:sha(main),bridgeSHA:sha(bridge)};
});
test('Separate optical, ledger, request and density namespaces admit their own association and reject stale metadata',()=>{
  const view={captureMetadata:{sourceTransmission:{recordsGeneration:667}}},sourceVersion=3;
  const d={rendered:true,instances:1402,mediumQueries:0,sourceTransmission:{backend:'gpu',effective:true,sourceVersion,densityRevision:4785,recordsGeneration:667}};
  assert(r30AssertViewCoherence(d,view,sourceVersion));
  for(const patch of [{recordsGeneration:1},{sourceVersion:2},{densityRevision:4784},{backend:'cpu'}])assert.throws(()=>r30AssertViewCoherence({...d,sourceTransmission:{...d.sourceTransmission,...patch}},view,sourceVersion));
  assert.match(source,/args\.ledger===pair\.ledger/);assert.match(source,/result\.ledgerVersion===pair\.ledger\.version/);
  assert.match(source,/result\.packetVersion===1/);assert.doesNotMatch(source,/sourceTransmission\.recordsGeneration===pair\.ledger\.recordGeneration/);
  return{syntheticCounterWitness:true,opticalRecordCounter:667,independentLedgerRecordCounter:1,requestCounter:3,densityRevision:4785,namespaceEqualityForbidden:true};
});
test('Full scene and auxiliary work bounds independently reconstruct143 draws and19,279,476 elements',()=>{
  const inventory=JSON.parse(read('./r30-initial-scene-inventory.json'));
  const scene=inventory.objects.filter(o=>o.visible).reduce((s,o)=>s+(o.indexCount||o.positions)*o.instances*o.drawUnits,0);
  assert.equal(scene,6411630);assert.equal(inventory.visibleDrawUnits,35);assert(!inventory.lights.some(l=>l.visible&&l.castShadow&&l.intensity>0));
  const plan={receipt:{passed:true,actualGPU:false,requiresActualBackendReplacement:true,packets:2301,ledgerSources:1399,densityRevision:4785,numericalDrawsPlanned:18},views:['main','reflection'].map(kind=>({kind,count:1402,sourceTPlan:{submitted:true,numericalDraws:6}})),lightPlan:{bakePasses:6},inventory,replacementUnits:35,dimensions:{width:160,height:171,cameraAspect:1209/1292}},b=r30WorkBudget(plan);
  assert.equal(b.renderCalls,3+18+2+2+16);assert.equal(b.actualDraws,3*35+18+2+2+16);
  assert.equal(b.elements,3*scene+2*2301*6+2*1402*6+18*3+16*6);assert.equal(b.elements,19279476);
  assert.equal(b.aggregateDifferentKernelPairs,2301*(1402+1402+1399));assert.equal(b.firstFrameTimerCeilingMs,100);
  assert.equal(b.blits,10);assert.equal(b.mipmaps,4);
  for(const [kind,args,count,instances] of [['drawArrays',[4,0,3],3,1],['drawElements',[4,2457600,5125,0],2457600,1],['drawArraysInstanced',[4,0,6,2301],6,2301],['drawElementsInstanced',[4,6,5123,0,1402],6,1402]])assert.deepEqual(r30DrawWork(kind,args),{count,instances,elements:count*instances});
  return{sceneElements:scene,draws:b.actualDraws,elements:b.elements,renderCalls:b.renderCalls,numericalDraws:18,fullPairSum:b.aggregateDifferentKernelPairs,firstFrameQueryLimitMs:100};
});
test('Private fresh SH and per-eye T are checked at actual draw consumption without optical substitution',()=>{
  for(const needle of ['result.reused===false','d.field.bakes===1','result.resolvedFieldVersion===report.sharedLighting.version',"u.uSourceTransmission.value===field.texture",'field.texture===job.result.texture','job.consumed=true','input.sourceVersion>2','input.sourceVersion>lastT.inputVersion','expectedLightPackets','expectedLightSources','job.packed.packetData','job.packed.sourceData','CPU source-column fallback forbidden','canonical(pair.pyroSmoke.snapshot())===canonical(pair.snapshot)'])assert(source.includes(needle),needle);
  const own=source.indexOf('pair=await replayNativePair'),plan=source.indexOf('plan=await bridge.plan(pair)'),pack=source.indexOf('for(const view of plan.views)'),context=source.indexOf('gl=renderer.getContext();');
  assert(own<plan&&plan<pack&&pack<context);assert.doesNotMatch(source,/setResolvedLightingField\(|new WebGLRenderer|createBrowser|createContext/);
  return{sharedSHBakes:1,distinctOriginalEyeRequests:2,numericalDraws:18,physicalCopiesBeforeInstallation:true,onlineAllPairOracle:false};
});
test('Native state is captured after resize and restored before bridge/resource teardown; capture precedes timer yield',()=>{
  const install=source.indexOf('const installedScene=bridge.install(pair,field)'),inner=source.indexOf('inner=capture(THREE,renderer,gl)',install),begin=source.indexOf('gl.beginQuery(timer.TIME_ELAPSED_EXT,query)'),captureImage=source.indexOf("if(name==='complete')captureImage()"),wait=source.indexOf('await new Promise(requestAnimationFrame);unchanged();',begin),read=source.indexOf('gl.readPixels(',wait),cleanup=source.indexOf('finally{\n  measuring=false;');
  assert(install<inner&&inner<begin&&begin<captureImage&&captureImage<wait&&wait<read);
  assert(source.indexOf("check('Precise installed native state restored",cleanup)<source.indexOf('bridge.restore({allowPresentation:false})',cleanup));
  assert(source.indexOf('bridge.restore({allowPresentation:false})',cleanup)<source.indexOf('field?.dispose();pair?.dispose();',cleanup));
  assert(source.includes('gl.activeTexture(oldActive);gl.bindTexture(gl.TEXTURE_2D,oldTexture);restoreInner();'));
  assert(source.includes('gpuMs<=100'));assert(source.includes('NO image readback'));assert(source.includes('All temporary method descriptors restored exactly'));
  return{innerNativeIdentityOnly:true,outerTargetSemanticOnly:true,captureInsideQueryBeforeYield:true,readbackAfterHealthyTimer:true,noAutomaticRetry:true};
});
test('Matching float/unorm capture returns exact owned bytes without lossy JSON float conversion',()=>{
  const out=[];
  for(const [type,a]of [['FLOAT',new Float32Array(160*171*4)],['UNSIGNED_BYTE',new Uint8Array(160*171*4)]]){
    a.fill(type==='FLOAT'?.25:64);const result=r30ImagePayload(a,type);
    assert.equal(result.bytes,type==='FLOAT'?437760:109440);assert.deepEqual(Buffer.from(result.rgbaBase64,'base64'),Buffer.from(a.buffer));assert.equal(result.rowOrder,'bottom-up');out.push({type,bytes:result.bytes});
  }
  const bad=new Float32Array(160*171*4);bad.fill(.25);bad[0]=NaN;assert.throws(()=>r30ImagePayload(bad,'FLOAT'));assert.throws(()=>r30ImagePayload(new Uint8Array(160*171*4),'UNSIGNED_BYTE'));
  return{formats:out,hdrPresentationExcluded:true,visualApprovalRequiresActualImage:true};
});
const report={schema:'glass-atoll.r30-fresh-scene-independent-review.v1',dateUTC:new Date().toISOString(),passed:results.every(r=>r.passed),actualGPU:false,browserActions:0,nativeContextCalls:0,productionEdits:0,
  helperSHA:sha(source),pinsModuleSHA:sha(read('./r30-fresh-scene-pins.js')),mainSHA:sha(main),summary:{passed:results.filter(r=>r.passed).length,total:results.length},results,
  scope:'Independent source and pure-function CPU checks only. Does not execute renderer wrappers or assert actual hardware state/pixels. This admits one separately root-owned fixed composed SDR gate, not native-resolution/evolving FPS, HDR transport, or multi-event performance.',
  retainedFinding:'Earlier109 helper equated optical updateRecords generation with emission ledger generation. This definite pre-hardware blocker was repaired before this review; old helper/pins/8-of-8 owner receipt are retained separately.'};
fs.writeFileSync(new URL('./r30-fresh-scene-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
