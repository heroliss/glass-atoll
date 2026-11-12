const clone=x=>structuredClone(x),json=x=>JSON.stringify(x),raf=()=>new Promise(r=>requestAnimationFrame(r));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const safe=r=>['opaque','composed','reflection'].every(k=>r[k].stateRestored&&r[k].counterConsistency&&r[k].countNaN===0&&r[k].countInf===0&&r[k].countNegative===0);
export async function runAdaptiveTrailSceneCheck(a,{type='palm',phase=.8,angles=['front','detail']}={}){
  if(type!=='palm'||phase!==.8||!angles.every(x=>['front','detail'].includes(x)))throw Error('This scene gate is the explicit palm+.8 case');
  const report={schema:'glass-atoll.adaptive-tail-same-event-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,type,phase,images:{},captures:[],checks:[]};
  const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
  a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
  const deadline=performance.now()+45000;
  while(a.fireworks().active||a.fireworks().queued){if(performance.now()>deadline)throw Error('Previous event did not retire');await raf();}
  a.clearSmoke();report.sourceProfile=a.setSmokeReviewProfile('palm-fan-burn');
  await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('moon');await a.setTime({running:false});
  a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});
  a.setFireworks({type,autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:true});
  a.setFireworksTrailIntegration('legacy8');report.launch=clone(a.launchFirework({type,seed:42,intensityScale:1}));
  if(!report.launch.accepted||report.launch.queued)throw Error('Actual palm launch required');
  const target=report.launch.burstTime+phase;a.pauseAtPhysicalTime(target);
  const until=performance.now()+30000;
  while(!a.state.parameters.paused||a.state.time<target-1e-8){if(performance.now()>until)throw Error('Exact phase timeout');await raf();}
  const clusters=clone(a.fireworkClusters()),source=clone(a.smokeSnapshot()),utc=a.celestial().utcMs,front={camera:clone(a.state.camera),target:clone(a.state.target)},centre=clusters[0]?.position;
  if(!centre)throw Error('Live actual source centroid required');
  for(const angle of angles){
    const pose=angle==='front'?front:{camera:centre.map((v,i)=>v+[-48,12,-95][i]),target:centre};
    a.setCamera(pose.camera,pose.target);const accepted={camera:clone(a.state.camera),target:clone(a.state.target)};let referenceP=null;
    for(const mode of ['legacy8','adaptive']){
      a.setFireworksTrailIntegration(mode);a.setCamera(accepted.camera,accepted.target);for(let i=0;i<36;i++)await raf();
      const image=a.screenshot(),state=clone(a.state),photo=clone(a.photometry()),range=await a.inspectRadiance(),effects=clone(a.fireworks()),smoke=clone(a.smokeSnapshot());
      const key=angle+'_'+mode;report.images[key]=image;if(referenceP===null)referenceP=photo.storageEV;
      const invariants={sourceSnapshotExact:json(smoke)===json(source),sourceClustersExact:json(a.fireworkClusters())===json(clusters),cameraErrorMetres:distance(state.camera,accepted.camera),targetErrorMetres:distance(state.target,accepted.target),clockError:Math.abs(state.time-target),cameraEV:photo.cameraEV,storageEV:photo.storageEV,utcExact:a.celestial().utcMs===utc};
      report.captures.push({key,angle,mode,time:state.time,camera:state.camera,target:state.target,acceptedPose:accepted,photometry:photo,range,tailIntegration:effects.tailIntegration,lens:state.lens,invariants});
      check(key+': physical source camera clock C P unchanged',invariants.sourceSnapshotExact&&invariants.sourceClustersExact&&invariants.cameraErrorMetres<1e-8&&invariants.targetErrorMetres<1e-8&&invariants.clockError<1e-8&&photo.cameraEV===16.5&&photo.storageEV===referenceP&&invariants.utcExact,invariants);
      check(key+': requested integration actually rendered',effects.tailIntegration?.requested===mode&&String(effects.tailIntegration?.effective).startsWith(mode),effects.tailIntegration);
      check(key+': all actual HDR buffers safe',safe(range)&&photo.storedBound<=photo.safeMaximum*(1+1e-10)&&['opaque','composed','reflection'].every(k=>range[k].globalMax<=photo.safeMaximum*(1+1e-4)));
    }
  }
  report.finalGL=a.readGLErrors('adaptive-scene-exit');check('actual scene has no observed GL error',report.finalGL.errors.length===0&&!a.state.graphicsContextInterrupted,report.finalGL);
  report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.passed=report.checks.every(c=>c.passed);report.visualAccepted=false;
  report.limits=['Uniform-tail numerical imaging change only; point source/raw bound and actual smoke density are unchanged.','The smoke source is the explicit palm-fan continuous QA candidate, not production default.','Actual PNGs are unedited SDR; no pixel-identity gate because the intended point-spread profile changes.','Caller must inspect motion and measure cost; this paused scene is not an FPS or no-flicker proof.','Leaves scene paused in adaptive mode/C16.5 for further QA; reload restores defaults.'];
  return report;
}
