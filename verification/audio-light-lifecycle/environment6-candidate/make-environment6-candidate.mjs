import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const folder=new URL('./',import.meta.url),root=new URL('../../../',import.meta.url),NL=String.fromCharCode(10);
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const readRoot=name=>fs.readFileSync(new URL(name,root),'utf8');
const entries=[];
function replace(source,from,to,expected=1){assert.equal(source.split(from).length-1,expected,from);return source.split(from).join(to);}
function save(input,output,value,description){const original=readRoot(input);fs.writeFileSync(new URL(output,folder),value);entries.push({input,output,inputSHA256:hash(original),outputSHA256:hash(value),description});}

let main=readRoot('main.js');
main=replace(main,"import { createLocalLights } from './local-lights.js';","import { createLocalLights } from './local-lights.js';"+NL+"import { createEnvironmentLocalLights } from './verification/audio-light-lifecycle/environment6-candidate/qa-environment-lights.js';");
main=replace(main,'let celestialController,celestialFrame,localLights,environmentCapture,fireworks,','let celestialController,celestialFrame,localLights,environmentLocalLights,environmentCapture,fireworks,');
main=replace(main,'  localLights=createLocalLights(THREE,{scene,terrainHeight});','  localLights=createLocalLights(THREE,{scene,terrainHeight});'+NL+'  environmentLocalLights=createEnvironmentLocalLights(THREE,localLights);');
main=replace(main,'  aerialPerspective=createAerialPerspective(THREE,renderer,{camera,atmosphere,sunLight,localLights});','  aerialPerspective=createAerialPerspective(THREE,renderer,{camera,atmosphere,sunLight,localLights:environmentLocalLights});');
main=replace(main,'  water=createWater(renderer,scene,camera,keyDirection,{terrainHeight,skyCube:skyCubeTarget.texture,sandTexture:textures[0],atmosphere,waveSpectrum,sunLight,indirectLighting,localLights});','  water=createWater(renderer,scene,camera,keyDirection,{terrainHeight,skyCube:skyCubeTarget.texture,sandTexture:textures[0],atmosphere,waveSpectrum,sunLight,indirectLighting,localLights:environmentLocalLights});');
const updateLine="  localLights.update({frame:baseFrame,camera,sunAltitude:celestialFrame?.mode==='astronomical'?celestialFrame.sun.altitudeDeg:parameters.sun.elevation,clusters:receiverClusters,burstBounds:b?.active?[{center:b.centre,radius:b.radius}]:[]});";
main=replace(main,updateLine,updateLine+NL+'  environmentLocalLights.update({frame:baseFrame,clusters});');
main=replace(main,'atmosphere.setStorageExposureEV(photometry.storageEV);localLights.setSceneExposure(photometry.storageEV);applySolarLighting();','atmosphere.setStorageExposureEV(photometry.storageEV);localLights.setSceneExposure(photometry.storageEV);environmentLocalLights.setSceneExposure(photometry.storageEV);applySolarLighting();');
save('main.js','main.js',main,'Only water and aerial receive six-source adapter; island, GI and smoke retain full localLights.');

let water=readRoot('water.js');
water=replace(water,"import {LOCAL_LIGHT_COUNT} from './local-lights.js';","import {ENVIRONMENT_LIGHT_COUNT} from './verification/audio-light-lifecycle/environment6-candidate/qa-environment-lights.js';");
const marker='$'+'{LOCAL_LIGHT_COUNT}',envMarker='$'+'{ENVIRONMENT_LIGHT_COUNT}';
water=replace(water,'for(int i=0;i<'+marker+';i++)','for(int i=0;i<'+envMarker+';i++)');
save('water.js','water.js',water,'One seabed local-source loop is six; other water physics and object loops unchanged.');

let aerial=readRoot('aerial-perspective.js');
aerial=replace(aerial,"import {localLightGLSL,LOCAL_LIGHT_COUNT} from './local-lights.js';","import {environmentLightGLSL,ENVIRONMENT_LIGHT_COUNT} from './verification/audio-light-lifecycle/environment6-candidate/qa-environment-lights.js';");
aerial=aerial.replace(/\bLOCAL_LIGHT_COUNT\b/g,'ENVIRONMENT_LIGHT_COUNT').replace(/\blocalLightGLSL\b/g,'environmentLightGLSL');
assert.equal(aerial.split('for(int i=0;i<'+envMarker+';i++)').length-1,3);
save('aerial-perspective.js','aerial-perspective.js',aerial,'Opaque/background air source loops and CPU bound use six borrowed environment records.');

const local=readRoot('local-lights.js');save('local-lights.js','local-lights-native20.js',local,'Byte-identical full 20-source native receiver path.');
const diffuseInput='verification/audio-light-lifecycle/local-lights-diffuse-chunk-candidate.js',diffuse=readRoot(diffuseInput);save(diffuseInput,'local-lights-diffuse4.js',diffuse,'Existing four-native-light, sixteen-diffuse receiver candidate.');
const adapter=fs.readFileSync(new URL('qa-environment-lights.js',folder),'utf8');
const shared={'/main.js':fileURLToPath(new URL('main.js',folder)),'/water.js':fileURLToPath(new URL('water.js',folder)),'/aerial-perspective.js':fileURLToPath(new URL('aerial-perspective.js',folder))};
const report={schema:'glass-atoll.environment6-route-candidate.v1',productionChanged:false,receiverSources:20,environmentSources:6,smokeSources:20,source:'fireworks.getLightClusters() unchanged: at most two merged whole-show cloud proxies; exact I and RGB moment sums',variants:{native20:{...shared,'/local-lights.js':fileURLToPath(new URL('local-lights-native20.js',folder))},diffuse4:{...shared,'/local-lights.js':fileURLToPath(new URL('local-lights-diffuse4.js',folder))}},staticModule:'/verification/audio-light-lifecycle/environment6-candidate/qa-environment-lights.js',adapterSHA256:hash(adapter),entries,limits:['Route only main, water, aerial and optionally local-lights response bodies; the QA adapter module remains served at its own static path.','No time smoothing or additive persistence; clusters follow actual fireworks current heads/tails.','Two global environment proxies are coarse and can have spatial error versus 16 local island proxies.','No GPU or first-frame performance result is claimed.']};
fs.writeFileSync(new URL('manifest.json',folder),JSON.stringify(report,null,2));
console.log(JSON.stringify({variants:Object.keys(report.variants),paths:report.variants.native20,staticModule:report.staticModule},null,2));
