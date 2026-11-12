// Local scene canvas + existing mixed WebAudio bus. No microphone is used.
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function recordOrbitPreview(a,{seconds=16}={}){
  if(!a.audio.loaded||!a.audio.enabled)throw new Error('Enable the scene sound with its native button before recording.');
  const saved={clock:a.celestial(),sun:a.state.parameters.sun,lens:a.state.parameters.lens,graphics:a.state.parameters.graphics,
    camera:a.state.camera,target:a.state.target,paused:a.state.parameters.paused,fireworks:a.fireworks().settings};
  let video,recorder,sampling,launchTimer;const chunks=[],events=[];
  try{
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const deadline=performance.now()+30000;
    while((a.fireworks().active||a.fireworks().queued)&&performance.now()<deadline)await wait(100);
    if(a.fireworks().active||a.fireworks().queued)throw new Error('Existing events did not finish; recording does not delete them.');
    await a.setGraphics({hdrMode:'sdr'});await a.timePreset('moon');await a.setTime({running:false});
    a.setLens({focal:28,exposure:0,dof:false,opticalFlare:true});a.setCamera([-48,12,-40],[0,2.5,0]);
    a.setFireworks({type:'ring',autoLaunch:false,autoDirection:true,autoFrame:false,elevation:80});
    const plan=a.setDirector({mode:'fireworks',periodSeconds:240});a.pause(false);
    const entryDeadline=performance.now()+(plan.entrySeconds+4)*1000;
    while(a.director().phase!=='orbit'){
      if(!a.director().active||performance.now()>entryDeadline)throw new Error('Director entry was cancelled or exceeded its bounded wait.');
      await wait(80);
    }
    const canvas=document.querySelector('#scene canvas');video=canvas.captureStream(30);
    const audio=a.captureAudio(),stream=new MediaStream([...video.getVideoTracks(),...audio.getAudioTracks()]);
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime)throw new Error('No supported recorder codec.');
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6500000,audioBitsPerSecond:160000});
    const finished=new Promise((resolve,reject)=>{
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||new Error('Recorder failed'));
      recorder.onstop=async()=>{try{const blob=new Blob(chunks,{type:mime}),dataURL=await new Promise((yes,no)=>{const r=new FileReader();r.onload=()=>yes(r.result);r.onerror=no;r.readAsDataURL(blob);});resolve({dataURL,bytes:blob.size,mime});}catch(e){reject(e);}};
    });
    const started=performance.now(),initialTime=a.state.time;let launch;
    recorder.start(500);launchTimer=setTimeout(()=>{launch=a.launchFirework();},400);
    sampling=setInterval(()=>events.push({wallSeconds:(performance.now()-started)/1000,time:a.state.time,fps:a.state.fps,gpuMs:a.state.gpuMs,
      camera:a.state.camera,target:a.state.target,director:a.director().phase,photometry:{P:a.photometry().storageEV,C:a.photometry().cameraEV},audio:a.fireworks().audio}),100);
    await wait(seconds*1000);recorder.stop();const media=await finished;
    return {...media,report:{date:new Date().toISOString(),durationSeconds:(performance.now()-started)/1000,initialTime,launch,plan,
      dimensions:[canvas.width,canvas.height],captureFPS:30,events,limits:['Actual scene and synchronized existing mix, ordinary SDR video; not calibrated HDR or full-scene FPS measurement.',
        'R2 A/C preview: persistent smoke, transient cloud light and new indirect light are not yet connected.',
        'The face is a fixed world plane; orbit motion changes its perspective. Lens ghosts use an authored finite-energy image-space PSF.']}};
  }finally{
    clearTimeout(launchTimer);clearInterval(sampling);if(recorder?.state==='recording')recorder.stop();
    video?.getTracks().forEach(t=>t.stop());a.stopAudioCapture();a.setDirector({mode:'off'});a.pause(true);
    await a.setGraphics({hdrMode:saved.graphics.hdrMode});a.setLens(saved.lens);
    await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});
    if(saved.clock.mode==='artistic')a.setSun(saved.sun);
    a.setCamera(saved.camera,saved.target);a.setFireworks(saved.fireworks);a.pause(saved.paused);
  }
}
