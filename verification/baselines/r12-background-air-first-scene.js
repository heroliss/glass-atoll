const clone=x=>structuredClone(x),json=x=>JSON.stringify(x),raf=()=>new Promise(requestAnimationFrame);
const audio=a=>({enabled:a.audio.enabled,...Object.fromEntries(['scheduled','discarded','recordedPlays','synthesizedPlays','relativeBurstGain','postCompressorHeadroomGain'].map(k=>[k,a.fireworks().audio[k]]))});
export async function runBackgroundAirScene(a){
 const r={schema:'glass-atoll.r12-background-air-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,checks:[],captures:[],images:{},errors:[],visualAccepted:false};
 const check=(name,passed,evidence)=>r.checks.push({name,passed:!!passed,evidence}),onError=e=>r.errors.push(String(e.message||e.reason||e));
 window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
 try{
  a.pause(true);a.setDirector({mode:'off'});if(a.fireworks().active||a.fireworks().queued||a.smoke().state.packetCount)throw Error('Fresh empty scene required');
  await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('stars');await a.setTime({running:false});a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});
  a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);a.setFireworksPhotometryMode('reference');a.setBackgroundLocalAir(false);
  a.setFireworks({type:'willow',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:true});
  r.launch=clone(a.launchFirework({type:'willow',seed:42,intensityScale:1}));if(!r.launch.accepted||r.launch.queued)throw Error('Immediate actual launch required');
  const target=r.launch.burstTime+1.1,deadline=performance.now()+60000;a.pause(false);a.pauseAtPhysicalTime(target);
  while(!a.state.parameters.paused||a.state.time<target-1e-8){if(r.errors.length)throw Error(r.errors[0]);if(performance.now()>deadline)throw Error('Actual physical phase deadline');await raf();}
  const frozen={time:a.state.time,utcMs:a.celestial().utcMs,matter:json(a.smokeSnapshot()),events:json(a.fireworks().activeEvents),audio:json(audio(a))},centre=a.fireworkClusters()[0]?.position;if(!centre)throw Error('Actual source centroid required');
  const pose={camera:centre.map((v,i)=>v+[-80,12,-155][i]),target:centre};a.setCamera(pose.camera,pose.target,{expandFramingLimits:true});r.pose=clone(pose);
  for(const photometryMode of ['reference','thermal-greybody']){
   a.setFireworksPhotometryMode(photometryMode,{radiusMm:2});const sources=json(a.fireworkFramingSources());
   for(const [index,enabled]of [false,true,false].entries()){
    a.setBackgroundLocalAir(enabled);for(let i=0;i<80;i++)await raf();
    const key=photometryMode+'_'+(enabled?'local_sky':'legacy')+(index===2?'_repeat':''),state=clone(a.state),photo=clone(a.photometry()),air=clone(a.air()),range=await a.inspectRadiance(),gl=a.readGLErrors(key);
    r.images[key]=a.screenshot();r.captures.push({key,enabled,photometryMode,state,photo,air,range,smoke:clone(a.smoke()),gl});
    check(key+': physical source matter event audio clock camera and photography unchanged',json(a.fireworkFramingSources())===sources&&json(a.smokeSnapshot())===frozen.matter&&json(a.fireworks().activeEvents)===frozen.events&&json(audio(a))===frozen.audio&&state.time===frozen.time&&a.celestial().utcMs===frozen.utcMs&&photo.cameraEV===16.5&&Math.hypot(...state.camera.map((v,i)=>v-pose.camera[i]))<1e-8);
    check(key+': requested background mode and enabled air actually effective',air.backgroundLocalScattering===(enabled?1:0)&&air.enabled);
    check(key+': all real HDR buffers finite nonnegative inside storage budget',['opaque','composed','reflection'].every(k=>range[k]?.stateRestored&&range[k]?.counterConsistency&&!range[k].countNaN&&!range[k].countInf&&!range[k].countNegative&&range[k].globalMax<=photo.safeMaximum*(1+1e-4))&&photo.storedBound<=photo.safeMaximum*(1+1e-10));
   }
  }
  check('one actual launch no runtime GL or context error',a.fireworks().launches===1&&!r.errors.length&&!a.state.graphicsContextInterrupted&&r.captures.every(c=>!c.gl.errors.length));
 }catch(e){r.error=String(e.stack||e);check('complete actual same-scene background comparison',false,r.error);}
 finally{a.pause(true);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);}
 r.counts={passed:r.checks.filter(c=>c.passed).length,total:r.checks.length};r.passed=r.checks.every(c=>c.passed);r.limits=['Only local single in-scatter is added to background; global sky light/attenuation is not repeated.','Fixed photography C; storage P can change with conservative additional-air budget.','Point smoke and optional resolved field identical within each A/B/A; no smoke mass or physics changes.','Thermal-greybody is an authored emitting-area proxy, not measured pyrotechnic photometry.','Pausing/readback is not a frame-rate or HDR-display appearance test. No photographic acceptance.'];return r;
}
