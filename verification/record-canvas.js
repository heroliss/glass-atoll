// QA recording of the running renderer. No microphone, filesystem or network.
let activeRecording=null;
export function markCanvasRecording(label){if(activeRecording)activeRecording.events.push({time:(performance.now()-activeRecording.start)/1000,label});}
export async function recordCanvas({seconds=5,fps=60,cues=[]}={}){
  const canvas=document.querySelector('#scene canvas');
  if(!canvas?.captureStream)throw new Error('Canvas captureStream unavailable');
  const stream=canvas.captureStream(fps),chunks=[],events=[],timers=[];
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(MediaRecorder.isTypeSupported);
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:18000000});
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  const start=performance.now();
  activeRecording={start,events};
  for(const cue of cues)timers.push(setTimeout(()=>{window.__ATOLL__.setLens(cue.lens);events.push({time:(performance.now()-start)/1000,lens:cue.lens});},cue.at*1000));
  await new Promise((resolve,reject)=>{recorder.onerror=reject;recorder.onstop=resolve;recorder.start(250);timers.push(setTimeout(()=>recorder.stop(),seconds*1000));});
  timers.forEach(clearTimeout);stream.getTracks().forEach(track=>track.stop());
  activeRecording=null;
  const blob=new Blob(chunks,{type:mime});
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  return {data,metadata:{seconds,fpsRequested:fps,mime,bytes:blob.size,events,viewport:[canvas.width,canvas.height],state:window.__ATOLL__.state}};
}
