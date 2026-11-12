// CPU-only execution of the actual main.js R30 bridge. No WebGL/browser/context.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';

const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const begin = main.indexOf('function createR30SceneBridge(captureViews){');
const end = main.indexOf('\nfunction frame(){', begin);
assert(begin >= 0 && end > begin);
const source = main.slice(begin, end);
const hookBegin = main.indexOf('    async runR30FreshSceneCheck(options={}){');
const hookEnd = main.indexOf('    async runR29SourcePeakCheck(', hookBegin);
assert(hookBegin >= 0 && hookEnd > hookBegin);
const hookSource = main.slice(hookBegin, hookEnd).trim().replace(/^async runR30FreshSceneCheck/, 'async function runR30FreshSceneCheck').replace(/,$/, '').replace(/\bimport\(/g, 'load(');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const results = [];
const test = async (name, run) => {
  try { const evidence = await run(); results.push({name, passed: true, evidence}); }
  catch (error) { results.push({name, passed: false, error: String(error.stack ?? error)}); }
};

function fixture() {
  const trace = [], failures = new Map();
  const step = name => { trace.push(name); const n = failures.get(name) ?? 0; if (n) { failures.set(name, n - 1); throw Error(`Injected ${name}`); } };
  const scene = new THREE.Scene(), originalRig = new THREE.Group(), ownedRig = new THREE.Group();
  for (const rig of [originalRig, ownedRig]) rig.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const sibling = new THREE.Group(); scene.add(sibling, originalRig);
  const oldTarget = {name: 'original-aa-target', storageGeneration: 0};
  const gl = {drawingBufferFormat: 34842, isContextLost: () => false, drawingBufferStorage() { step('drawingBufferStorage'); }};
  const renderer = {
    target: oldTarget, face: 2, mip: 1, logical: [1209, 1292], ratio: 1,
    domElement: {width: 1209, height: 1292, style: {width: '1209px', height: '1292px'}},
    getContext() { trace.push('CPU context stub'); return gl; },
    getSize(v) { return v.set(...this.logical); }, getDrawingBufferSize(v) { return v.set(this.domElement.width, this.domElement.height); },
    getPixelRatio() { return this.ratio; }, getRenderTarget() { return this.target; }, getActiveCubeFace() { return this.face; }, getActiveMipmapLevel() { return this.mip; },
    setRenderTarget(target, face = 0, mip = 0) { step(target ? 'bind original semantic target' : 'bind default target'); this.target = target; this.face = face; this.mip = mip; },
    setDrawingBufferSize(w, h, ratio) { step('setDrawingBufferSize'); this.logical = [w, h]; this.ratio = ratio; this.domElement.width = Math.floor(w * ratio); this.domElement.height = Math.floor(h * ratio); }
  };
  const camera = new THREE.PerspectiveCamera(50, 1209 / 1292, .1, 10000); camera.position.set(1, 2, 3);
  const lens = {state: {width: 1209, height: 1292, outputWidth: 1209, outputHeight: 1292, storageEV: 5, dynamicLighting: true}, hdr: {name:'hdr'},
    setHDROutput(value) { step(value ? 'reconnect HDR' : 'detach HDR'); this.hdr = value; },
    setSize(w, h, ow, oh) { step('lens.setSize'); Object.assign(this.state, {width:w, height:h, outputWidth:ow, outputHeight:oh}); oldTarget.storageGeneration++; },
    resetTemporalHistory() { step('history invalidate'); }, setFrameExposure(ev, {dynamic}) { step('lens.setFrameExposure'); this.state.storageEV = ev; this.state.dynamicLighting = dynamic; }, render() { throw Error('No renderer draw in CPU bridge test'); }
  };
  const water = {uniforms: {uTime: {value: 42}, uDebugMode: {value: 0}}, size: [1209,1292],
    resize(w,h) { step('water.resize'); this.size=[w,h]; }, diagnostics() { return {size:this.size}; }, render() { throw Error('No water draw in CPU bridge test'); }};
  const originalFW = {rig:originalRig, diagnostics:()=>({launches:0,activeEvents:[],settings:{ordinary:true}})};
  const originalSmoke = {packetCount:0, diagnostics:()=>({state:{revision:8}})};
  const oldSource = {diagnostics:()=>({effective:true,name:'original'})}, oldInput = {original:true};
  const state = {storageEV:5,cameraEV:3,components:{old:true}};
  const radiometry = {state, update(value) { step('radiometry.update'); this.state={storageEV:value.recommendedEV,cameraEV:value.cameraExposureEV,components:value.bounds}; }};
  const ownedFW = {rig:ownedRig,diagnostics:()=>({settings:{native:true},records:1420})};
  const ownedSmoke = {diagnostics:()=>({state:{revision:4785}})};
  const pair = {fireworks:ownedFW,pyroSmoke:ownedSmoke,time:163.02687017173076,assertReady(){step('pair.assertReady');}};
  const field = {diagnostics:()=>({effective:false,name:'owned'})};
  const ctx = vm.createContext({THREE,JSON,Reflect,Object,Array,Math,Error,String,structuredClone,
    scene,camera,lens,water,renderer,radiometry,hdrOutput:lens.hdr,document:{body:{inert:false}},
    controls:{enabled:true,target:new THREE.Vector3()},
    fireworks:originalFW,pyroSmoke:originalSmoke,qaSmokeTransmissionField:oldSource,qaSmokeTransmissionInput:oldInput,
    time:42,effectiveWind:[1,0,0],frameSnapshot:{storageEV:5,outputExposureScale:1,old:true},
    parameters:{paused:true,quality:'medium',graphics:{systemCalibration:true,peakNits:700,hdr:'auto'},renderSampling:{dprCap:1.65},lens:{focal:35}},
    fireworksSettings:{persistentSmoke:true,resolvedSmokeLighting:true,cloudIllumination:true},qaSmokeTransmissionMode:'fast',
    localLights:{state:{mode:'night',linked:true,lamps:[],flashlight:false},apply(){step('local light decoration');}},
    indirectLighting:{apply(){step('indirect decoration');}},atmosphere:{},applyCloudLighting(){step('cloud decoration');},
    celestialController:{state:{mode:'manual',utcMs:1,running:false,rate:1,observer:{lat:0},timeZoneOffsetMinutes:480}},
    innerWidth:1209,innerHeight:1292,devicePixelRatio:1,renderScale:.8,interactionEpoch:0,pauseIntentEpoch:0,graphicsContextInterrupted:false,
    inspectR30SceneInventory:()=>({visibleDrawUnits:35}),currentOptics:()=>({width:1209,height:1292}),RAW_PER_CANDELA:3.6e-5,lastPausedRenderKey:'old'
  });
  vm.runInContext(source + '\nthis.makeBridge=createR30SceneBridge;',ctx);
  const bridge = ctx.makeBridge(async()=>({ownedCPUViews:true}));
  const restored = () => {
    assert.equal(ctx.fireworks,originalFW); assert.equal(ctx.pyroSmoke,originalSmoke);
    assert.equal(ctx.qaSmokeTransmissionField,oldSource); assert.equal(ctx.qaSmokeTransmissionInput,oldInput);
    assert.equal(ctx.time,42); assert.equal(ctx.frameSnapshot.old,true);
    assert.equal(originalRig.visible,true); assert.equal(originalRig.parent,scene); assert.equal(scene.children.indexOf(originalRig),1);
    assert.equal(ownedRig.parent,null); assert.equal(ctx.document.body.inert,false); assert.equal(ctx.controls.enabled,true);
    assert.equal(lens.hdr,ctx.hdrOutput); assert.equal(water.uniforms.uTime.value,42);
  };
  return {ctx,bridge,pair,field,trace,failures,renderer,lens,water,oldTarget,restored};
}

await test('actual bridge success: semantic target, original identity, dimensions, and interactivity restore without rendering',()=>{
  const f=fixture(),before=f.bridge.fingerprint(); const installed=f.bridge.install(f.pair,f.field);
  assert(installed.flags.ownedInstalled); assert(installed.flags.originalRigPreserved);
  assert(f.trace.indexOf('bind default target')<f.trace.indexOf('setDrawingBufferSize'));
  assert.equal(f.ctx.document.body.inert,true); assert.equal(f.ctx.controls.enabled,false);
  const result=f.bridge.restore({allowPresentation:false}); f.restored(); assert(result.passed);
  assert.deepEqual(f.renderer.logical,[1209,1292]); assert.equal(f.renderer.target,f.oldTarget); assert.equal(f.renderer.face,2); assert.equal(f.renderer.mip,1);
  assert.equal(f.oldTarget.storageGeneration,2); assert.equal(f.bridge.fingerprint(),before);
  assert.equal(f.bridge.restore({allowPresentation:false}),result);
  return {draws:0,targetObjectPreserved:true,physicalStorageRebuilt:true,historyIdentityClaim:false,steps:f.trace};
});
await test('partial install failure before rig swap rolls back original state',()=>{
  const f=fixture(); f.failures.set('indirect decoration',1);
  assert.throws(()=>f.bridge.install(f.pair,f.field),/Injected indirect/);
  const result=f.bridge.restore({allowPresentation:false}); f.restored(); assert(result.passed);
  return {draws:0,originalRefs:result.originalRefs,rigParentAndSiblingPreserved:result.rigParentAndSiblingPreserved};
});
await test('partial install drawing-buffer failure still has an installed rollback lease',()=>{
  const f=fixture();f.failures.set('setDrawingBufferSize',1);
  assert.throws(()=>f.bridge.install(f.pair,f.field),/Injected setDrawingBufferSize/);
  const result=f.bridge.restore({allowPresentation:false});f.restored();assert(result.passed);
  assert.deepEqual(f.renderer.logical,[1209,1292]);
  return {draws:0,originalRefs:result.originalRefs};
});
await test('restore dimension and target exceptions are reported while remaining cleanup continues',()=>{
  const f=fixture();f.bridge.install(f.pair,f.field);
  f.failures.set('setDrawingBufferSize',1);f.failures.set('lens.setSize',1);f.failures.set('bind original semantic target',1);
  const result=f.bridge.restore({allowPresentation:false});f.restored();assert.equal(result.passed,false);
  assert.equal(result.errors.length,3);assert(f.trace.includes('radiometry.update'));
  assert(f.trace.includes('lens.setFrameExposure'));assert.equal(f.lens.hdr,f.ctx.hdrOutput);
  assert.equal(f.bridge.restore({allowPresentation:false}),result);
  return {draws:0,stages:result.errors.map(e=>e.stage),cleanupCompleted:true,retryDoesNotRerun:true};
});
await test('current resized viewport is preserved instead of restoring obsolete dimensions',()=>{
  const f=fixture();f.bridge.install(f.pair,f.field);f.ctx.innerWidth=900;f.ctx.innerHeight=600;f.ctx.devicePixelRatio=2;
  const result=f.bridge.restore({allowPresentation:false});f.restored();assert(result.passed);assert(result.viewportChanged);
  assert.deepEqual(f.renderer.logical,[900,600]);assert.equal(f.renderer.ratio,1.65);
  assert.equal(f.ctx.camera.aspect,1.5);assert.deepEqual(f.water.size,[1188,792]);
  return {draws:0,logical:f.renderer.logical,ratio:f.renderer.ratio,waterSize:f.water.size,cameraAspect:f.ctx.camera.aspect};
});
await test('fingerprint excludes only automatic derived peak while tracking new intent and scene changes',()=>{
  const f=fixture(),base=f.bridge.fingerprint();f.ctx.parameters.graphics.peakNits=1270;assert.equal(f.bridge.fingerprint(),base);
  f.ctx.parameters.graphics.hdr='off';assert.notEqual(f.bridge.fingerprint(),base);
  f.ctx.parameters.graphics.hdr='auto';f.ctx.pauseIntentEpoch++;assert.notEqual(f.bridge.fingerprint(),base);
  return {derivedPeakIgnored:true,newIntentAndEpochTracked:true,draws:0};
});

function hookFixture({mode='pass',restorePassed=true,changeDuringImport=false,presentationThrows=false}={}) {
  const events=[],ctx=vm.createContext({Reflect,JSON,Math,Error,String,performance});
  const originalFW={diagnostics:()=>({active:0,queued:0})};
  Object.assign(ctx,{qaRenderLock:false,qaFrozenWorkload:null,renderBenchmark:{active:false},graphicsContextInterrupted:false,
    parameters:{paused:true,director:{mode:'off'},graphics:{hdr:'auto'}},qualityApplying:false,qaSmokeVariants:null,inspection:null,
    throwGesture:null,pendingThrow:null,transition:null,fireworks:originalFW,pyroSmoke:{packetCount:0},
    frozenWorkloadInfo:()=>({intent:ctx.intent}),intent:1,createFireworks(){},createPyroSmoke(){},terrainHeight(){},createAtollAirSurface(){},
    THREE:{},renderer:{},createSmokeTransmissionGPU(){},clock:{getDelta(){events.push('clock drain');}},
    camera:{position:{toArray:()=>[1,2,3],distanceTo:()=>1}},controls:{target:{toArray:()=>[0,0,0]}},
    renderScale:1,innerWidth:1209,innerHeight:1292,scene:{environment:{uuid:'env'}},
    water:{uniforms:{uDebugMode:{value:0}},render(){events.push('original water presentation');}},
    lens:{render(){events.push('original lens presentation');if(presentationThrows)throw Error('Injected original presentation error');}},time:42,
    frameSnapshot:{storageEV:5,outputExposureScale:1},celestialFrame:{physicalSkyRevision:3},localLights:{state:{flashlight:false}},
    setAir(){events.push('original air');},updateScenePhotometry(){events.push('original photometry');},
    lastPausedRenderKey:'old',pausedSteadyFrames:0,pausedRenderCached:false
  });
  const bridge={restore(){events.push('bridge restore');return{changed:true,passed:restorePassed,errors:restorePassed?[]:[{stage:'injected restore'}]};}};
  ctx.createR30SceneBridge=()=>{events.push('bridge create');return bridge;};
  ctx.load=async path=>{
    events.push('load');if(changeDuringImport)ctx.intent++;
    if(path.includes('fresh-scene'))return{runR30FreshSceneCheck:async(_t,_r,options)=>{
      events.push('measured helper');assert.equal(options.parentLocked,true);assert.equal(options.bridge,bridge);assert.equal(ctx.qaRenderLock,true);
      if(mode==='throw')throw Error('Injected measured error');return{passed:mode==='pass'};
    }};
    if(path.includes('native-replay'))return{replayR30NativePair(){throw Error('No replay invoked by hook spy');}};
    return{captureR30CurrentViews(){}};
  };
  vm.runInContext(hookSource+'\nthis.hook=runR30FreshSceneCheck;',ctx);
  return{ctx,events};
}
await test('actual hook rejects busy and changed loading state before installing any private scene',async()=>{
  for(const key of ['qaRenderLock','qualityApplying','graphicsContextInterrupted']){
    const f=hookFixture();f.ctx[key]=true;await assert.rejects(()=>f.ctx.hook(),/Pause an empty/);assert.equal(f.events.length,0);
  }
  const f=hookFixture({changeDuringImport:true});await assert.rejects(()=>f.ctx.hook(),/Scene changed during diagnostic loading/);
  assert.equal(f.ctx.intent,4);assert.equal(f.ctx.qaRenderLock,false);assert(!f.events.includes('bridge create'));
  return{draws:0,mutationPreserved:true,loadingRaceRejected:true};
});
await test('actual hook successful helper restores first then separately presents original scene',async()=>{
  const f=hookFixture(),result=await f.ctx.hook();assert(result.passed);assert(result.originalPresentationRebuild.passed);
  assert(f.events.indexOf('bridge restore')<f.events.indexOf('original water presentation'));
  assert(f.events.indexOf('original lens presentation')<f.events.indexOf('clock drain'));assert.equal(f.ctx.qaRenderLock,false);
  return{events:f.events,originalPresentationIncludedInMeasurement:false};
});
await test('actual hook failed helper or restoration freezes paused presentation and releases its lock',async()=>{
  for(const options of [{mode:'fail'},{restorePassed:false},{mode:'throw'}]){
    const f=hookFixture(options);let result;
    if(options.mode==='throw')await assert.rejects(()=>f.ctx.hook(),/Injected measured error/);else result=await f.ctx.hook();
    assert.equal(f.ctx.qaRenderLock,false);assert.equal(f.ctx.pausedSteadyFrames,41);assert.equal(f.ctx.pausedRenderCached,true);
    assert(!f.events.includes('original water presentation'));assert.equal(typeof f.ctx.lastPausedRenderKey,'string');
    if(result)assert.equal(result.passed,false);
  }
  return{draws:0,failureVariants:3,originalPresentationSkipped:true,lockReleased:true};
});
await test('separate original presentation failure retains measured success separately and prevents automatic paused redraw',async()=>{
  const f=hookFixture({presentationThrows:true}),result=await f.ctx.hook();
  assert.equal(result.passed,false);assert.equal(result.measurementPassed,true);assert.equal(result.originalPresentationRebuild.passed,false);
  assert.equal(f.ctx.qaRenderLock,false);assert.equal(f.ctx.pausedSteadyFrames,41);assert.equal(f.ctx.pausedRenderCached,true);
  assert.equal(typeof f.ctx.lastPausedRenderKey,'string');assert.notEqual(f.ctx.lastPausedRenderKey,'old');
  assert.equal(f.events.filter(e=>e==='original lens presentation').length,1);
  return{measurementPassed:true,restorationPresentationPassed:false,pausedCacheFrozen:true,noAutomaticExperimentalRetry:true};
});

const report={schema:'glass-atoll.r30-main-bridge-independent-cpu.v1',dateUTC:new Date().toISOString(),
  passed:results.every(r=>r.passed),actualGPU:false,browserUsed:false,nativeContextAccess:false,
  mainSHA:sha(main),bridgeSHA:sha(source),hookTransformedSHA:sha(hookSource),scope:'Actual extracted main bridge and hook with CPU spies only; hook imports are replaced by CPU stubs. No native framebuffer identity, pixel, live GL, or temporal-history equivalence proof',
  summary:{passed:results.filter(r=>r.passed).length,total:results.length},results};
fs.writeFileSync(new URL('./r30-main-bridge-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
