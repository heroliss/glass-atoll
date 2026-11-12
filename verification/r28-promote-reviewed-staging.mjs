import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=n=>fs.readFileSync(n,'utf8'),json=n=>JSON.parse(read(n));
for(const n of ['r28-complete-native-light-actual-gpu.json','r28-native-light-receipt-independent-check.json','r28-native-light-actual-independent-audit.json','r28-staging-integration-independent-check.json'])assert.equal(json('verification/'+n).passed,true,n);
const qapins=json('verification/r28-qa-hook-pins.json');assert.equal(hash(read('main.js')),qapins.mainSHA256);
const initial=json('verification/r28-start-pins.json');for(const[n,p]of Object.entries(initial.source)){if(n!=='main.js')assert.equal(hash(fs.readFileSync(n)),p.sha256,n);}
const pins=json('verification/r28-production-staging-pins.json'),dir='verification/baselines/r28-before-production-promotion';fs.mkdirSync(dir,{recursive:true});
for(const[name,p]of Object.entries(pins.source)){
  const s=read('verification/r28-production-staging/'+name);assert.equal(hash(s),p.sha256);
  if(fs.existsSync(name))fs.copyFileSync(name,path.join(dir,name),fs.constants.COPYFILE_EXCL);
  let deployed=s;
  if(name==='pyro-smoke-light-field.js')deployed=deployed.replace("from '../../pyro-smoke-light-bound.js'","from './pyro-smoke-light-bound.js'");
  if(name==='pyro-smoke-light-tiles.js')deployed=deployed.replace("from '../../smoke-transmission-rectangles.js'","from './smoke-transmission-rectangles.js'");
  fs.writeFileSync(name,deployed);
}
let main=read('main.js'),line=main.split('\n').find(x=>x.startsWith('    async runCompleteNativeLightCheck('));assert(line&&!main.includes('async runProductionNativeLightCheck('));
const hook="    async runProductionNativeLightCheck(options={}){if(qaRenderLock||qaFrozenWorkload||graphicsContextInterrupted||!parameters.paused)throw new Error('Pause a healthy scene with no active diagnostic first');qaRenderLock=true;try{const [{runProductionNativeLightGPUCheck},{createPyroSmokeLightField}]=await Promise.all([import('./verification/r28-production-native-light-gpu-check.js'),import('./pyro-smoke-light-field.js')]);return await runProductionNativeLightGPUCheck(THREE,renderer,{...options,parentLocked:true,createField:createPyroSmokeLightField});}finally{clock.getDelta();qaRenderLock=false;lastPausedRenderKey=null;}},";
main=main.replace(line+'\n',line+'\n'+hook+'\n');fs.writeFileSync('main.js',main);
const field=await import('../pyro-smoke-light-field.js'),tiles=await import('../pyro-smoke-light-tiles.js'),state=await import('../pyro-smoke-light-native-state.js');
const names=[...Object.keys(pins.source),'fireworks-audio.js'];
const source=Object.fromEntries(names.map(n=>[n,{sha256:hash(fs.readFileSync(n)),bytes:fs.statSync(n).size}]));
const functions=Object.fromEntries(Object.entries({createField:field.createPyroSmokeLightField,packPackets:field.packSmokeLightPackets,planTiles:tiles.planSmokeLightTiles,tileFactory:tiles.createSmokeLightTileBaker,capture:state.captureLightNativeState,restore:state.restoreLightNativeState,sameState:state.sameLightNativeState,preserve:state.withLightNativeState}).map(([k,v])=>[k,hash(Function.prototype.toString.call(v))]));functions.kernel=hash(field.smokeLightMomentsGLSL);
assert.equal(source['fireworks-audio.js'].sha256,'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
fs.writeFileSync('verification/r28-production-promotion-pins.json',JSON.stringify({schema:'glass-atoll.r28-promoted-light-pins.v1',productionPromotionPendingHardwareCheck:true,source,functions,backup:dir,dailyOptions:pins.dailyOptions,onlyStageToRootChanges:'two dependency import relocations; one locked production QA hook in main',candidateReceipt:'r28-complete-native-light-actual-gpu.json',candidateReceiptSHA256:hash(fs.readFileSync('verification/r28-complete-native-light-actual-gpu.json'))},null,2)+'\n');
console.log(JSON.stringify({productionWritten:true,pendingSeparateHardware:true,source,functions},null,2));
