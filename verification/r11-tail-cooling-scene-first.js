// QA: one actual event at one physical instant; mode A/B/A, no new light gain.
const clone=x=>structuredClone(x),json=x=>JSON.stringify(x),raf=()=>new Promise(r=>requestAnimationFrame(r));
const audio=a=>{const d=a.fireworks().audio;return {enabled:a.audio.enabled,scheduled:d.scheduled,discarded:d.discarded,recordedPlays:d.recordedPlays,synthesizedPlays:d.synthesizedPlays,relativeBurstGain:d.relativeBurstGain,postCompressorHeadroomGain:d.postCompressorHeadroomGain};};
const quality=s=>({preset:s.parameters.qualityPreset,custom:s.parameters.qualityCustom,sampling:s.parameters.renderSampling,renderScale:s.renderScale,lens:{samples:s.lens.samples,width:s.lens.width,height:s.lens.height}});
const safe=(r,p)=>['opaque','composed','reflection'].every(k=>r[k]?.stateRestored&&r[k]?.counterConsistency&&!r[k].countNaN&&!r[k].countInf&&!r[k].countNegative&&r[k].globalMax<=p.safeMaximum*(1+1e-4));
export async function runTailCoolingScene(a){
 const report={schema:'glass-atoll.r11-detached-tail-cooling-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,type:'palm',seed:42,phase:2.2,checks:[],captures:[],images:{},runtimeErrors:[],visualAccepted:false};
 const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence}),error=e=>report.runtimeErrors.push(String(e.message||e.reason||e));
 window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);
 try{
  a.pause(true);a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});if(a.fireworks().active||a.fireworks().queued||a.smoke().state.packetCount)throw Error('Fresh default empty scene required');
  await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('stars');await a.setTime({running:false});
  a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});a.setFireworksTailColourMode('constant');
  a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);
  a.setFireworks({type:'palm',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:false});
  report.audioBefore=clone(audio(a));report.launch=clone(a.launchFirework({type:'palm',seed:42,intensityScale:1}));if(!report.launch.accepted||report.launch.queued)throw Error('Immediate real launch required');
  const target=report.launch.burstTime+report.phase,deadline=performance.now()+60000;a.pause(false);a.pauseAtPhysicalTime(target);
  while(!a.state.parameters.paused||a.state.time<target-1e-8){if(report.runtimeErrors.length)throw Error(report.runtimeErrors[0]);if(performance.now()>deadline)throw Error('Physical phase did not arrive');await raf();}
  const front={camera:clone(a.state.camera),target:clone(a.state.target)},centre=clone(a.fireworkClusters()[0]?.position);
  if(!centre||centre.length!==3||!centre.every(Number.isFinite))throw Error('Live physical light centroid required');
  const frozenMatter=json(a.smokeSnapshot()),frozenAudio=json(audio(a)),frozenEvents=json(a.fireworks().activeEvents),utc=a.celestial().utcMs,q=json(quality(a.state));
  report.fixed={time:target,cameraEV:16.5,utcMs:utc,quality:JSON.parse(q),smoke:clone(a.smoke()),audio:JSON.parse(frozenAudio),centre};
  for(const angle of ['front','detail']){
   const pose=angle==='front'?front:{camera:centre.map((x,i)=>x+[-80,12,-155][i]),target:centre};a.setCamera(pose.camera,pose.target);
   const accepted={camera:clone(a.state.camera),target:clone(a.state.target)};
   for(const mode of ['constant','cooling','constant']){
    const repeat=mode==='constant'&&report.captures.some(c=>c.angle===angle&&c.mode==='constant'),key=angle+'_'+mode+(repeat?'_repeat':'');
    a.setFireworksTailColourMode(mode);for(let i=0;i<40;i++)await raf();
    const photo=clone(a.photometry()),state=clone(a.state),range=await a.inspectRadiance();report.images[key]=a.screenshot();
    const fw=clone(a.fireworks());report.captures.push({key,angle,mode,time:state.time,camera:state.camera,target:state.target,photo,range,fireworks:fw,clusters:clone(a.fireworkClusters()),gl:a.readGLErrors(key)});
    check(key+': physical event matter audio UTC quality and camera unchanged',Math.abs(state.time-target)<1e-8&&photo.cameraEV===16.5&&json(a.smokeSnapshot())===frozenMatter&&json(audio(a))===frozenAudio&&json(fw.activeEvents)===frozenEvents&&a.celestial().utcMs===utc&&json(quality(state))===q&&json(state.camera)===json(accepted.camera)&&json(state.target)===json(accepted.target));
    check(key+': full main composed mirror buffers remain finite nonnegative and safely budgeted',safe(range,photo)&&photo.storedBound<=photo.safeMaximum*(1+1e-10));
   }
  }
  check('one real physical launch only',a.fireworks().launches===1, a.fireworks().launches);
  check('A repeats are byte-identical after complete mode roundtrip',['front','detail'].every(k=>report.images[k+'_constant']===report.images[k+'_constant_repeat']));
  check('cooling changes actual emitted pixels in both views',['front','detail'].every(k=>report.images[k+'_constant']!==report.images[k+'_cooling']));
  check('no runtime or GL error',!report.runtimeErrors.length&&report.captures.every(c=>!c.gl.errors.length)&&!a.state.graphicsContextInterrupted);
 }catch(e){report.error=String(e.stack||e);check('complete actual A/B/A scene',false,report.error);}
 finally{a.pause(true);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);}
 report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.passed=report.checks.every(c=>c.passed);
 report.limits=['Detached-tail chromaticity only; authored2850→1900K, not measured chemistry or temperature.','Fixed photographic C; storage P may adapt to the actual changed RGB bound. No I/envelope/motion/smokeM/audio gain changes.','Six full-frame readbacks are numerical/compatibility evidence, not performance; images still require subjective review.','No source-to-cloud, full HDR display/panel photometry or long accumulation acceptance.','Fixture deliberately leaves paused QA view; caller restores defaults by reloading.'];return report;
}
