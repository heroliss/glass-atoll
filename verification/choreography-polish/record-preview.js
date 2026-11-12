// Local acceptance only: actual running scene and its own WebAudio mix.
// No microphone, new graphics context, arbitrary camera or offline animation.
let busy=false;
export async function recordPolishPreview(a,{type,seed=619,seconds}={}){
  const durations={'display-vfan':24,'display-waterfall':16,heart:13,ring:12};
  if(!Object.hasOwn(durations,type)||busy)throw Error('One supported polish preview at a time');
  const duration=seconds??durations[type];if(!Number.isFinite(duration)||duration<durations[type]||duration>30)throw Error('Preview duration outside its fixed bounds');
  busy=true;const savedHDR=a.state.parameters.graphics.hdrMode,chunks=[],samples=[];let recorder,video,audio,interval,stopTimeout,recording;
  try{
    a.pause(true);a.setFireworks({type,autoLaunch:false,autoFrame:false,effectProfile:'legacy',elevation:80,autoDirection:true,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});
    await a.setGraphics({hdrMode:'sdr'});a.setView('fireworks-close');
    const startedSettle=performance.now();let prior=a.state.camera,settled=0;
    while(settled<4){await new Promise(requestAnimationFrame);const next=a.state.camera;settled=Math.hypot(...next.map((v,i)=>v-prior[i]))<1e-7?settled+1:0;prior=next;if(performance.now()-startedSettle>15000)throw Error('Preview camera did not settle');}
    const canvas=document.querySelector('#scene canvas');if(!canvas?.captureStream)throw Error('Canvas capture unavailable');
    video=canvas.captureStream(30);const tracks=[...video.getVideoTracks()];
    if(a.audio.enabled&&a.audio.loaded){audio=a.captureAudio();tracks.push(...audio.getAudioTracks());}
    const stream=new MediaStream(tracks),mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp9','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000,audioBitsPerSecond:192000});
    const finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error??Error('Video recorder failed'));recorder.onstop=resolve;});
    const startWall=performance.now(),startTime=a.state.time;recording=true;recorder.start(500);const launch=a.launchFirework({type,seed,launchSpreadDegrees:0,burstOrientation:{yawDegrees:0,tiltDegrees:0,rollDegrees:0}});if(!launch.accepted)throw Error('Preview launch rejected');
    let completed=false;
    interval=setInterval(()=>{const state=a.state;samples.push({wallSeconds:(performance.now()-startWall)/1000,time:state.time,fps:state.fps,renderScale:state.renderScale});if(state.time-startTime>=duration){completed=true;clearInterval(interval);if(recorder.state==='recording')recorder.stop();}},250);
    stopTimeout=setTimeout(()=>{clearInterval(interval);if(recorder.state==='recording')recorder.stop();},45000);
    await finished;recording=false;const endTime=a.state.time,elapsed=(performance.now()-startWall)/1000;a.pause(true);
    const blob=new Blob(chunks,{type:mime}),dataURL=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
    return{dataURL,mime,bytes:blob.size,metadata:{completed,type,seed,launch,wallSeconds:elapsed,physicalSeconds:endTime-startTime,requestedPhysicalSeconds:duration,dimensions:[canvas.width,canvas.height],captureFPSRequested:30,recordedAudio:!!audio,camera:a.state.camera,target:a.state.target,samples,gl:a.readGLErrors('polish-preview-'+type),limits:['Actual SDR canvas preview; original HDR mode restored afterward','Audio is the existing scene mix; no microphone','Encoding and diagnostic sampling affect frame time; this is not a performance benchmark']}};
  }finally{
    clearInterval(interval);clearTimeout(stopTimeout);if(recording&&recorder?.state==='recording')recorder.stop();video?.getTracks().forEach(t=>t.stop());if(audio)a.stopAudioCapture();a.pause(true);await a.setGraphics({hdrMode:savedHDR});busy=false;
  }
}
