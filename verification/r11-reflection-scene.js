import * as THREE from '../vendor/three.module.js';
import {fitPerspectiveBounds} from '../camera-framing.js?r11-reflection';
const clone=x=>structuredClone(x),json=x=>JSON.stringify(x),raf=()=>new Promise(requestAnimationFrame);
export async function prepareReflectionFramingScene(a){
 if(a.fireworks().active||a.fireworks().queued||a.smoke().state.packetCount)throw Error('Fresh empty default scene required');
 a.pause(true);a.setDirector({mode:'off'});await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('stars');await a.setTime({running:false});a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});
 a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);a.setFireworks({type:'willow',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:false});
 const launch=a.launchFirework({type:'willow',seed:42,intensityScale:1});if(!launch.accepted||launch.queued)throw Error('Immediate actual willow required');const target=launch.burstTime+2.2,deadline=performance.now()+60000;a.pause(false);a.pauseAtPhysicalTime(target);
 while(!a.state.parameters.paused||a.state.time<target-1e-8){if(performance.now()>deadline)throw Error('Physical phase did not arrive');await raf();}
 const applicationPose={camera:clone(a.state.camera),target:clone(a.state.target)},s=a.state,b=a.fireworks().bounds,box=new THREE.Box3(new THREE.Vector3(-39,0,-27),new THREE.Vector3(44,18,30));box.expandByPoint(new THREE.Vector3(...b.min));box.expandByPoint(new THREE.Vector3(...b.max));
 const camera=new THREE.PerspectiveCamera(s.lens.verticalFovDegrees,s.lens.width/s.lens.height,.15,24000);camera.position.fromArray(applicationPose.camera);camera.lookAt(new THREE.Vector3(...applicationPose.target));camera.updateMatrixWorld();
 const old=fitPerspectiveBounds(THREE,camera,box,{eyeHeight:Math.min(12,Math.max(2.5,s.camera[1]))});
 const report=await runReflectionFramingScene(a,{frontPose:{camera:old.position.toArray(),target:old.target.toArray()}}),selected=report.captures.find(c=>c.mode==='reflection');report.applicationPose=applicationPose;
 const positionError=Math.hypot(...selected.state.camera.map((v,i)=>v-applicationPose.camera[i])),targetError=Math.hypot(...selected.state.target.map((v,i)=>v-applicationPose.target[i]));
 report.checks.push({name:'production automatic framing reached the actual reflection-aware pose including terrain safety',passed:positionError<1e-7&&targetError<1e-7,evidence:{positionErrorMetres:positionError,targetErrorMetres:targetError}});report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.passed=report.checks.every(c=>c.passed);return report;
}
export async function runReflectionFramingScene(a,{frontPose}={}){
 const report={schema:'glass-atoll.r11-reflection-framing-scene.v1',actualGPU:true,dateUTC:new Date().toISOString(),checks:[],captures:[],images:{},visualAccepted:false},check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
 try{
  if(!a.state.parameters.paused||!a.fireworks().active||!frontPose)throw Error('Paused real event and original front pose required');
  a.setFireworksTailColourMode('constant');a.setCamera(frontPose.camera,frontPose.target);for(let i=0;i<40;i++)await raf();
  const s=clone(a.state),b=a.fireworks().bounds;if(!b.active)throw Error('Real forecast required');
  const frozen={time:s.time,events:json(a.fireworks().activeEvents),smoke:json(a.smokeSnapshot()),C:a.photometry().cameraEV,utc:a.celestial().utcMs};
  const box=new THREE.Box3(new THREE.Vector3(-39,0,-27),new THREE.Vector3(44,18,30));box.expandByPoint(new THREE.Vector3(...b.min));box.expandByPoint(new THREE.Vector3(...b.max));
  const camera=new THREE.PerspectiveCamera(s.lens.verticalFovDegrees,s.lens.width/s.lens.height,.15,24000);camera.position.fromArray(s.camera);camera.lookAt(new THREE.Vector3(...s.target));camera.updateMatrixWorld();
  const fit=fitPerspectiveBounds(THREE,camera,box,{eyeHeight:Math.min(12,Math.max(2.5,s.camera[1])),reflectionPlaneY:0});
  report.input={state:s,box:{min:box.min.toArray(),max:box.max.toArray()},bounds:b};report.fit={...fit,position:fit.position.toArray(),target:fit.target.toArray()};
  const points=[];for(let i=0;i<8;i++){const p=new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z);points.push(p,p.clone().setY(-p.y));}
  for(const mode of ['legacy','reflection']){
   const pose=mode==='legacy'?frontPose:{camera:fit.position.toArray(),target:fit.target.toArray()};a.setCamera(pose.camera,pose.target,{expandFramingLimits:true});for(let i=0;i<40;i++)await raf();
   const state=clone(a.state),photo=clone(a.photometry()),range=await a.inspectRadiance();camera.position.fromArray(state.camera);camera.lookAt(new THREE.Vector3(...state.target));camera.updateMatrixWorld();
   const ndc=points.map(p=>p.clone().project(camera).toArray()),outside=ndc.filter(p=>p[2]<-1||p[2]>1||Math.abs(p[0])>.9+1e-8||Math.abs(p[1])>.9+1e-8).length;
   report.images[mode]=a.screenshot();report.captures.push({mode,state,photo,range,ndc,outside,poseErrorMetres:Math.hypot(...state.camera.map((v,i)=>v-pose.camera[i])),gl:a.readGLErrors(mode)});
   check(mode+': actual event matter UTC photographic exposure frozen',state.time===frozen.time&&json(a.fireworks().activeEvents)===frozen.events&&json(a.smokeSnapshot())===frozen.smoke&&photo.cameraEV===frozen.C&&a.celestial().utcMs===frozen.utc);
   check(mode+': actual three buffers safely finite', ['opaque','composed','reflection'].every(k=>range[k].stateRestored&&range[k].counterConsistency&&!range[k].countNaN&&!range[k].countInf&&!range[k].countNegative&&range[k].globalMax<=photo.safeMaximum*(1+1e-4)));
  }
  check('all source and virtual mirror forecast corners inside actual reflection-aware view',report.captures.find(c=>c.mode==='reflection').outside===0);
  check('camera accepted both requested poses without distance clamping',report.captures.every(c=>c.poseErrorMetres<1e-8),report.captures.map(c=>({mode:c.mode,poseErrorMetres:c.poseErrorMetres})));
  check('old view actually clips virtual forecast corners',report.captures.find(c=>c.mode==='legacy').outside>0,report.captures.map(c=>({mode:c.mode,outside:c.outside})));
  check('no final GL error',report.captures.every(c=>!c.gl.errors.length));
 }catch(e){report.error=String(e.stack||e);check('complete actual framing comparison',false,report.error);}
 report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.passed=report.checks.every(c=>c.passed);report.limits=['Virtual planar source coverage only; wave refraction/reflection distortion can move real glitter outside the nominal margin.','One actual paused willow; no full show/orbit/time/light/performance acceptance.','Only camera pose changes; broad whole-lifetime forecast trades image size for coverage.','SDR review and HDR finite-buffer checks do not establish photographic acceptance.'];return report;
}
