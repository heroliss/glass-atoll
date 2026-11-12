// QA only. Uses the existing real canvas and the already enabled WebAudio mix.
// One palm, one real smoke host, one documented cut. No microphone or gain change.
const clone=x=>structuredClone(x),wait=ms=>new Promise(r=>setTimeout(r,ms));
const AUDIO_SHA256='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31';
function smokeProfile(d){
  const p=d?.events?.parameters;if(!p)throw Error('Smoke source parameters are unavailable');
  const emission=p.emissionProfile??'two-births',kernel=p.kernelModel??d.events.kernelModel,dispersion=p.dispersionModel??d.state?.dispersion?.model??'brownian';
  if(emission==='palm-fan-uniform-burn-v1')return'palm-fan-burn';
  if(emission==='ring-uniform-burn-v1')return'ring-burn';
  // The unchanged v1 default intentionally omits point/Brownian tags. Infer
  // only its complete known parameter shape, never an arbitrary missing model.
  const pointDefaults={burstArea:20,launchArea:.35,fanLaunchArea:.1,bouquetLaunchArea:2,centralFraction:.2,trajectorySlots:12,releaseAges:[.35,.65],centrePackets:3,launchPackets:9};
  const exactPointDefaults=d.events.sourceModel==='trajectory-v1'&&(kernel===undefined||kernel==='point')&&dispersion==='brownian'&&Object.keys(p).sort().join(',')===Object.keys(pointDefaults).sort().join(',')&&Object.entries(pointDefaults).every(([key,value])=>JSON.stringify(p[key])===JSON.stringify(value));
  if(emission==='two-births'&&exactPointDefaults)return'production';
  if(emission==='two-births'&&kernel==='past-segment-v2'&&p.centralFraction===.05&&p.trajectorySlots===48&&dispersion==='taylor'&&p.lagrangianSeconds===10)return'taylor48';
  throw Error('Cannot exactly restore this unrecognized smoke QA profile; use a known profile first');
}
function compactSmoke(d){const s=d.state,e=d.events;return{time:s.time,requestedTime:s.requestedTime,packetCount:s.packetCount,capacity:s.capacity,ledger:clone(s.ledger),merges:s.merges,forcedMerges:s.forcedMerges,pendingEmissions:s.pendingEmissions,source:{emissionProfile:e.parameters.emissionProfile,allocatedArea:e.allocatedArea,materializedArea:e.materializedArea,reservedArea:e.reservedArea,cancelledReservedArea:e.cancelledReservedArea,accountingResidual:e.accountingResidual,pendingPlans:e.pendingPlans,pendingEvents:e.pendingEvents,epoch:e.epoch,closedThrough:e.closedThrough,fault:clone(e.fault),releaseErrors:e.releaseErrors},rendering:{lastRender:clone(d.rendering?.lastRender),resolvedLighting:clone(d.rendering?.resolvedLighting)}};}
function compactAudio(d){return{scheduled:d.scheduled,discarded:d.discarded,recordedPlays:d.recordedPlays,synthesizedPlays:d.synthesizedPlays,activeVoices:d.activeVoices,outputReady:d.outputReady,recordingLoaded:d.recordingLoaded,relativeBurstGain:d.relativeBurstGain,postCompressorHeadroomGain:d.postCompressorHeadroomGain,loadError:d.loadError,lastArrival:clone(d.lastArrival)};}
async function audioHash(){const r=await fetch(new URL('../fireworks-audio.js',import.meta.url));if(!r.ok)throw Error('Cannot verify the locked existing firework audio module');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');}

export async function recordAdaptiveTailMotion(a,{seconds=16,seed=42}={}){
  if(!Number.isFinite(seconds)||seconds<12||seconds>30||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw RangeError('Use12..30 seconds and a uint32 seed');
  if(!a?.audio?.loaded||!a.audio.enabled||a.audio.captureActive)throw Error('Enable and load native scene sound first; another capture must not be active');
  const audioBefore=a.fireworks().audio;if(!audioBefore.recordingLoaded||!audioBefore.outputReady||audioBefore.loadError)throw Error('The native firework recording must already be loaded and ready');
  if(typeof MediaRecorder==='undefined')throw Error('Native MediaRecorder unavailable');
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Native video/audio recording codec unavailable');
  const servedAudioSHA256=await audioHash();if(servedAudioSHA256!==AUDIO_SHA256)throw Error('Firework audio source hash changed; do not record against an unverified gain/source baseline');
  const initialState=a.state,originalSmoke=a.smoke(),saved={clock:clone(a.celestial()),sun:clone(initialState.parameters.sun),lens:clone(initialState.parameters.lens),graphics:clone(initialState.parameters.graphics),camera:clone(initialState.camera),target:clone(initialState.target),paused:initialState.parameters.paused,fireworks:clone(a.fireworks().settings),director:clone(a.director()),diagnosticCameraEV:a.diagnosticCameraEV,smokeProfile:smokeProfile(originalSmoke),smokeParameters:clone(originalSmoke.events.parameters),trailIntegration:a.fireworks().tailIntegration?.requested||a.fireworks().tailIntegration?.mode||'legacy8'};
  const report={schema:'glass-atoll.adaptive-tail-motion.v1',dateUTC:new Date().toISOString(),secondsRequested:seconds,seed,type:'palm',intensityScale:1,sourceProfile:'palm-fan-burn',integration:'adaptive',cameraEV:16.5,displayTransform:'legacy',hdrMode:'sdr',flight:'ordinary near-apex/default height; no timed flight override',captureFPSRequested:30,servedAudioSHA256,mime,samples:[],stills:{},cues:[],restoration:{},limits:['Actual one-host canvas and existing stereo WebAudio mix; requested30fps capture is not measured rendererFPS.','SDR legacy presentation at fixed photographyC16.5; monitorHDR brightness is not represented.','Palm/fan uniform-burn/Taylor smoke is an explicit QA source candidate; this helper changes no application/module defaults.','One visible camera cut occurs at the first live frame at/after burst+.15s using the actual luminous centroid, then stays fixed.','Stills use actual forced SDR scene renders; they are not fabricated video frames or evidence of continuous no-flicker motion.','The prior event retires naturally before setup and QA matter is explicitly cleared; previous airborne density and physical elapsed time cannot be restored.','ExistingAudio listener scheduling/propagation and Gaussian smoke approximations remain; no microphone, gain edit or physical pressure simulation.','Missing late/cold stills are reported if wall-time recording ends before the requested physical phase.']};
  let recorder,videoStream,captureStream,combinedStream,interval,rafId,started=null,launch=null,cut=false,stopping=false,finished,finishResolve,finishReject,firstError=null;
  const chunks=[];
  const interrupted=()=>!!a.state.graphicsContextInterrupted;
  const fail=e=>{if(!firstError){firstError=e instanceof Error?e:Error(String(e));finishReject?.(firstError);}};
  async function retire(label){const deadline=performance.now()+45000;while(a.fireworks().active||a.fireworks().queued){if(interrupted())throw Error('Graphics context interrupted; reload required');if(performance.now()>deadline)throw Error(label+' events failed to retire within45 seconds');await wait(80);}}
  function snapshot(){const s=a.state,f=a.fireworks(),photo=a.photometry();return{wallSeconds:started===null?null:(performance.now()-started)/1000,time:s.time,burstAge:launch?s.time-launch.burstTime:null,camera:clone(s.camera),target:clone(s.target),paused:s.parameters.paused,clock:clone(a.celestial()),photometry:{P:photo.storageEV,C:photo.cameraEV,storedBound:photo.storedBound,safeMaximum:photo.safeMaximum},tailIntegration:clone(f.tailIntegration),field:clone(f.lightingField),smoke:compactSmoke(a.smoke()),audio:compactAudio(f.audio)};}
  function sample(){if(stopping)return;try{if(interrupted())throw Error('Graphics context interrupted during actual recording');const s=snapshot();report.samples.push(s);for(const [name,phase]of [['hot',1.1],['late',3.3],['cold',9]])if(s.burstAge>=phase&&!report.stills[name])report.stills[name]={...s,requestedBurstAge:phase,image:a.screenshot()};}catch(e){fail(e);}}
  function watch(){if(stopping)return;try{const s=a.state;if(interrupted())throw Error('Graphics context interrupted during actual recording');if(launch&&!cut&&s.time>=launch.burstTime+.15){const clusters=a.fireworkClusters(),centre=clusters[0]?.position;if(!centre){if(s.time>launch.burstTime+.35)throw Error('No actual live luminous centroid in the documented cut window');}else{if(!Array.isArray(centre)||centre.length!==3||!centre.every(Number.isFinite))throw Error('Invalid actual luminous centroid');const before={camera:clone(s.camera),target:clone(s.target)};a.setCamera(centre.map((v,i)=>v+[-48,12,-95][i]),centre);cut=true;report.cut={wallSeconds:(performance.now()-started)/1000,time:s.time,requestedBurstAge:.15,actualBurstAge:s.time-launch.burstTime,centroid:clone(centre),before,accepted:{camera:clone(a.state.camera),target:clone(a.state.target)},source:'Actual current firework cluster; no future path position or billboard'};report.cues.push({kind:'one-time-camera-cut',...report.cut});}}}catch(e){fail(e);return;}rafId=requestAnimationFrame(watch);}
  try{
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);await retire('Prior');
    a.pause(true);a.clearSmoke();report.selection=clone(a.setSmokeReviewProfile('palm-fan-burn'));
    await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('moon');await a.setTime({running:false});
    a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});
    a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);
    a.setFireworks({type:'palm',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:true});a.setFireworksTrailIntegration('adaptive');
    const canvas=document.querySelector('#scene canvas');if(!canvas?.captureStream)throw Error('Existing scene canvas cannot be captured');
    videoStream=canvas.captureStream(30);captureStream=a.captureAudio();combinedStream=new MediaStream([...videoStream.getVideoTracks(),...captureStream.getAudioTracks()]);
    if(combinedStream.getVideoTracks().length!==1||combinedStream.getAudioTracks().length<1)throw Error('Actual canvas and native audio tracks are required');
    recorder=new MediaRecorder(combinedStream,{mimeType:mime,videoBitsPerSecond:12000000,audioBitsPerSecond:160000});
    finished=new Promise((resolve,reject)=>{finishResolve=resolve;finishReject=reject;recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>fail(e.error||Error('Native MediaRecorder failed'));recorder.onstop=()=>finishResolve(new Blob(chunks,{type:mime}));});
    // Attach a rejection observer before starting any async callbacks.
    finished.catch(()=>{});
    report.initial=snapshot();report.dimensions=[canvas.width,canvas.height];report.initialTime=a.state.time;started=performance.now();recorder.start(500);
    launch=clone(a.launchFirework({type:'palm',seed,intensityScale:1}));if(!launch.accepted||launch.queued)throw Error('One immediate actual palm launch is required');report.launch=launch;report.launchPhysics=clone(a.fireworks().activeEvents.find(e=>e.id===launch.id));report.cues.push({kind:'launch',wallSeconds:(performance.now()-started)/1000,time:a.state.time,id:launch.id});
    sample();interval=setInterval(sample,250);rafId=requestAnimationFrame(watch);
    await Promise.race([wait(seconds*1000),finished.then(()=>{if(!stopping)throw Error('Recorder stopped before the requested duration');})]);
    if(firstError)throw firstError;stopping=true;clearInterval(interval);cancelAnimationFrame(rafId);sample();recorder.stop();const blob=await finished;
    report.durationSeconds=(performance.now()-started)/1000;report.bytes=blob.size;report.final=snapshot();report.missingStills=['hot','late','cold'].filter(k=>!report.stills[k]);
    if(!cut)throw Error('Recording ended without the required actual post-burst detail cut');
    if(!report.launchPhysics||report.launchPhysics.heightInfo?.flightInfo)throw Error('Ordinary near-apex flight metadata was not observed');
    report.audioGainUnchanged=report.final.audio.relativeBurstGain===report.initial.audio.relativeBurstGain&&report.final.audio.postCompressorHeadroomGain===report.initial.audio.postCompressorHeadroomGain;
    if(!report.audioGainUnchanged)throw Error('Native audio gain changed during recording');
    return{blob,report};
  }catch(e){firstError=e instanceof Error?e:Error(String(e));firstError.report=report;throw firstError;
  }finally{
    stopping=true;clearInterval(interval);cancelAnimationFrame(rafId);if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch{}}
    videoStream?.getTracks().forEach(t=>t.stop());combinedStream?.getTracks().forEach(t=>t.stop());if(captureStream)a.stopAudioCapture();
    a.setDirector({mode:'off'});a.pause(true);
    if(interrupted()){report.restoration={status:'skipped',reason:'context-interrupted-reload-required',tracksStopped:true};}
    else{
      try{
        a.setFireworks({autoLaunch:false});a.pause(false);await retire('Recorded');a.pause(true);a.clearSmoke();a.setSmokeReviewProfile(saved.smokeProfile);
        await a.setGraphics({hdrMode:saved.graphics.hdrMode,displayTransform:saved.graphics.displayTransform});a.setLens(saved.lens);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});if(saved.clock.mode==='artistic')a.setSun(saved.sun);
        a.setCamera(saved.camera,saved.target);a.setFireworks(saved.fireworks);a.setFireworksTrailIntegration(saved.trailIntegration);a.setDiagnosticCameraEV(saved.diagnosticCameraEV);
        if(saved.director.active&&saved.director.mode!=='off')a.setDirector({mode:saved.director.mode,periodSeconds:saved.director.periodSeconds});else a.setDirector({mode:'off'});
        const smokeParametersExact=JSON.stringify(a.smoke().events.parameters)===JSON.stringify(saved.smokeParameters);if(!smokeParametersExact)throw Error('Smoke profile parameter restoration mismatch');
        a.pause(saved.paused);report.restoration={status:'restored',smokeProfile:saved.smokeProfile,smokeParametersExact,trailIntegration:saved.trailIntegration,paused:a.state.parameters.paused,director:saved.director.active?'restarted selected mode from saved pose; old orbit phase is not rewindable':'off',tracksStopped:true};
      }catch(e){a.pause(true);report.restoration={status:'failed',reason:String(e.message||e),tracksStopped:true};if(!firstError)throw e;}
    }
  }
}
