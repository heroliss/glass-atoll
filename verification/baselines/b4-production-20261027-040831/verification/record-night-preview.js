// Explicit local acceptance capture. No microphone/device permission needed:
// the soundtrack is the scene's existing mixed Web Audio destination.
export async function recordNightPreview(a,{seconds=24}={}){
  if(!a.audio.loaded||!a.audio.enabled)throw new Error('Enable the scene sound using its button first.');
  const savedHDR=a.state.parameters.graphics.hdrMode,events=[],chunks=[];
  await a.setGraphics({hdrMode:'sdr'});await a.timePreset('moon');
  a.setCamera([-48,12,-40],[0,2.5,0]);a.setFireworks({type:'chrysanthemum',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:78});
  const canvas=document.querySelector('#scene canvas'),video=canvas.captureStream(30),audio=a.captureAudio();
  const stream=new MediaStream([...video.getVideoTracks(),...audio.getAudioTracks()]);
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000,audioBitsPerSecond:128000});
  const result=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||new Error('Recorder error'));recorder.onstop=async()=>{const blob=new Blob(chunks,{type:mime}),dataURL=await new Promise((yes,no)=>{const f=new FileReader();f.onload=()=>yes(f.result);f.onerror=no;f.readAsDataURL(blob);});resolve({dataURL,bytes:blob.size,mime});};});
  const started=performance.now(),initialTime=a.state.time;recorder.start(500);a.launchFirework();
  const second=setTimeout(()=>a.launchFirework({type:'ring'}),10000);
  const sampling=setInterval(()=>{const p=a.fireworks();events.push({wallSeconds:(performance.now()-started)/1000,time:a.state.time,fps:a.state.fps,active:p.active,records:p.records,camera:a.state.camera,photometry:{P:a.photometry().storageEV,C:a.photometry().cameraEV},audio:p.audio});},100);
  try{await new Promise(resolve=>setTimeout(resolve,seconds*1000));recorder.stop();const media=await result;return {...media,report:{date:new Date().toISOString(),started,initialTime,durationSeconds:(performance.now()-started)/1000,dimensions:[canvas.width,canvas.height],requestedCaptureFPS:30,types:['chrysanthemum','ring'],events,limits:['Actual scene canvas and synchronized master audio, SDR preview; not calibrated HDR','Capture/encoding can change frame time; use separate benchmarks for performance','Real recording onset/distance model and authored source photometry remain declared approximations']}};}
  finally{clearTimeout(second);clearInterval(sampling);video.getTracks().forEach(t=>t.stop());a.stopAudioCapture();a.pause(true);await a.setGraphics({hdrMode:savedHDR});}
}
