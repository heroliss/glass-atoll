// QA-only actual canvas recording, existing WebAudio mix, one selected real smoke host.
// No microphone, fabricated frames, source intensity compensation or image enhancement.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function recordSmokeMotionPreview(a,{seconds=20,profile='production',intensityScale=1,seed=42,periodSeconds=240,cameraMode='orbit',flightOptions={},cameraEV=null}={}){
  if(!a.audio.loaded||!a.audio.enabled)throw Error('Enable scene sound using its native button before recording');
  if(!['production','taylor48','ring-burn'].includes(profile)||seconds<8||seconds>30)throw RangeError('Bounded motion review requires a known profile and8..30 seconds');
  if(!['orbit','auto-frame'].includes(cameraMode))throw RangeError('Unknown review camera mode');
  const flightKeys=Object.keys(flightOptions).sort().join(','),timed=flightKeys==='burstDelaySeconds,flightModel'&&flightOptions.flightModel==='timed-reference'&&flightOptions.burstDelaySeconds===3,apexHeight=flightKeys==='height'&&Number.isFinite(flightOptions.height)&&flightOptions.height>=100&&flightOptions.height<=300;
  if(flightKeys&&!timed&&!apexHeight)throw RangeError('Only the explicit ring3s candidate or a bounded apex world-height comparison is supported');
  if(cameraEV!==null&&(!Number.isFinite(cameraEV)||cameraEV<-24||cameraEV>24))throw RangeError('Camera EV must be null or finite within -24..24');
  const saved={clock:a.celestial(),sun:a.state.parameters.sun,lens:a.state.parameters.lens,graphics:a.state.parameters.graphics,camera:a.state.camera,target:a.state.target,paused:a.state.parameters.paused,fireworks:a.fireworks().settings,director:a.director(),diagnosticCameraEV:a.diagnosticCameraEV};
  const chunks=[],samples=[],stills={};let recorder,video,sampling,launchTimer,launch=null,launchPhysics=null;
  try{
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const deadline=performance.now()+45000;
    while(a.fireworks().active||a.fireworks().queued){if(performance.now()>deadline)throw Error('Prior events failed to retire naturally');await wait(80);}
    a.clearSmoke();const selection=a.setSmokeReviewProfile(profile);
    await a.setGraphics({hdrMode:'sdr'});await a.timePreset('moon');await a.setTime({running:false});
    a.setLens({focal:28,exposure:0,dof:false,opticalFlare:true});a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);
    if(cameraEV!==null)a.setDiagnosticCameraEV(cameraEV);
    a.setFireworks({type:'ring',autoLaunch:false,autoDirection:true,autoFrame:cameraMode==='auto-frame',elevation:80,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:true,intensityScale});
    const plan=cameraMode==='orbit'?a.setDirector({mode:'fireworks',periodSeconds}):{mode:'auto-frame',source:'Actual per-event body trajectories after launch, including timed burst; no old static director forecast'};a.pause(false);
    const entryDeadline=performance.now()+(plan.entrySeconds+4)*1000;
    while(cameraMode==='orbit'&&a.director().phase!=='orbit'){if(!a.director().active||performance.now()>entryDeadline)throw Error('Director entry cancelled or timed out');await wait(80);}
    const canvas=document.querySelector('#scene canvas');video=canvas.captureStream(30);
    const audio=a.captureAudio(),stream=new MediaStream([...video.getVideoTracks(),...audio.getAudioTracks()]);
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime)throw Error('Recorder codec unavailable');
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:11000000,audioBitsPerSecond:160000});
    const finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onerror=e=>reject(e.error||Error('Recorder failed'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});
    const started=performance.now(),initialTime=a.state.time,initial={state:a.state,photo:a.photometry(),smoke:a.smoke(),field:a.fireworks().lightingField,audio:a.fireworks().audio};
    recorder.start(500);launchTimer=setTimeout(()=>{launch=a.launchFirework({type:'ring',seed,smileyLayout:'reference',intensityScale,...flightOptions});launchPhysics=structuredClone(a.fireworks().activeEvents.find(e=>e.id===launch.id));},400);
    sampling=setInterval(()=>{
      const s=a.state,d=a.smoke(),phase=launch?s.time-launch.burstTime:null;
      samples.push({wallSeconds:(performance.now()-started)/1000,time:s.time,burstAge:phase,fps:s.fps,gpuMs:s.gpuMs,camera:s.camera,target:s.target,director:a.director().phase,photometry:{P:a.photometry().storageEV,C:a.photometry().cameraEV},smoke:{packets:d.state.packetCount??d.state.packets,ledger:d.state.ledger,source:d.events,merges:d.state.merges},field:a.fireworks().lightingField,audio:a.fireworks().audio});
      for(const [label,target]of [['hot',1.1],['late',3.3],['cold',9]])if(phase>=target&&!stills[label])stills[label]={time:s.time,burstAge:phase,image:a.screenshot(),state:s,smoke:d};
    },200);
    await wait(seconds*1000);recorder.stop();const blob=await finished;
    if(flightOptions.flightModel&&launchPhysics?.heightInfo?.flightInfo?.model!==flightOptions.flightModel)throw Error('Loaded runtime did not apply the requested flight model');
    if(apexHeight&&(launchPhysics?.heightInfo?.inputMode!=='explicit-worldY'||Math.abs(launchPhysics.heightInfo.actualBurstWorldY-flightOptions.height)>1e-8||launchPhysics.heightInfo.flightInfo))throw Error('Loaded runtime did not apply the requested near-apex world height');
    return{blob,report:{schema:'glass-atoll.smoke-motion-review.v1',date:new Date().toISOString(),profile,selection,intensityScale,seed,cameraMode,flightOptions,cameraEV,launchPhysics,secondsRequested:seconds,durationSeconds:(performance.now()-started)/1000,initialTime,launch,plan,dimensions:[canvas.width,canvas.height],captureFPS:30,mime,bytes:blob.size,initial,samples,stills,final:{state:a.state,smoke:a.smoke(),field:a.fireworks().lightingField,audio:a.fireworks().audio},limits:['Actual one-host scene and synchronized existing audio mix;30fps is the recorder cadence, not proof of30/60fps renderer performance.','SDR video; HDR monitor brightness/calibration is not represented. No microphone is used.','Source profile is an explicit QA candidate and stays selected until reset/reload; production defaults unchanged.','Fixed physical-world smiley plane becomes oblique during orbit. No billboard correction.','Smoke is a Gaussian transport/scattering approximation; no incoming-smoke self-shadow or full multiple-scattering/cloud coupling.','No initial airborne matter is restored; explicit clear is part of this QA setup.','A raised apex height is an author comparison, not measured product ballistics; no inherited upward velocity is added.']} };
  }finally{
    clearTimeout(launchTimer);clearInterval(sampling);if(recorder?.state==='recording')recorder.stop();video?.getTracks().forEach(t=>t.stop());a.stopAudioCapture();a.setDirector({mode:'off'});a.pause(true);
    await a.setGraphics({hdrMode:saved.graphics.hdrMode});a.setLens(saved.lens);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});if(saved.clock.mode==='artistic')a.setSun(saved.sun);
    a.setCamera(saved.camera,saved.target);a.setFireworks(saved.fireworks);a.setDiagnosticCameraEV(saved.diagnosticCameraEV);
  }
}
