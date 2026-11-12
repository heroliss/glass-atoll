// Verification only. Records the current native SDR canvas and the app's own
// post-compressor audio tap. No microphone, camera cut, render call or time reset.
export const R36_RADIANT_MOTION_RECORDER_REVISION='r36-one-radiant-native-sdr-audio-24s-v2';
const PROFILE='three-heart-radiant120-v1',SEED=341070,SECONDS=24,FPS=30,MAX_WALL_MS=30000;
const AUDIO_SHA='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31';
const clone=value=>structuredClone(value),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const demand=(condition,message)=>{if(!condition)throw Error(message);};
const scalarKeys=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value?.[key]??null]));
let busy=false;

function compactAudio(value){return scalarKeys(value,['scheduled','discarded','recordedPlays','synthesizedPlays','activeVoices','outputReady','recordingLoaded','relativeBurstGain','postCompressorHeadroomGain','loadError','lastArrival']);}
function compactField(value){return scalarKeys(value,['requestedEnabled','enabled','effective','reason','requiredPairs','pairs','count','mapDraws','bakePasses','bakeMode','maxRequestPairs','maxMapPairs','maxMapDraws','sourceVersion','densityRevision','packetVersion','ledgerVersion','reused']);}
function stableConfiguration(a,state,fireworks,smoke){
  const parameters=clone(state.parameters);delete parameters.paused;
  return{parameters,fireworks:clone(fireworks.settings),smoke:{sourceModel:smoke.events.sourceModel,parameters:clone(smoke.events.parameters),projectionMode:smoke.rendering.projectionMode,lightFieldBakeMode:smoke.rendering.lightFieldBakeMode},clock:scalarKeys(a.celestial(),['utcMs','observer','mode','refraction','rate','running','timeZoneOffsetMinutes']),diagnosticCameraEV:a.diagnosticCameraEV??null,trailIntegration:fireworks.tailIntegration?.requested??fireworks.tailIntegration?.mode??'legacy8'};
}
function nativeSDR(state,canvas){
  demand(state.parameters.graphics.hdrMode==='sdr'&&state.parameters.graphics.hdr===false&&state.lens.hdr?.enabled===false,'Select and settle native SDR before recording');
  demand(state.lens.displayTransform?.kind==='sdr','An actual settled SDR presentation is required');
  const dimensions=[canvas.width,canvas.height];
  demand(dimensions.every(n=>Number.isSafeInteger(n)&&n>0),'Invalid native canvas dimensions');
  demand(state.lens.width===dimensions[0]&&state.lens.height===dimensions[1]&&state.lens.outputWidth===dimensions[0]&&state.lens.outputHeight===dimensions[1]&&state.renderScale===1,'Native canvas, scene and output dimensions must agree at renderScale 1');
  return dimensions;
}
function emptySmoke(smoke){
  demand(smoke.state.packetCount===0&&smoke.state.pendingEmissions===0,'Start with an empty smoke state');
  const events=smoke.events;
  demand(events.fault===null&&events.pendingEvents===0&&events.releaseErrors===0&&events.lastReleaseError===null,'Start with an empty, fault-free smoke event scheduler');
  if(events.version==='pyro-smoke-logical-events-v1'){
    for(const key of ['pendingStreams','remainingCells','futureCellArrays','positionArchives'])demand(Object.hasOwn(events,key)&&events[key]===0,'Empty logical smoke scheduler requires '+key+' === 0');
  }else if(events.version==='pyro-smoke-trajectory-v1'){
    demand(Object.hasOwn(events,'pendingPlans')&&events.pendingPlans===0,'Empty trajectory smoke scheduler requires pendingPlans === 0');
  }else throw Error('Unsupported smoke event diagnostics version; do not infer missing pending counters');
}
function preflight(a,canvas){
  for(const name of ['fireworks','smoke','photometry','celestial','director','cameraTransition','captureAudio','stopAudioCapture','launchFirework','pause'])demand(typeof a?.[name]==='function','Missing existing app API '+name);
  const state=a.state,fireworks=a.fireworks(),smoke=a.smoke(),audio=a.audio;
  demand(state.ready===true&&state.parameters.paused===true&&!state.graphicsContextInterrupted,'A healthy paused scene is required');
  demand(!document.hidden&&!document.body.inert,'The visible app must not be in another diagnostic transaction');
  demand(fireworks.active===0&&fireworks.queued===0&&fireworks.activeEvents.length===0,'Retire the prior firework before recording; this tool does not clear or rewind it');
  emptySmoke(smoke);
  const f=fireworks.settings;
  demand(f.effectProfile===PROFILE&&f.type==='chrysanthemum'&&f.intensityScale===1&&f.starDragModel==='bounded-descent','Select the radiant 120 m profile at user intensity 1 before recording');
  demand(f.autoLaunch===false&&f.autoFrame===false,'Automatic launch and automatic framing must already be off');
  demand(f.persistentSmoke===true&&f.cloudIllumination===true&&f.resolvedSmokeLighting===true,'Native smoke, cloud illumination and resolved smoke lighting must already be enabled');
  demand(a.director().mode==='off'&&!a.director().active&&a.cameraTransition()===null,'Finish camera transitions and disable the camera director before recording');
  demand(a.celestial().running===false,'Freeze the selected celestial clock before recording; physical simulation time will still advance');
  demand(audio.enabled===true&&audio.loaded===true&&!audio.loading&&!audio.captureActive&&['running','suspended'].includes(audio.contextState),'Enable and load native sound first; another audio capture must not be active');
  demand(fireworks.audio.recordingLoaded===true&&fireworks.audio.outputReady===true&&!fireworks.audio.loadError&&fireworks.audio.activeVoices===0,'The approved native firework recording must be loaded, idle and ready');
  demand(fireworks.audio.relativeBurstGain===12&&fireworks.audio.postCompressorHeadroomGain===.7,'Approved native firework audio gain changed');
  demand(canvas&&typeof canvas.captureStream==='function','The existing scene canvas must support captureStream');
  nativeSDR(state,canvas);
  demand(Array.isArray(state.camera)&&state.camera.length===3&&state.camera.every(Number.isFinite)&&Array.isArray(state.target)&&state.target.length===3&&state.target.every(Number.isFinite),'The fixed camera pose is invalid');
  return{state,fireworks,smoke,audio,configuration:stableConfiguration(a,state,fireworks,smoke)};
}

