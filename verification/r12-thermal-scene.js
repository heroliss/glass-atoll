import * as THREE from '../vendor/three.module.js';
import {collectLuminousFramingPoints,fitLuminousPoints} from '../luminous-framing.js';
const clone=x=>structuredClone(x),json=x=>JSON.stringify(x),raf=()=>new Promise(requestAnimationFrame);
const audio=a=>{const x=a.fireworks().audio;return {enabled:a.audio.enabled,scheduled:x.scheduled,discarded:x.discarded,recordedPlays:x.recordedPlays,synthesizedPlays:x.synthesizedPlays,relativeBurstGain:x.relativeBurstGain,postCompressorHeadroomGain:x.postCompressorHeadroomGain};};
const geometry=sources=>sources.map(({intensity,...s})=>s);
export async function runThermalPhotometryScene(a){
 const r={schema:'glass-atoll.r12-thermal-photometry-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,type:'willow',seed:42,phases:[.12,1.1],checks:[],captures:[],images:{},errors:[],visualAccepted:false},check=(name,passed,evidence)=>r.checks.push({name,passed:!!passed,evidence}),onError=e=>r.errors.push(String(e.message||e.reason||e));
 window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
 try{
  a.pause(true);a.setDirector({mode:'off'});if(a.fireworks().active||a.fireworks().queued||a.smoke().state.packetCount)throw Error('Fresh empty scene required');
  await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('stars');await a.setTime({running:false});a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});
  a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);a.setFireworksPhotometryMode('reference');
  a.setFireworks({type:'willow',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:true});
  r.launch=clone(a.launchFirework({type:'willow',seed:42,intensityScale:1}));if(!r.launch.accepted||r.launch.queued)throw Error('Immediate actual launch required');
  const utc=a.celestial().utcMs;
  for(const phase of r.phases){
   const target=r.launch.burstTime+phase,deadline=performance.now()+60000;a.pause(false);a.pauseAtPhysicalTime(target);while(!a.state.parameters.paused||a.state.time<target-1e-8){if(r.errors.length)throw Error(r.errors[0]);if(performance.now()>deadline)throw Error('Actual physical phase deadline');await raf();}
   a.setFireworksPhotometryMode('reference');const frozen={matter:json(a.smokeSnapshot()),events:json(a.fireworks().activeEvents),audio:json(audio(a)),sources:clone(a.fireworkFramingSources())};
   const points=collectLuminousFramingPoints([{time:target,sources:frozen.sources}],{time:target,lookAheadSeconds:0,paddingMetres:1});
   const state=a.state,camera=new THREE.PerspectiveCamera(state.lens.verticalFovDegrees,state.lens.width/state.lens.height,.15,24000);camera.position.fromArray([-155.3710544104007,12,-119.47836859531397]);camera.lookAt(new THREE.Vector3(0,0,0));camera.updateMatrixWorld();
   const fit=fitLuminousPoints(THREE,camera,points.points,{eyeHeight:12,margin:.9,reflectionPlaneY:0}),cluster=a.fireworkClusters()[0];if(!cluster)throw Error('Actual luminous centroid required');
   const views=phase===.12?['front']:['front','detail'];
   for(const angle of views){
    const pose=angle==='front'?{camera:fit.position.toArray(),target:fit.target.toArray()}:{camera:cluster.position.map((v,i)=>v+[-80,12,-155][i]),target:clone(cluster.position)};
    a.setCamera(pose.camera,pose.target,{expandFramingLimits:true});
    for(const [index,mode]of ['reference','thermal-greybody','reference'].entries()){
     a.setFireworksPhotometryMode(mode,{radiusMm:2});for(let i=0;i<80;i++)await raf();const sources=clone(a.fireworkFramingSources()),s=clone(a.state),photo=clone(a.photometry()),fw=clone(a.fireworks()),range=await a.inspectRadiance(),key=String(phase).replace('.','p')+'_'+angle+'_'+mode+(index===2?'_repeat':'');
     r.images[key]=a.screenshot();const scale=mode==='reference'?1:fw.photometry.thermalBodyScale,ratios=sources.map((p,i)=>p.intensity/frozen.sources[i]?.intensity),geometryExact=json(geometry(sources))===json(geometry(frozen.sources));
     r.captures.push({key,phase,angle,mode,state:s,photo,fireworks:fw,range,sources:{count:sources.length,totalCandela:sources.reduce((sum,p)=>sum+p.intensity,0),geometryExact,maximumScaleError:Math.max(...ratios.map(v=>Math.abs(v-scale)))},smoke:clone(a.smoke()),clusters:clone(a.fireworkClusters()),framing:{fit:{position:fit.position.toArray(),target:fit.target.toArray(),horizontalDistance:fit.horizontalDistance},selection:points.diagnostics},gl:a.readGLErrors(key)});
     check(key+': source geometry matter event audio clock and photography unchanged',geometryExact&&json(a.smokeSnapshot())===frozen.matter&&json(fw.activeEvents)===frozen.events&&json(audio(a))===frozen.audio&&Math.abs(s.time-target)<1e-8&&a.celestial().utcMs===utc&&photo.cameraEV===16.5&&Math.hypot(...s.camera.map((v,i)=>v-pose.camera[i]))<1e-8);
     check(key+': every actual thermal source receives one common physical scale',sources.length===frozen.sources.length&&ratios.every(v=>Number.isFinite(v)&&Math.abs(v-scale)<1e-10));
     check(key+': all three real HDR buffers finite nonnegative within re-budgeted storage',['opaque','composed','reflection'].every(k=>range[k]?.stateRestored&&range[k]?.counterConsistency&&!range[k].countNaN&&!range[k].countInf&&!range[k].countNegative&&range[k].globalMax<=photo.safeMaximum*(1+1e-4))&&photo.storedBound<=photo.safeMaximum*(1+1e-10));
    }
   }
  }
  check('one physical launch only',a.fireworks().launches===1);
  check('no runtime GL or context error',!r.errors.length&&!a.state.graphicsContextInterrupted&&r.captures.every(c=>!c.gl.errors.length));
 }catch(e){r.error=String(e.stack||e);check('complete actual thermal photometry comparison',false,r.error);}
 finally{a.pause(true);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);}
 r.counts={passed:r.checks.filter(c=>c.passed).length,total:r.checks.length};r.passed=r.checks.every(c=>c.passed);r.limits=['Authored reference-emitting-area/2850K greybody candidate, not measured real firework photometry or heat transfer.','Same C, unchanged source geometry, smoke M and audio; storage P is independently re-budgeted. Existing resolved smoke field enabled for both modes.','Point framing here uses current paused sources only, zero positive flux exclusion; it is not live future-window framing or an auto-camera acceptance.','Reference A repeats are captured for offline PNG metrics, not presumed byte-exact after large changes in storage exposure.','Readbacks and paused settling are not performance measurements; no user photographic acceptance.'];return r;
}
