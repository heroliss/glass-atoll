// Actual-model/factory CPU support and provenance checks. Never creates GL.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {FIREWORK_TYPES,createFireworkEvent,sampleBody,sampleFireworkEvent} from '../fireworks-physics.js';
import {getFireworkEffectProfileLimits} from '../firework-layer-profile.js';
import {getFireworkShowEnvelope,getScaledFireworkLiveEnvelope} from '../firework-show-envelope.js';
import {createTailReleaseFieldNode,sampleTailReleaseFieldNode} from '../firework-tail-field.js';
import {sampleCausalOpticalAnchor} from '../firework-exposure-window.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),NEW='three-heart-scale120-v1',base='verification/baselines/r35-before-scale-profile/',checks=[],owned=[];
const currentFW=read('fireworks.js'),currentEnvelope=read('firework-show-envelope.js'),transform=JSON.parse(read('verification/r35-motion-envelope-source-transform.json'));
const relocate=s=>s.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${new URL(p.slice(2),root).href}'`),moduleFrom=async s=>import('data:text/javascript;base64,'+Buffer.from(relocate(s)).toString('base64'));
const check=async(name,f)=>{try{checks.push({name,passed:true,evidence:await f()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e).replace(/data:text\/javascript;base64,[^\s)]+/g,'[in-memory CPU module]')});}};
const ordinaryEnvelope=(await moduleFrom(read(base+'firework-show-envelope.js'))).getFireworkShowEnvelope;
async function factory(text){const anchor='api.configure({});return api;';assert.equal(text.split(anchor).length,2);return(await moduleFrom(text.replace(anchor,'api.configure({});api.__qa=simulation;return api;'))).createFireworks;}
const currentFactory=await factory(currentFW),oldFactory=await factory(read(base+'fireworks.js'));
const make=(options={},old=false)=>{const f=(old?oldFactory:currentFactory)(THREE,options);owned.push(f);return f;};
function contained(p,b,context=''){if(p[1]<.03)return;for(let c=0;c<3;c++)assert(p[c]>=b.min[c]-1e-7&&p[c]<=b.max[c]+1e-7,JSON.stringify({p,min:b.min,max:b.max,context,c}));}
function contains(a,b){for(let c=0;c<3;c++){assert(a.min[c]<=b.min[c]);assert(a.max[c]>=b.max[c]);}}
const staticSea={schema:'r35 static sea CPU fixture',minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,clearanceMetres:.03,heightAt:()=>0,boundAtHorizontalRegion:()=>({minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,certifiedSeaOnly:true,planeHeight:0})};
function launch(f,{seed=42,elevation=78,height}={}){f.configure({type:'chrysanthemum',effectProfile:NEW,starDragModel:'bounded-descent',autoDirection:false,azimuth:117,elevation,launchSpreadDegrees:0,burstTiltDegrees:45,burstRollDegrees:30});const accepted=f.launch({seed,...(height!==undefined?{height}:{})});assert(accepted.accepted);return f.__qa.active.at(-1);}
let actualRenders=0;
try{
await check('Both whole-file inverses recover archived sources exactly; old line endings and all shaders are unchanged',()=>{
 for(const file of['fireworks.js','firework-show-envelope.js']){let s=read(file);for(const p of [...transform.changes].reverse().filter(p=>p.file===file)){assert.equal(s.split(p.new).length,2);s=s.replace(p.new,p.old);}assert.equal(s,read(base+file));}
 assert.equal((currentFW.match(/\r\n/g)||[]).length,(currentFW.match(/\n/g)||[]).length);assert(!currentEnvelope.includes('\r'));return{inverseChanges:transform.changes.length,exactOriginalSHA256:Object.fromEntries(['fireworks.js','firework-show-envelope.js'].map(p=>[p,sha(read(base+p))])),noShaderChanges:true};
});
await check('All13 old style branches retain exact pure envelopes and actual-factory bounds/descriptors under four causal wind phases',()=>{
 let envelopeCases=0,liveCases=0,descriptorCases=0;const styles=FIREWORK_TYPES.map(t=>({type:t.id,effectProfile:'legacy'})).concat(['three-heart-v1','two-colour-v1','powered-bees-v1'].map(effectProfile=>({type:'chrysanthemum',effectProfile})));
 for(const style of styles){for(const elevation of[25,78,90]){const q={...style,elevation,starDragModel:'bounded-descent',wind:{min:[-4,-.2,-2],max:[5,.3,3]},launchSpreadDegrees:15};assert.deepEqual(getFireworkShowEnvelope(q),ordinaryEnvelope(q));envelopeCases++;}
  const a=make(),b=make({},true),settings={...style,starDragModel:'bounded-descent',autoDirection:false,azimuth:119,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0};a.configure(settings);b.configure(settings);a.launch({seed:42});b.launch({seed:42});const id=a.__qa.active[0].id;assert.deepEqual(a.smokeSourceProvider.describe(id),b.smokeSourceProvider.describe(id));descriptorCases++;
  for(const [time,wind]of[[.1,[0,0,0]],[1,[3,0,-1]],[2,[-2,.1,1]],[3,[0,0,0]]]){a.update({time,windVector:wind});b.update({time,windVector:wind});assert.deepEqual(a.getBounds({shutterSeconds:NaN}),b.getBounds());liveCases++;}
 }
 return{styles:styles.length,envelopeCases,liveCases,descriptorCases,oldInvalidUnusedOptionStillIgnored:true};
});
let newAvailable=false;try{getFireworkEffectProfileLimits(NEW);newAvailable=true;}catch{}
if(!newAvailable)checks.push({name:'Actual new profile integration availability',passed:false,pending:true,error:'Compiler registry has not yet admitted new ID; new actual-factory checks were not run.'});
else{
await check('New pure family uses explicit76 contract or19*declared compiled alpha, with0..1 shutter support and unchanged old19 limits',()=>{
 const limits=getFireworkEffectProfileLimits(NEW);assert.equal(limits.intrinsicSpeed,76);assert.equal(getFireworkEffectProfileLimits('three-heart-v1').intrinsicSpeed,19);const q={type:'chrysanthemum',effectProfile:NEW,starDragModel:'bounded-descent',wind:{min:[-5,-1,-4],max:[4,.5,6]}},family=getFireworkShowEnvelope(q),known=getFireworkShowEnvelope({...q,sourceRadialScaleAlpha:2.6,shutterSeconds:1/120});assert.equal(family.limits.intrinsicSpeedMetresPerSecond,76);assert.equal(known.limits.intrinsicSpeedMetresPerSecond,19*2.6);assert.equal(family.limits.scaled.opticalShutterSeconds,1);assert.equal(known.limits.scaled.opticalShutterSeconds,1/120);contains(family,known);
 for(const sourceRadialScaleAlpha of[0,-1,4.00001,NaN,Infinity])assert.throws(()=>getFireworkShowEnvelope({...q,sourceRadialScaleAlpha}));for(const shutterSeconds of[-1,1.001,NaN,Infinity])assert.throws(()=>getFireworkShowEnvelope({...q,shutterSeconds}));for(const shutterSeconds of[0,1/120,1])assert(Number.isFinite(getFireworkShowEnvelope({...q,shutterSeconds}).max[1]));
 return{familyMax:family.max,knownMax:known.max,knownShutterPadding:known.limits.scaled.body.shutterPadding,familyBound:76,knownBound:19*2.6};
});
await check('Continuous actual-event source/tail/causal shutter/stretch supports enclose full future lives and arbitrary held-wind switches, including explicit height',()=>{
 let bodyPoints=0,fieldPoints=0,proxyPoints=0,cases=0,maxSupportPadding=0;
 for(const seed of[0,42,341070])for(const elevation of[25,78,90])for(const height of[undefined,220]){
  const event=createFireworkEvent({type:'chrysanthemum',effectProfile:NEW,seed,elevation,height,azimuth:117,origin:[29,1.37,7],starDragModel:'bounded-descent',burstOrientation:{yawDegrees:113,tiltDegrees:45,rollDegrees:30}}),wind={min:[-5,-1,-4],max:[4,.5,6]},timeline=[{time:-Infinity,wind:wind.min},{time:event.time+.23,wind:wind.max},{time:event.burstTime+.37,wind:[-1,.2,3]},{time:event.burstTime+1.33,wind:wind.min},{time:event.burstTime+2.57,wind:wind.max}],bounds=getScaledFireworkLiveEnvelope(event,{windRanges:wind,shutterSeconds:1});
  assert.equal(bounds.limits.knownSourceIntrinsicSpeedMetresPerSecond,19*event.layerProfile.radialScale.alpha);assert.equal(bounds.support.length,193);maxSupportPadding=Math.max(maxSupportPadding,...bounds.limits.maximumOpticalComponentPaddingMetres);
  sampleFireworkEvent(event,event.burstTime+.1,{windTimeline:timeline});
  for(const b of [...(event.rocket?[event.rocket]:[]),...event.heads]){
   const D=b===event.rocket?.5:b.trailProfile.durationSeconds,ages=[0,.001,.1,b.life*.25,b.life*.5,b.life*.75,b.life,b.life+.25,b.life+.5];
   for(const age of ages){const now=b.birth+age;contained(sampleBody(b,now,timeline).position,bounds,'physical source');bodyPoints++;
    for(const lag of[D/16,D*.5,D*15/16]){const node=createTailReleaseFieldNode(b,lag),time=now+lag,pose=sampleTailReleaseFieldNode(node,time,timeline);contained(pose.position,bounds,'fixed lag centre');fieldPoints++;
     const anchor=sampleCausalOpticalAnchor({birth:node.birth,physicalNow:time,shutterSeconds:1,sampleAt:t=>sampleTailReleaseFieldNode(node,t,timeline)}),nodes=[createTailReleaseFieldNode(b,D/16),createTailReleaseFieldNode(b,D*15/16)],ends=nodes.map(n=>sampleCausalOpticalAnchor({birth:n.birth,physicalNow:time,shutterSeconds:1,sampleAt:t=>sampleTailReleaseFieldNode(n,t,timeline)}));
     if(!ends.every(Boolean))continue;const stretch=ends[1].position.map((v,c)=>v-ends[0].position[c]);for(const a of[-.5,0,.5])for(const t of[-.5,.5]){const p=anchor.position.map((v,c)=>v+stretch[c]*a+anchor.velocity[c]*t);contained(p,bounds,'fixed lag causal/shutter/stretch endpoint');proxyPoints++;}
    }
   }
  }
  cases++;
 }
 return{cases,bodyPoints,fieldPoints,proxyPoints,maxSupportPadding,explicitHeightIncluded:true,scope:'Analytic interval/derivative enclosure plus actual-model witnesses; sampled checks are not themselves an all-seed proof.'};
});
await check('Live known-event bounds cover future wind histories, invalidate same-bucket wind extrema and shutter keys, and accept explicit height',()=>{
 const f=make(),event=launch(f,{seed:341070,elevation:25,height:220});f.update({time:.1,windVector:[-5,-1,-4]});f.update({time:.2,windVector:[4,.5,6]});f.update({time:.21,windVector:[0,0,0]});const narrow=f.getBounds({shutterSeconds:1/120}),wide=f.getBounds({shutterSeconds:1});assert.notStrictEqual(narrow,wide);contains(wide,narrow);const narrowAgain=f.getBounds({shutterSeconds:1/120});assert.deepEqual(narrowAgain,narrow);assert.strictEqual(f.getBounds({shutterSeconds:1/120}),narrowAgain);
 for(const shutterSeconds of[-1,1.001,NaN,Infinity])assert.throws(()=>f.getBounds({shutterSeconds}));
 f.update({time:.22,windVector:[-6,-1,-4]});f.update({time:.23,windVector:[0,0,0]});const changed=f.getBounds({shutterSeconds:1/120});assert.notStrictEqual(changed,narrowAgain);assert.deepEqual(changed.scaledAnalytic[0].limits.windRanges,[[-6,4],[-1,.5],[-4,6]]);
 const predicted=f.getBounds({shutterSeconds:1});let futurePoints=0;
 for(const age of[.1,.7,1.3,2.5,4]){f.update({time:event.burstTime+age,windVector:age<2?[-6,-1,-4]:[4,.5,6]});for(const b of event.heads){if(age>b.life)continue;contained(sampleBody(b,f.__qa.time,f.__qa.windTimeline).position,predicted,'future after different committed wind segments');futurePoints++;}}
 f.configure({effectProfile:'legacy',type:'peony'});assert.equal(f.getBounds({shutterSeconds:1/120}).scaledAnalytic[0].eventId,event.id);
 return{eventId:event.id,small:narrow.scaledAnalytic[0].limits,big:wide.scaledAnalytic[0].limits,futurePoints,selectedOrdinaryStyleDoesNotHideActiveScaledEvent:true};
});
await check('Actual provider, ledger, main/reflection fill and contact-aware optical rows use real scaled states and gold tails without extra motion paths',()=>{
 const f=make({sourceVisibility:'none',airSurface:staticSea}),event=launch(f,{seed:42,elevation:78}),descriptor=f.smokeSourceProvider.describe(event.id);assert.equal(descriptor.effectProfile,NEW);assert.equal(descriptor.radialScale,event.layerProfile.radialScale);assert(Object.isFrozen(descriptor)&&Object.isFrozen(descriptor.radialScale));assert.equal(descriptor.roots.length,192);assert(descriptor.roots.every(r=>!Object.hasOwn(r,'motionProfile')));assert.deepEqual(descriptor.roots.map(r=>r.baseVelocity),event.heads.map(b=>b.baseVelocity));
  let traceRows=0,uploadedRows=0,negativeContactRows=0,viewReceipts=[];
  const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(t){this.target=t;},getContext(){throw Error('No graphics context in CPU optical fill');},render(scene,camera){assert.equal(scene,f.effectsScene);actualRenders++;const mesh=scene.children.find(m=>m.isMesh);assert(mesh);const count=mesh.geometry.instanceCount;assert(count>0);for(const name of['aCentre','aVelocity','aStretch','aTemporal0','aTemporal5'])assert(mesh.geometry.getAttribute(name).array.subarray(0,count*mesh.geometry.getAttribute(name).itemSize).every(Number.isFinite));uploadedRows+=count;}};
  for(const age of[.01,.7,2.5,4.8]){f.update({time:event.burstTime+age,windVector:age<1?[3,.2,-1]:[-2,-.1,4]});const expectedTimeline=f.__qa.windTimeline,bounds=f.getBounds({shutterSeconds:1/120}),ledger=f.getEmissionLedger(),physicalBefore=JSON.stringify({events:f.__qa.active,wind:f.__qa.windTimeline,state:f.__qa.state});for(const id of[0,1,2,189]){const body=event.heads[id];if(age<body.life){const p=f.smokeSourceProvider.sampleBody(event.id,{bodyId:id,time:f.__qa.time});assert.deepEqual(p.position,sampleBody(body,f.__qa.time,expectedTimeline).position);}}
   const camera=new THREE.PerspectiveCamera(60,1,.1,2000);camera.position.set(100,80,-300);camera.lookAt(...event.burstPosition);camera.updateMatrixWorld();const mirror=camera.clone();mirror.position.y*=-1;mirror.lookAt(event.burstPosition[0],-event.burstPosition[1],event.burstPosition[2]);mirror.updateMatrixWorld();
   for(const [kind,c]of[['main',camera],['reflection',mirror]]){f.getRadianceBound({camera:c,optics:{width:160,height:171,shutterSeconds:1/120},onSourceBound:({source})=>{if(source.kind==='smoke')return;contained(source.position,bounds,kind+' optical anchor');const velocity=source.rasterVelocity??source.velocity,S=source.rasterExposureSeconds??source.viewExposure?.durationSeconds??1/120;for(const a of[-.5,.5])for(const t of[-.5,.5])contained(source.position.map((v,i)=>v+source.stretch[i]*a+velocity[i]*S*t),bounds,kind+' actual optical support');if(source.contactSupport){assert(source.position[1]>.03);negativeContactRows++;}traceRows++;}});
    f.render({renderer,target:{width:160,height:171},camera:c,reflection:kind==='reflection',planeY:0,frame:{time:f.__qa.time,storageEV:11.75,rawPerCandela:3.6e-5},optics:{width:160,height:171,shutterSeconds:1/120},legacySmoke:false});const d=f.diagnostics().lastRenderByView[kind];assert.equal(d.mediumQueries,0);assert.strictEqual(f.getEmissionLedger(),ledger);assert.equal(JSON.stringify({events:f.__qa.active,wind:f.__qa.windTimeline,state:f.__qa.state}),physicalBefore);viewReceipts.push({age,kind,instances:d.instances,recordsGeneration:d.sourceTransmission.recordsGeneration,ledgerRecordGeneration:ledger.recordGeneration,distinctCounterDomains:true,CPUAttenuationQueries:d.mediumQueries});}
  }
  assert(traceRows>0&&uploadedRows>0);return{descriptorRoots:descriptor.roots.length,descriptorAlpha:descriptor.radialScale.alpha,actualOpticalRows:traceRows,uploadedRows,contactLocalRows:negativeContactRows,inertRendererCalls:actualRenders,views:viewReceipts,noRealGPU:true,noPhysicalMutationByOptics:true};
});
await check('Low-height25degree scaled sources produce genuine existing contact-local rows whose world proxies stay in the live enclosure',()=>{
 const f=make({sourceVisibility:'none',airSurface:staticSea}),event=launch(f,{seed:341070,elevation:25,height:30}),camera=new THREE.PerspectiveCamera(70,1,.1,2000);camera.position.set(100,60,-180);camera.lookAt(...event.burstPosition);camera.updateMatrixWorld();let rows=0,local=0,clipped=0;
 for(const age of[.7,1.3,2.5]){f.update({time:event.burstTime+age,windVector:[2,0,-1]});const physicalBefore=JSON.stringify({events:f.__qa.active,wind:f.__qa.windTimeline,state:f.__qa.state}),bounds=f.getBounds({shutterSeconds:.1});clipped+=event.heads.filter(b=>sampleBody(b,f.__qa.time,f.__qa.windTimeline).position[1]<=.03).length;
  f.getRadianceBound({camera,optics:{width:160,height:171,shutterSeconds:.1},onSourceBound:({source})=>{if(source.kind==='smoke')return;rows++;if(!source.contactSupport)return;local++;assert(source.position[1]>.03);const S=source.rasterExposureSeconds,V=source.rasterVelocity;assert(Number.isFinite(S)&&S>0&&S<=.1+1e-12);for(const a of[-.5,.5])for(const t of[-.5,.5])contained(source.position.map((v,c)=>v+source.stretch[c]*a+V[c]*S*t),bounds,'contact-local linear raster support');}});assert.equal(JSON.stringify({events:f.__qa.active,wind:f.__qa.windTimeline,state:f.__qa.state}),physicalBefore);
 }
 assert(clipped>0);assert(local>0);return{rows,contactLocalRows:local,belowSeaHeadWitnesses:clipped,shutterSeconds:.1,elevationDegrees:25,explicitWorldHeight:30,noPhysicalMutationByContactOptics:true};
});
}
}finally{for(const f of owned)f.dispose();}
const report={schema:'glass-atoll.r35-live-scale-envelope-cpu-check.v1',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},actualGPU:false,browserActions:0,nativeContextCalls:0,inertEffectsRenderCalls:actualRenders,sourcePins:Object.fromEntries(['fireworks.js','firework-show-envelope.js','fireworks-physics.js','firework-layer-profile.js','firework-scale-calibration.js','fireworks-audio.js'].filter(p=>fs.existsSync(new URL(p,root))).map(p=>[p,sha(fs.readFileSync(new URL(p,root)))])),checks,limitations:['Known fixed event/compiled alpha and declared held-wind component ranges only; no future user wind prediction or measured120m/supplier physics.','World-space source/tail/shutter/stretch endpoints only; camera Gaussian/DOF/bloom and persistent smoke still require separate framing margins.','CPU actual factories and inert render calls do not establish GPU equality, image quality, GPU load or FPS.']};fs.writeFileSync(new URL('./r35-live-scale-envelope-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourcePins:report.sourcePins,failures:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
