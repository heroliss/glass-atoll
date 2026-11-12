import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),file=path.resolve('main.js'),bytes=fs.readFileSync(file),source=bytes.toString('utf8');
assert.equal(sha(bytes),'bfe586ddebfb2d47eb83f285762ecf1acfe92e773862699092bf88c178545777');
const backup=path.resolve('verification/baselines/r31-before-native-frame');fs.mkdirSync(backup,{recursive:true});if(fs.existsSync(path.join(backup,'main.js')))assert.equal(sha(fs.readFileSync(path.join(backup,'main.js'))),sha(bytes));else fs.writeFileSync(path.join(backup,'main.js'),bytes);
const nl=source.includes('\r\n')?'\r\n':'\n';
const entryStart=source.indexOf('    async runR30BrowserFreshSceneCheck(options={}){'),entryEnd=source.indexOf('    async runR29SourcePeakCheck(',entryStart);assert(entryStart>0&&entryEnd>entryStart);
const originalEntry=source.slice(entryStart,entryEnd);
const entry=originalEntry.replaceAll('runR30BrowserFreshSceneCheck','runR31NativeSceneCheck').replaceAll('captureR30CurrentViews','captureR31CurrentViews').replaceAll('createR30SceneBridge','createR31SceneBridge').replaceAll('./verification/r30-browser-fresh-scene-gpu-check.js','./verification/r31-native-scene-gpu-check.js').replaceAll('./verification/r30-native-preplan.js','./verification/r31-native-preplan.js').replaceAll('R30 scene check','R31 native scene check');
const start=source.indexOf('function createR30SceneBridge(captureViews){'),end=source.indexOf('\nfunction frame(){',start);assert(start>0&&end>start);
const originalBridge=source.slice(start,end);
let bridge=originalBridge.replaceAll('createR30SceneBridge','createR31SceneBridge').replaceAll('R30 ','R31 ').replaceAll('r30-main-owned-scene-bridge-v1','r31-main-owned-native-scene-bridge-v1');
const planStart=bridge.indexOf('  async function plan(pair){'),planEnd=bridge.indexOf('  function install(pair,field){',planStart);assert(planStart>0&&planEnd>planStart);
const plan=`  async function plan(pair){
    demand(!closed&&!installed&&fireworks===originalFireworks&&pyroSmoke===originalSmoke,'Original scene must remain installed during CPU planning');pair.assertReady();
    const inventory=inspectR30SceneInventory(true),mainExtent={width:1209,height:1292},reflectionExtent={width:water.reflection.width,height:water.reflection.height};
    demand(inventory.renderer.drawingBufferSize[0]===1209&&inventory.renderer.drawingBufferSize[1]===1292&&inventory.lens.width===1209&&inventory.lens.height===1292,'Fixed native original main dimensions must already be resolved');
    demand(water.refraction.width===1209&&water.refraction.height===1292&&reflectionExtent.width===1209&&reflectionExtent.height===1292&&parameters.renderSampling.reflectionScale===1&&parameters.renderSampling.reflectionSamples===2,'Preserve actual native refraction/reflection dimensions and requested sampling');
    const viewExtents={main:mainExtent,reflection:reflectionExtent},optics={...currentOptics(),...mainExtent},frame={time:pair.time,storageEV:radiometry.state.storageEV,rawPerCandela:RAW_PER_CANDELA};
    const views=await captureViews(THREE,pair,{camera,reflectionCamera:water.prepareReflectionCamera(),frame,optics,viewExtents});
    pair.assertReady();const replacementUnits=inventory.visibleDrawUnits-rigUnits(originalFireworks.rig)+rigUnits(pair.fireworks.rig);
    return {...views,inventory,replacementUnits,dimensions:{...mainExtent,outputWidth:1209,outputHeight:1292,reflectionWidth:reflectionExtent.width,reflectionHeight:reflectionExtent.height,cameraAspect:camera.aspect},environmentScope:'Existing paused ocean/vegetation/cloud environment; fresh native firework/density/photometry and actual native-size SDR scene composition, without wave/hydrodynamic advancement'};
  }
`.replaceAll('\n',nl);
bridge=bridge.slice(0,planStart)+plan+bridge.slice(planEnd);
for(const [a,b] of [
 ['renderer.setDrawingBufferSize(160,171,1)','renderer.setDrawingBufferSize(1209,1292,1)'],
 ['gl.drawingBufferStorage(gl.drawingBufferFormat,160,171)','gl.drawingBufferStorage(gl.drawingBufferFormat,1209,1292)'],
 ['water.resize(160,171,parameters.quality);lens.setSize(160,171,160,171)','water.resize(1209,1292,parameters.quality);lens.setSize(1209,1292,1209,1292)']
]){assert.equal(bridge.split(a).length,2);bridge=bridge.replace(a,b);}
const installedGuard="    demand(camera.aspect===entryViewport[0]/entryViewport[1],'Original camera aspect changed during setup');";
assert(bridge.includes(installedGuard));bridge=bridge.replace(installedGuard,"    demand(water.refraction.width===1209&&water.refraction.height===1292&&water.reflection.width===1209&&water.reflection.height===1292&&water.reflection.samples===2&&lens.state.width===1209&&lens.state.height===1292,'Resolved native production targets changed during setup');"+nl+installedGuard);
assert(!bridge.includes('160,171')&&!bridge.includes('width:160')&&!bridge.includes('height:171'));
const entryInsertion=entry+originalEntry,bridgeInsertion=originalBridge+nl+nl+bridge;
let next=source.slice(0,entryStart)+entryInsertion+source.slice(entryEnd);
const bridgeAt=next.indexOf(originalBridge);assert(bridgeAt>0);next=next.slice(0,bridgeAt)+bridgeInsertion+next.slice(bridgeAt+originalBridge.length);
const inverse=next.replace(entryInsertion,originalEntry).replace(bridgeInsertion,originalBridge);assert.equal(sha(inverse),sha(bytes));
fs.writeFileSync(file,next);
const report={schema:'glass-atoll.r31-main-native-integration.v1',passed:true,beforeSHA256:sha(bytes),afterSHA256:sha(next),backup:'verification/baselines/r31-before-native-frame/main.js',newEntry:'runR31NativeSceneCheck',newFactory:'createR31SceneBridge',newBridgeRevision:'r31-main-owned-native-scene-bridge-v1',newFactorySourceSHA256:sha(bridge),inverseRecoversR30:true,existingR30EntryAndBridgeUnchanged:true,productionFactoriesAndPhysicsUnchanged:true,scope:'Adds a fixed QA native entry/bridge; normal production frame and existing R30 entry remain byte-preserved'};
fs.writeFileSync('verification/r31-main-integration.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