/** Fixed one-event recorder. Caller configures the camera and settings first.
 * Returns {dataURL, report}; report contains no base64. On failure error.report
 * contains bounded diagnostics. The event/smoke and elapsed time are not erased.
 */
export async function recordRadiantMotion(a){
  demand(!busy,'A radiant-motion recording is already active');busy=true;
  const entered=performance.now(),report={schema:'glass-atoll.r36-radiant-motion-recording.v1',revision:R36_RADIANT_MOTION_RECORDER_REVISION,dateUTC:new Date().toISOString(),profile:PROFILE,seed:SEED,userIntensityScale:1,secondsRequested:SECONDS,captureFPSRequested:FPS,totalWallLimitMilliseconds:MAX_WALL_MS,audioSHA256Expected:AUDIO_SHA,passed:false,actualRecording:false,samples:[],limits:['24 seconds of real wall time; requested canvas 30 fps is not a measured renderer frame rate.','Physical time can advance more slowly than wall time because the application caps per-frame simulation delta; both clocks and their ratio are reported.','Normal native SDR canvas and existing post-compressor stereo mix; no microphone or absolute nits/SPL calibration.','Timer cancellation is cooperative: JavaScript cannot preempt a blocked main thread or browser media encoder.','One evolving event with fixed camera; no paired timing, universal visual acceptance or GPU-performance claim.','The tool pauses afterward; it does not clear smoke, rewind physical time, reset wave/cloud history or restore a pre-event image.']};
  const controller=new AbortController();let admitted=false,done=false,stopping=false,canvas,recorder,videoStream,audioStream,combinedStream,interval,holdTimer,deadlineTimer,fileReader;
  let firstError=null,recordStarted=null,launch=null,initial=null,stopResolve,stopReject,faultReject;
  const chunks=[],fault=new Promise((_,reject)=>{faultReject=reject;});fault.catch(()=>{});
  const stopped=new Promise((resolve,reject)=>{stopResolve=resolve;stopReject=reject;});stopped.catch(()=>{});
  const failure=error=>{if(done||firstError)return;firstError=error instanceof Error?error:Error(String(error));faultReject(firstError);};
  const awaitBounded=promise=>Promise.race([promise,fault]);
  const listeners=[];
  const listen=(target,name,handler)=>{target.addEventListener(name,handler);listeners.push([target,name,handler]);};
  function stopOwnedTracks(){for(const stream of [combinedStream,videoStream,audioStream])for(const track of stream?.getTracks?.()??[])try{track.stop();}catch{}}
  function cameraDelta(state){return Math.max(...state.camera.map((v,i)=>Math.abs(v-initial.state.camera[i])),...state.target.map((v,i)=>Math.abs(v-initial.state.target[i])));}
  function sample({allowPaused=false}={}){
    const state=a.state,fireworks=a.fireworks(),smoke=a.smoke(),photo=a.photometry(),delta=cameraDelta(state);
    demand(!state.graphicsContextInterrupted&&!document.hidden&&!document.body.inert,'Scene interrupted or hidden during recording');nativeSDR(state,canvas);
    demand(equal(stableConfiguration(a,state,fireworks,smoke),initial.configuration),'Source, lens, clock or scene settings changed during recording');
    demand(delta<=1e-8&&a.director().mode==='off'&&!a.director().active&&a.cameraTransition()===null,'Fixed camera moved during recording');
    demand(allowPaused||state.parameters.paused===false,'Scene was paused during recording');
    demand(fireworks.launches===initial.fireworks.launches+1&&fireworks.queued===0&&fireworks.activeEvents.every(event=>event.id===launch.id),'A second or unexpected event appeared during recording');
    demand(a.audio.enabled&&a.audio.loaded&&a.audio.captureActive&&!fireworks.audio.loadError,'Native audio capture was interrupted');
    demand(fireworks.audio.relativeBurstGain===12&&fireworks.audio.postCompressorHeadroomGain===.7,'Native firework audio gain changed');
    if(performance.now()-recordStarted>2000)demand(a.audio.contextState==='running','Native sound did not resume after the launch');
    const result={wallSeconds:(performance.now()-recordStarted)/1000,time:state.time,burstAge:state.time-launch.burstTime,fps:state.fps,paused:state.parameters.paused,cameraMaximumAbsoluteDeltaMetres:delta,fireworks:{active:fireworks.active,queued:fireworks.queued,launches:fireworks.launches,records:fireworks.records},photometry:scalarKeys(photo,['storageEV','cameraEV','outputExposureScale','storedBound','safeMaximum']),smoke:{packets:smoke.state.packetCount,pending:smoke.state.pendingEmissions,merges:smoke.state.merges,mass:scalarKeys(smoke.state.ledger,['emitted','airborne','pendingMass','residual','deposited','escaped','explicitlyCleared']),fault:clone(smoke.events.fault),lighting:compactField(smoke.rendering.resolvedLighting)},sourceT:typeof a.smokeTransmissionGPU==='function'?compactField(a.smokeTransmissionGPU()):null,audio:compactAudio(fireworks.audio),audioContext:a.audio.contextState};
    demand(Number.isFinite(result.time)&&result.time>=initial.state.time,'Physical time became invalid or was reset');
    report.samples.push(result);return result;
  }
  try{
    canvas=document.querySelector('#scene canvas');
    initial=preflight(a,canvas);
    demand(typeof MediaRecorder!=='undefined'&&typeof MediaStream!=='undefined'&&typeof FileReader!=='undefined','Native MediaRecorder, MediaStream and FileReader support is required');
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(value=>MediaRecorder.isTypeSupported(value));demand(mime,'No supported native WebM video/audio codec');report.mime=mime;
    deadlineTimer=setTimeout(()=>{failure(Error('Recording exceeded the 30 second total wall deadline'));controller.abort();try{fileReader?.abort();}catch{}try{if(recorder?.state!=='inactive')recorder?.stop();}catch{}stopOwnedTracks();if(admitted)try{a.pause(true);}catch{};},Math.max(0,MAX_WALL_MS-(performance.now()-entered)));
    const response=await awaitBounded(fetch(new URL('../fireworks-audio.js',import.meta.url),{cache:'no-store',signal:controller.signal}));demand(response.ok,'Cannot fetch the approved served audio source');
    const bytes=await awaitBounded(response.arrayBuffer()),digest=await awaitBounded(crypto.subtle.digest('SHA-256',bytes));
    report.audioSHA256Served=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');demand(report.audioSHA256Served===AUDIO_SHA,'Served firework audio source differs from the approved source');
    const checked=preflight(a,canvas);demand(equal(checked.configuration,initial.configuration)&&checked.state.time===initial.state.time&&equal(checked.state.camera,initial.state.camera)&&equal(checked.state.target,initial.state.target),'Scene changed during audio-source verification');initial=checked;admitted=true;
    report.initial={time:initial.state.time,camera:clone(initial.state.camera),target:clone(initial.state.target),configuration:clone(initial.configuration),dimensions:nativeSDR(initial.state,canvas),audio:compactAudio(initial.fireworks.audio),soundscape:scalarKeys(initial.audio,['enabled','loaded','contextState','captureActive','warnings'])};
    videoStream=canvas.captureStream(FPS);audioStream=a.captureAudio();combinedStream=new MediaStream([...videoStream.getVideoTracks(),...audioStream.getAudioTracks()]);
    demand(combinedStream.getVideoTracks().length===1&&combinedStream.getAudioTracks().length>=1&&combinedStream.getTracks().every(track=>track.readyState==='live'),'Live native canvas and app audio tracks are required');
    report.tracks=combinedStream.getTracks().map(track=>({kind:track.kind,label:track.label,settings:clone(track.getSettings?.()??{})}));
    recorder=new MediaRecorder(combinedStream,{mimeType:mime,videoBitsPerSecond:12000000,audioBitsPerSecond:160000});
    recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
    recorder.onerror=event=>{const error=event.error||Error('Native MediaRecorder failed');failure(error);stopReject(error);};
    recorder.onstop=()=>{if(!stopping)failure(Error('Native recorder stopped before the requested end'));stopResolve(new Blob(chunks,{type:recorder.mimeType||mime}));};
    listen(document,'visibilitychange',()=>{if(document.hidden)failure(Error('The app became hidden during recording'));});
    if(globalThis.addEventListener)listen(globalThis,'pagehide',()=>failure(Error('The app navigated during recording')));
    for(const track of combinedStream.getTracks())listen(track,'ended',()=>{if(!stopping)failure(Error('A native media track ended early'));});
    recordStarted=performance.now();recorder.start(500);report.actualRecording=true;
    launch=clone(a.launchFirework({type:'chrysanthemum',effectProfile:PROFILE,seed:SEED,intensityScale:1}));
    demand(launch.accepted===true&&launch.queued===false&&launch.effectProfile===PROFILE&&launch.intensityScale===1,'One immediate radiant-profile launch at user gain 1 is required');
    const afterLaunch=a.fireworks(),event=afterLaunch.activeEvents.find(item=>item.id===launch.id),last=afterLaunch.lastLaunch;demand(event?.effectProfile===PROFILE&&last?.id===launch.id&&last.seed===SEED&&last.effectProfile===PROFILE,'The launched native event identity was not observed');
    report.launch=launch;report.launchSource={id:event.id,seed:last.seed,launchTime:last.time,burstTime:launch.burstTime,referencePeakBudget:event.layerProfile?.referencePeakBudget??launch.layerProfile?.referencePeakBudget,nativeReferencePeakBudget:event.layerProfile?.nativeReferencePeakBudget??launch.layerProfile?.nativeReferencePeakBudget};
    sample();interval=setInterval(()=>{try{sample();}catch(error){failure(error);}},250);
    await awaitBounded(new Promise(resolve=>{holdTimer=setTimeout(resolve,Math.max(0,SECONDS*1000-(performance.now()-recordStarted)));}));
    if(firstError)throw firstError;report.final=sample();stopping=true;clearInterval(interval);recorder.stop();report.captureWallSeconds=(performance.now()-recordStarted)/1000;
    const blob=await awaitBounded(stopped);demand(blob.size>0,'Native recorder returned an empty file');
    demand(report.final.audio.recordedPlays>report.initial.audio.recordedPlays,'No native recorded main explosion was scheduled during this recording');
    report.mime=blob.type;report.bytes=blob.size;report.chunks=chunks.length;report.physicalSecondsAdvanced=report.final.time-initial.state.time;report.physicalToCaptureWallRatio=report.physicalSecondsAdvanced/report.captureWallSeconds;report.fixedCameraExact=report.samples.every(value=>value.cameraMaximumAbsoluteDeltaMetres===0);report.maximumCameraAbsoluteDeltaMetres=Math.max(...report.samples.map(value=>value.cameraMaximumAbsoluteDeltaMetres));
    const dataURL=await awaitBounded(new Promise((resolve,reject)=>{fileReader=new FileReader();fileReader.onload=()=>resolve(fileReader.result);fileReader.onerror=()=>reject(fileReader.error||Error('Cannot serialize the owned recording'));fileReader.onabort=()=>reject(Error('Recording serialization was cancelled'));fileReader.readAsDataURL(blob);}));
    demand(typeof dataURL==='string'&&dataURL.startsWith('data:video/webm')&&dataURL.includes(';base64,'),'Unexpected native recording serialization');
    report.passed=true;return{dataURL,report};
  }catch(error){firstError=error instanceof Error?error:Error(String(error));report.error=firstError.message;firstError.report=report;throw firstError;
  }finally{
    stopping=true;clearInterval(interval);clearTimeout(holdTimer);clearTimeout(deadlineTimer);controller.abort();
    for(const [target,name,handler]of listeners)try{target.removeEventListener(name,handler);}catch{}
    if(recorder?.state&&recorder.state!=='inactive')try{recorder.stop();}catch{}
    stopOwnedTracks();const cleanupErrors=[];
    if(audioStream)try{a.stopAudioCapture();}catch(error){cleanupErrors.push('stopAudioCapture: '+error.message);}
    if(admitted)try{a.pause(true);}catch(error){cleanupErrors.push('pause: '+error.message);}
    report.cleanup={attempted:admitted,tracksStopped:[combinedStream,videoStream,audioStream].filter(Boolean).every(stream=>stream.getTracks().every(track=>track.readyState==='ended')),audioTapStopped:audioStream?!a.audio.captureActive:true,paused:admitted?a.state.parameters.paused:null,errors:cleanupErrors,elapsedWallSeconds:(performance.now()-entered)/1000,sourceCameraAndTimeSettersCalled:false,sceneMatterCleared:false};
    if(cleanupErrors.length||!report.cleanup.tracksStopped||!report.cleanup.audioTapStopped||(admitted&&!report.cleanup.paused)){report.passed=false;if(!firstError){const error=Error('Native recording cleanup failed');error.report=report;done=true;busy=false;throw error;}}
    done=true;busy=false;
  }
}
