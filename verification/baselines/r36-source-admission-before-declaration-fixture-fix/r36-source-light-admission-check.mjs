// Targeted CPU/source preflight only. No renderer, native context or GPU submission.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createFireworks} from '../fireworks.js';
import {createFireworkEvent} from '../fireworks-physics.js';
import {createSceneRadiometry} from '../scene-radiometry.js';
import {createCameraExposure} from '../camera-exposure.js';
import {planSmokeTransmissionLayout} from '../smoke-transmission-layout.js';
import {planTransmissionRectangles} from '../smoke-transmission-rectangles.js';
import {planSmokeLightTiles} from '../pyro-smoke-light-tiles.js';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const checks=[],owned=[],phases=[.7,1.7,2.5],samples=new Map();
const T_CAPS={maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:4000000};
const L_CAPS={maxSources:14000,maxPackets:4096,maxBakePairs:1048576,maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8};
function check(name,fn){try{checks.push({name,passed:true,...fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}}
function make(gain){
 const f=createFireworks(THREE,{sourceVisibility:'none',clusterModel:'moments',trailIntegration:'adaptive'});owned.push(f);f.setQuality({trailSegments:8});
 f.configure({type:'chrysanthemum',effectProfile:'three-heart-scale120-v1',starDragModel:'bounded-descent',intensityScale:gain,autoDirection:false,azimuth:117,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});
 const l=f.launch({seed:42});assert(l.accepted);
 const e=createFireworkEvent({type:l.type,effectProfile:'three-heart-scale120-v1',starDragModel:'bounded-descent',time:0,origin:l.origin,azimuth:l.azimuth,elevation:l.elevation,seed:42,intensityScale:gain,burstOrientation:l.burstOrientation});
 return{f,e};
}
try{
check('Actual N8 producer: gains1/64 preserve positive source support/geometry; 0x is a distinct neutral ledger',()=>{
 for(const gain of[0,1,64]){
  const {f,e}=make(gain),rows=[];
  for(const phase of phases){
   f.update({time:e.burstTime+phase,windVector:[1.6848,0,.6336]});
   const l=f.getEmissionLedger(),c=f.getLightClusters(),framing=f.getFramingSources({shutterSeconds:1/120});
   assert.strictEqual(f.getEmissionLedger(),l);assert.strictEqual(f.getLightClusters(),c);
   rows.push({phase,count:l.count,version:l.version,recordGeneration:l.recordGeneration,data:Array.from(l.data.subarray(0,l.count*8)),framing:framing.map(s=>({position:s.position,radius:s.radius,stretch:s.stretch})),clusters:c.map(x=>({I:x.referenceCandela,position:x.position,radius:x.radius,colour:x.color})),alpha:e.layerProfile.radialScale.alpha});
  }
  samples.set(gain,rows);
 }
 const a=samples.get(1),b=samples.get(64),zero=samples.get(0);
 for(let k=0;k<phases.length;k++){
  assert.equal(a[k].count,b[k].count);assert(a[k].count<=1728);assert.equal(zero[k].count,0);assert.equal(zero[k].clusters.length,0);assert.equal(a[k].alpha,b[k].alpha);assert.equal(a[k].alpha,zero[k].alpha);
  assert.deepEqual(a[k].framing,b[k].framing);
  for(let i=0;i<a[k].count;i++)for(let j=0;j<8;j++)assert.equal(b[k].data[i*8+j],a[k].data[i*8+j]*(j>=4&&j<=6?64:1));
  assert.equal(b[k].clusters[0].I,a[k].clusters[0].I*64);
 }
 return{seed:42,quality:{trailSegments:8},phases:phases.map((phase,i)=>({phase,positiveCount:a[i].count,zeroCount:zero[i].count,clusterCount:a[i].clusters.length,positiveF32RGBExactlyTimes64:true,geometricFramingExact:true})),scope:'Actual CPU factory, fixed seed42 and free-air source paths; not browser seed341070, contact rendering, arbitrary new curves or GPU equality.'};
});
check('Actual producer cache/version lifecycle is driven by records/raw scale, not by caller role names',()=>{
 const{f,e}=make(1);f.update({time:e.burstTime+.7,windVector:[0,0,0]});
 const a=f.getEmissionLedger(),c=f.getLightClusters(),bytes=Array.from(a.data.subarray(0,a.count*8));
 assert.strictEqual(f.getEmissionLedger(),a);assert.strictEqual(f.getLightClusters(),c);
 const b=f.getEmissionLedger({rawPerCandela:a.rawPerCandela*2});assert.notStrictEqual(b,a);assert.equal(b.version,a.version+1);assert.equal(b.recordGeneration,a.recordGeneration);
 for(let i=0;i<a.count;i++)for(let j=0;j<8;j++)assert.equal(b.data[i*8+j],bytes[i*8+j]*(j>=4&&j<=6?2:1));
 f.update({time:e.burstTime+.7,windVector:[0,0,0]});const d=f.getEmissionLedger({rawPerCandela:b.rawPerCandela});assert.notStrictEqual(d,b);assert.equal(d.recordGeneration,b.recordGeneration+1);assert.notStrictEqual(f.getLightClusters(),c);
 return{repeatReuses:true,rawScaleAdvancesLedgerOnly:true,physicalRecordRefreshInvalidatesClusterAndLedger:true,borrowedDataLifetime:'Copy before a later ledger call mutates its reusable data buffer.'};
});
check('R35 actual single-event raw requests replay through current exact map planners; neutral mirror is not CPU fallback',()=>{
 const files=['r35-scale-plus0p70-hdr.json','r35-scale-plus2p50-hdr.json','r35-logical-scale-plus0p70.json','r35-logical-scale-plus2p50-hdr.json','r35-logical-scale-plus2p50-detail-hdr.json','r35-scale-plus2p50-detail-sdr.json'];
 const rows=files.map(file=>{
  const d=JSON.parse(read('./'+file)),P=d.smoke.state.packetCount,L=d.smoke.rendering.resolvedLighting.field;
  assert.equal(d.fireworks.active,1);assert.equal(d.smoke.rendering.lightFieldBakeMode,'tiled64');assert.equal(d.state.graphicsContextInterrupted,false);assert.deepEqual(d.gl.errors,[]);
  const lp=planSmokeLightTiles(P,L.sourceCount,L_CAPS);assert(lp.supported);assert.equal(lp.requiredPairs,L.requiredPairs);assert.deepEqual(lp.mapRects,L.mapRects);
  let pairs=lp.requiredPairs,draws=lp.bakePasses;
  const eyes=Object.entries(d.fireworks.lastRenderByView).map(([eye,v])=>{
   const s=v.sourceTransmission;assert.equal(v.mediumQueries,0);assert.equal(s.mediumQueries,0);assert.equal(v.time,d.state.time);
   if(!s.activeRayCount){assert.equal(s.reason,'no-active-source-rays');return{eye,count:0,neutralNoPrepare:true,logicalPairs:0,freshNumericDraws:0};}
   assert.equal(s.backend,'gpu');assert(s.effective);
   const layout=planSmokeTransmissionLayout(s.instances,P,T_CAPS),map=planTransmissionRectangles({sourceCount:s.instances,packetCount:P,partialWidth:layout.allocation.partial.width,partialStride:layout.partialStride,maxMapPairs:1000000,maxDraws:9});
   assert(layout.supported&&map.supported);assert(map.mapRects.every(r=>r.conservativePairs<=1000000));pairs+=map.logicalPairs;draws+=map.totalDraws;
   return{eye,count:s.instances,logicalPairs:map.logicalPairs,conservativePairs:map.conservativePairs,freshNumericDraws:map.totalDraws,maxPacketsAtSameCount:Math.min(4096,Math.floor(4000000/s.instances))};
  });
  return{file,sha256:hash(read('./'+file)),P,SHsources:L.sourceCount,SHpairs:lp.requiredPairs,SHfreshDraws:lp.bakePasses,SHwasCached:L.reused,eyes,completeFreshLogicalPairs:pairs,completeFreshNumericDraws:draws,volume:d.smoke.rendering.lastRender?{instances:d.smoke.rendering.lastRender.instances,proxyRasterPixelUpperBound:d.smoke.rendering.lastRender.proxyRasterPixelUpperBound,fullScreenFallbacks:d.smoke.rendering.lastRender.fullScreenFallbacks}:null,photometry:{storageEV:d.photometry.storageEV,cameraEV:d.photometry.cameraEV,rawBound:d.photometry.maxRawRGB,storedBound:d.photometry.storedBound,safeMaximum:d.photometry.safeMaximum},numericGPUBytes:d.sourceT.gpuNumericalBytes+L.allocatedBytes};
 });
 assert.equal(rows[3].completeFreshLogicalPairs,7959539);assert.equal(rows[3].completeFreshNumericDraws,15);assert(rows.every(r=>r.SHwasCached===true));
 return{snapshots:rows,scope:'Recomputed hypothetical fresh numerical work for the saved counts, not actual timing of these cached paused frames or a full-lifetime maximum.'};
});
check('SourceT is geometric per-fill work; SH cache identity requires fresh immutable ledger generation',()=>{
 const fw=read('../fireworks.js'),T=read('../pyro-smoke-transmission-gpu.js'),pack=read('../pyro-smoke-transmission-pack.js'),L=read('../pyro-smoke-light-field.js');
 assert(fw.includes('sourceVersion:requestVersion'));assert(fw.includes('sourceTransmissionRequest'));assert(T.includes('prepares++;'));
 const signature=pack.match(/export function packSmokeTransmissionInputs\(([^\n]+)/)[1];assert(!/intensity|colour|color|I0/.test(signature));
 const keyText=L.match(/const key=\{([^}]+)\};if\(lastKey/)[1];assert.equal(keyText,'snapshot,revision:snapshot.revision,ledger,ledgerVersion:ledger.version,data:ledger.data,count:ledger.count,bakeMode');
 const same=(a,b)=>Object.keys(a).every(k=>a[k]===b[k]),snapshot={},ledger={version:1,data:new Float32Array(8),count:1};
 const key=()=>({snapshot,revision:7,ledger,ledgerVersion:ledger.version,data:ledger.data,count:ledger.count,bakeMode:'tiled64'}),a=key();ledger.data[4]=12;assert(same(a,key()));ledger.version++;assert(!same(a,key()));
 assert(L.includes('effective=false;lastKey=null;cachedResult=null;'));assert(fw.includes('clusterCache=null'));
 return{perEyeNoColourReuse:true,cacheDoesNotHashBorrowedRadianceBytes:true,inPlaceUnversionedMutationWouldBeStale:true,requiredIntegration:'New immutable physical profile/body; updateRecords; getEmissionLedger; prepareLighting once; consume each fresh per-eye SourceT immediately.'};
});
check('Stronger raw light lowers storage P without cancelling photographic gain or altering density',()=>{
 const rows=[1,64].map(multiplier=>{const r=createSceneRadiometry(),x=r.update({recommendedEV:21,cameraExposureEV:14,bounds:{test:4*multiplier},force:true});assert(x.storedBound<=x.safeMaximum);return{multiplier,...x,finalRawFactor:x.sceneScale*x.outputExposureScale};});
 assert(rows[1].storageEV<rows[0].storageEV);assert.equal(rows[1].cameraEV,rows[0].cameraEV);assert.equal(rows[1].finalRawFactor,rows[0].finalRawFactor);
 const c=createCameraExposure(),state=c.update({recommendedEV:14,solarAltitudeDeg:-18,dt:.1,reset:true});assert.equal(state.histogram,null);
 const main=read('../main.js');assert(main.includes('cameraExposure.update({enabled:nightSettings.autoExposure'));assert(!main.match(/cameraExposure\.update\(\{[^\n]*histogram/));
 return{rows,actualMainHasNoHistogramArgument:true,meaning:'Current camera adaptation follows astronomical/manual prior; storage P protects FP16. Raising source light can still brighten receivers/output; it is not automatically exposure-cancelled.'};
});
check('Current cross-consumer source and fill contracts are explicit and bounded',()=>{
 const f=read('../fireworks.js'),main=read('../main.js'),sky=read('../sky.js'),volume=read('../pyro-smoke-renderer.js'),local=read('../local-lights.js');
 assert(f.includes('groups.length<2'));assert(f.includes('reduceFireworkLightClusters'));assert(sky.includes('clusters.length>2'));assert(sky.includes('if(uniforms.uTransientCount.value===0)return'));
 assert(main.includes('ledger:fieldVisible?fireworks.getEmissionLedger'));assert(main.includes('atmosphere.setTransientLights(clusters'));assert(main.includes('localLights.update({frame:baseFrame'));assert(main.includes('medium.render({target,camera'));
 assert(volume.includes("const ordered=records.filter(p=>p.normalization>0)"));assert(volume.includes('projector.project(p.mean,p.shape.covariance)'));assert(local.includes('step(1e-7,energy)'));assert(local.includes('localReflectionReactive'));
 return{SHusesAllPositiveHeadTailRows:true,clustersAtMost2MomentProxies:true,volumeCullingUsesDensityGeometryNotRadiance:true,reactiveReceiverMask:'Binary source-energy threshold plus fixed range; reflection uses burst enclosure. Not a luminance-adaptive proxy subdivision.',roles:'No current dedicated illumination-only/short-burst role cache. An added role must reach actual burn/profile records; injecting clusters alone would omit SourceT and resolved SH.'};
});
}finally{for(const f of owned.reverse())f.dispose();}
const files=['fireworks.js','fireworks-physics.js','firework-layer-profile.js','firework-trail-profile.js','pyro-smoke-transmission-gpu.js','pyro-smoke-transmission-pack.js','smoke-transmission-layout.js','smoke-transmission-rectangles.js','pyro-smoke-light-field.js','pyro-smoke-light-tiles.js','pyro-smoke-renderer.js','scene-radiometry.js','camera-exposure.js','local-lights.js','sky.js','main.js'];
const report={schema:'glass-atoll.r36-source-light-admission-preflight.v1',actualGPU:false,browserActions:0,nativeContextCalls:0,rendererSubmissions:0,productionEdits:0,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},sourcePins:Object.fromEntries(files.map(p=>[p,hash(read('../'+p))])),checks,limits:['Current profile only; a future sustained-light curve/short burst has not passed this test.','Same positive-support/gain scaling is not a proof for changed life, tail duration, new secondary births, contacts, visibility or arbitrary camera.','4m is a per-request policy, not an aggregate full-frame budget or FPS guarantee.','No shader/native numerical, real image, display-nit, visual or performance acceptance.']};
fs.writeFileSync(new URL('./r36-source-light-admission-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;
