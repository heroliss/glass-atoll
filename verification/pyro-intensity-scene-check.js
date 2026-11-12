// Actual production scene/API check. Caller sets the native wind control to0.
// It launches real events, lets old ones retire, and never rewinds physical time
// or overwrites P. Explicit per-shot clearSmoke is the only mass deletion.
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const clone=value=>structuredClone(value);
const norm=value=>Math.hypot(...value);
const difference=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const sourceNames=['main.js','fireworks-physics.js','fireworks.js','fireworks-audio.js','audio.js','sky.js','pyro-smoke-renderer.js','depth-copy.js'];
async function sourceHashes(){
  const entries=await Promise.all(sourceNames.map(async name=>{
    const response=await fetch(new URL('../'+name,import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error(`Source hash ${name}: HTTP${response.status}`);
    const data=await response.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',data);return[name,Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')];
  }));return Object.fromEntries(entries);
}
function audioSignature(a){const s=a.audio,p=a.fireworks().audio;return{enabled:s.enabled,relativeBurstGain:p.relativeBurstGain,postCompressorHeadroomGain:p.postCompressorHeadroomGain,compressorAttackSeconds:p.compressorAttackSeconds,recordingDuration:p.recordingDuration,source:p.source};}
function qualitySignature(s){return{quality:s.parameters.quality,qualityPreset:s.parameters.qualityPreset,renderSampling:s.parameters.renderSampling,graphics:s.parameters.graphics,renderScale:s.renderScale,
  lensWidth:s.lens.width,lensHeight:s.lens.height,outputWidth:s.lens.outputWidth,outputHeight:s.lens.outputHeight,samples:s.lens.samples,caustics:s.caustics};}
function safeRanges(ranges){return['opaque','composed','reflection'].every(key=>{const r=ranges[key];return r&&r.countNaN===0&&r.countInf===0&&r.countNegative===0&&Number.isFinite(r.globalMax)&&r.counterConsistency&&r.stateRestored;});}
function rawRanges(ranges,P){
  const scale=2**P;return Object.fromEntries(['opaque','composed','reflection'].map(key=>{const r=ranges[key];return[key,{minRGB:r.minRGB.map(v=>v===null?null:v/scale),maxRGB:r.maxRGB.map(v=>v===null?null:v/scale),globalMin:r.globalMin/scale,globalMax:r.globalMax/scale,
    note:'Level-zero HDR extrema divided by this capture storage scale; not integrated flux, illuminance, display nits or absolute calibrated radiance.'}];}));
}
async function imagePixels(url){
  const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});if(!ctx)throw new Error('2D snapshot decoder unavailable');ctx.drawImage(image,0,0);
  return{width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};
}
const linear=byte=>{const v=byte/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
async function imageDifference(off,on){
  const a=await imagePixels(off),b=await imagePixels(on);if(a.width!==b.width||a.height!==b.height)throw new Error('Cloud pair PNG dimensions differ');
  const regions={whole:[0,0,a.width,a.height],top35percent:[0,0,a.width,Math.floor(a.height*.35)],lower45percent:[0,Math.floor(a.height*.55),a.width,a.height-Math.floor(a.height*.55)]},out={};
  for(const [key,[x0,y0,w,h]]of Object.entries(regions)){
    let squared=0,changed=0,maxByte=0,meanOff=0,meanOn=0,signed=0,positive=0,negative=0;
    for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){
      const i=(y*a.width+x)*4;let deltaMax=0,yOff=0,yOn=0;for(let c=0;c<3;c++){const d=b.data[i+c]-a.data[i+c];squared+=d*d;deltaMax=Math.max(deltaMax,Math.abs(d));const weight=[.2126,.7152,.0722][c];yOff+=linear(a.data[i+c])*weight;yOn+=linear(b.data[i+c])*weight;}
      changed+=Number(deltaMax>0);maxByte=Math.max(maxByte,deltaMax);meanOff+=yOff;meanOn+=yOn;const d=yOn-yOff;signed+=d;positive+=Math.max(0,d);negative+=Math.max(0,-d);
    }
    const pixels=w*h;out[key]={rectPixels:[x0,y0,w,h],pixels,changedPixels:changed,changedFraction:changed/pixels,maximumByteDifference:maxByte,rmsByteDifference:Math.sqrt(squared/(pixels*3)),
      displayLinearMeanOff:meanOff/pixels,displayLinearMeanOn:meanOn/pixels,displayLinearSignedDelta:signed/pixels,displayLinearPositiveDelta:positive/pixels,displayLinearNegativeDelta:negative/pixels};
  }
  return{width:a.width,height:a.height,regions:out,scope:'Explicit scene SDR screenshots decoded by browser2D. Regions are screen rectangles, NOT semantic cloud/water masks. ACES, FP16 P quantization, temporal histories and 8-bit output prevent interpreting this as isolated scene-linear cloud flux. A zero PNG difference does not prove no cloud light or visibly lit clouds.'};
}

export async function runIntensitySceneCheck(a,{restoreScene=true}={}){
  const initial=clone(a.state),saved={clock:clone(a.celestial()),sun:clone(initial.parameters.sun),lens:clone(initial.parameters.lens),weather:clone(initial.parameters.weather),
    camera:[...initial.camera],target:[...initial.target],paused:initial.parameters.paused,fireworks:clone(a.fireworks().settings),night:clone(a.night().settings),director:clone(initial.parameters.director),renderScale:initial.renderScale};
  const report={schema:'glass-atoll.pyro-intensity-actual-scene.v1',date:new Date().toISOString(),checks:[],shots:[],images:{},runtimeErrors:[],restoration:{requested:!!restoreScene},
    controls:{type:'ring',pattern:'smiley',layout:'reference',seed:42,intensityScales:[1,4,16],secondsAfterActualBurst:1.1,focalMm:28,cameraEV:16.5,cameraEVTolerance:1e-8,minimumPausedSettleRAFs:45,
      storageExposure:'Per-frame combined safety bound selects P naturally; P may differ across scales and cloud toggles. No fixed-P claim.',weather:'Requested weather retained; no cloud coverage/position forged for this comparison.'}};
  const check=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,evidence});
  const onError=e=>report.runtimeErrors.push({kind:'window.error',message:e.message,stack:String(e.error?.stack||''),physicalTime:a.state.time});
  const onRejection=e=>report.runtimeErrors.push({kind:'unhandledrejection',message:String(e.reason?.message??e.reason),stack:String(e.reason?.stack||''),physicalTime:a.state.time});
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
  let fixedPose=null,quality=null,moonUTC=null;
  async function waitRetired(label){
    const start=a.state.time,wall=performance.now();a.pause(false);
    while(true){const f=a.fireworks();if(!f.active&&!f.queued)return{label,physicalSeconds:a.state.time-start,wallSeconds:(performance.now()-wall)/1000};
      if(a.state.time-start>90||performance.now()-wall>150000)throw new Error(`${label}: old active/queued events did not naturally retire within90physical/150wall seconds; none deleted`);await delay(100);}
  }
  async function settle(){
    for(let i=0;i<45;i++)await raf();let extra=0;
    // A rising safe P may adapt gradually. Wait for its natural target so an
    // asynchronous range read cannot mix images stored at two exposure scales.
    while(Math.abs(a.photometry().storageEV-a.photometry().targetEV)>1e-10&&extra<420){await raf();extra++;}
    if(Math.abs(a.photometry().storageEV-a.photometry().targetEV)>1e-10)throw new Error('Natural storage exposure did not settle to its safety target; P was not overwritten');
    return{minimumRAFs:45,extraPAdaptationRAFs:extra};
  }
  async function captureVariant(shot,enabled){
    a.setFireworks({cloudIllumination:enabled});const settling=await settle(),before=a.photometry(),id=`scale${shot.intensityScale}_cloud_${enabled?'on':'off'}`;
    const image=a.screenshot(),imageState=clone(a.state),imageP=clone(a.photometry()),ranges=await a.inspectRadiance(),after=clone(a.photometry());
    const physical=clone(a.smokeSnapshot()),fireworks=clone(a.fireworks()),atmosphere=clone(a.atmosphere()),clusters=clone(a.fireworkClusters()),volume=clone(a.smoke());
    const variant={id,enabled,settling,time:imageState.time,actualPhaseSeconds:imageState.time-shot.launch.burstTime,photometry:imageP,rangePhotometry:clone(ranges.photometry),
      sourceHDRRanges:ranges,rawCompensatedRanges:rawRanges(ranges,imageP.storageEV),clusters,lighting:clone(a.localLights()),atmosphere,volume,physicalSmoke:physical,fireworks,
      camera:imageState.camera,target:imageState.target,lens:imageState.lens,quality:qualitySignature(imageState),UTC:a.celestial().utcMs,audio:audioSignature(a)};
    report.images[id]=image;shot.variants[enabled?'on':'off']=variant;
    check(`${id}: exact paused phase, frozen UTC and measured calm wind`,imageState.parameters.paused&&Math.abs(variant.actualPhaseSeconds-1.1)<1e-8&&variant.UTC===moonUTC&&Math.abs(imageState.parameters.wind)<1e-12&&norm(physical.currentWind)<1e-4,{time:variant.time,actualPhaseSeconds:variant.actualPhaseSeconds,utcMs:variant.UTC,currentWind:physical.currentWind});
    check(`${id}: same explicit pose,28mm and disabled DOF/flare`,difference(variant.camera,fixedPose.camera)<1e-8&&difference(variant.target,fixedPose.target)<1e-8&&imageState.lens.focalMm===28&&!imageState.parameters.lens.dof&&!imageState.parameters.lens.opticalFlare,{camera:variant.camera,target:variant.target,focalMm:imageState.lens.focalMm});
    check(`${id}: camera exposure naturally equals16.5EV`,Math.abs(imageP.cameraEV-16.5)<=1e-8,{C:imageP.cameraEV,P:imageP.storageEV,outputExposureScale:imageP.outputExposureScale});
    check(`${id}: stable capture storage scale and correct output compensation`,[before.storageEV,ranges.storageEV,ranges.photometry.storageEV,after.storageEV].every(P=>Math.abs(P-imageP.storageEV)<1e-10)&&Math.abs(imageP.outputExposureScale/(.76*2**(imageP.cameraEV-imageP.storageEV))-1)<1e-12,{beforeP:before.storageEV,imageP:imageP.storageEV,lensRangeP:ranges.storageEV,rangeP:ranges.photometry.storageEV,afterP:after.storageEV});
    const maxima=Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,ranges[k].globalMax]));
    check(`${id}: actual main and mirror HDR finite and nonnegative`,safeRanges(ranges),{maxima});
    check(`${id}: combined declared and actual FP16 headroom`,imageP.storedBound<=imageP.safeMaximum*(1+1e-12)&&Object.values(maxima).every(v=>v<65504&&v<=imageP.safeMaximum*(1+1e-4)),{storedBound:imageP.storedBound,safeMaximum:imageP.safeMaximum,maxima});
    const event=fireworks.activeEvents.find(e=>e.id===shot.launch.id);
    check(`${id}: source actualScale/layout/count and unchanged quality`,event?.intensityScale===shot.intensityScale&&event?.smileyLayout==='reference'&&event?.actualStarCount===120&&JSON.stringify(variant.quality)===JSON.stringify(quality),{event,quality:variant.quality});
    check(`${id}: real cloud control reaches raw source uniforms`,atmosphere.diagnostics.transientClouds.count===(enabled?clusters.length:0)&&(enabled?atmosphere.diagnostics.transientClouds.rawRadianceBound>0:atmosphere.diagnostics.transientClouds.rawRadianceBound===0),atmosphere.diagnostics.transientClouds);
    check(`${id}: real persistent volume has a main draw`,volume.state.packetCount>0&&volume.rendering.lastRender?.reflection===false&&volume.rendering.lastRender.instances>0,{packetCount:volume.state.packetCount,lastRender:volume.rendering.lastRender});
    return variant;
  }
  try{
    for(const key of ['pauseAtPhysicalTime','fireworkClusters','launchFirework','clearSmoke','inspectRadiance','screenshot'])if(typeof a[key]!=='function')throw new Error(`Missing actual-scene API ${key}; reload main with the QA hooks, do not approximate event birth time`);
    if(Math.abs(initial.parameters.wind)>1e-12)throw new Error('Set the native wind control to0 before this helper; QA does not forge effective wind');
    report.sourceSHA256Before=await sourceHashes();report.audioBefore=audioSignature(a);report.weatherBefore=clone(a.atmosphere().diagnostics.weather);report.original={physicalTime:initial.time,UTC:saved.clock.utcMs,camera:saved.camera,target:saved.target,paused:saved.paused};
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const windStart=a.state.time,windWall=performance.now();while(norm(a.smokeSnapshot().currentWind)>=1e-4){
      if(a.state.time-windStart>20||performance.now()-windWall>45000)throw new Error('Effective smoke wind failed to reach norm<1e-4 within20physical/45wall seconds');await delay(80);
    }
    report.windSettling={physicalSeconds:a.state.time-windStart,wallSeconds:(performance.now()-windWall)/1000,currentWind:clone(a.smokeSnapshot().currentWind),norm:norm(a.smokeSnapshot().currentWind)};
    check('native0 wind settles within the physical20second bound',report.windSettling.norm<1e-4&&report.windSettling.physicalSeconds<=20,report.windSettling);
    report.initialRetirement=await waitRetired('initial events');a.pause(true);
    const current=a.celestial();report.appliedMoonPreset=!(current.mode==='astronomical'&&current.sun.altitudeDeg<-6&&current.moon.altitudeDeg>0);
    if(report.appliedMoonPreset)await a.timePreset('moon');await a.setTime({running:false});moonUTC=a.celestial().utcMs;await a.setNight({autoExposure:true});
    if(a.localLights().flashlight.enabled)throw new Error('The user flashlight caps cameraEV at16; disable it natively before the16.5EV comparison. QA does not change scene lamps');
    a.setLens({focal:28,exposure:0,dof:false,opticalFlare:false,automatic:false});a.setRenderScale(saved.renderScale);a.setCamera([-48,12,-40],[0,2.5,0]);
    a.setFireworks({type:'ring',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,persistentSmoke:true,cloudIllumination:true,intensityScale:1});
    await settle();await a.inspectRadiance(); // warm the existing diagnostic import before timed shots
    for(const intensityScale of [1,4,16]){
      const shot={intensityScale,seed:42,variants:{}};report.shots.push(shot);
      if(intensityScale!==1){shot.priorRetirement=await waitRetired(`before scale${intensityScale}`);a.pause(true);a.setCamera(fixedPose.camera,fixedPose.target);}
      a.setFireworks({intensityScale,autoFrame:intensityScale===1,cloudIllumination:true});a.clearSmoke();shot.smokeAfterExplicitClear=clone(a.smoke());
      shot.launch=a.launchFirework({type:'ring',seed:42,smileyLayout:'reference',intensityScale});
      if(!shot.launch?.accepted||shot.launch.queued)throw new Error(`Scale${intensityScale}: event did not launch immediately after natural retirement`);
      shot.targetPhysicalTime=shot.launch.burstTime+1.1;shot.pauseRequest=a.pauseAtPhysicalTime(shot.targetPhysicalTime);const wall=performance.now();
      while(!a.state.parameters.paused||a.state.time<shot.targetPhysicalTime-1e-8){if(performance.now()-wall>30000)throw new Error(`Scale${intensityScale}: exact physical pause hook timed out`);await raf();}
      if(Math.abs(a.state.time-shot.targetPhysicalTime)>1e-8)throw new Error(`Scale${intensityScale}: exact pause missed target by${a.state.time-shot.targetPhysicalTime}s`);
      shot.initialSettle=await settle();
      if(!fixedPose){fixedPose={camera:[...a.state.camera],target:[...a.state.target]};report.fixedPose=clone(fixedPose);a.setFireworks({autoFrame:false});a.setCamera(fixedPose.camera,fixedPose.target);await settle();quality=qualitySignature(a.state);report.fixedQuality=clone(quality);}
      shot.windAtBurstPhase=clone(a.smokeSnapshot().currentWind);await captureVariant(shot,false);await captureVariant(shot,true);
      shot.cloudDisplayDifference=await imageDifference(report.images[shot.variants.off.id],report.images[shot.variants.on.id]);
      check(`scale${intensityScale}: cloud pair leaves physical density and source clusters unchanged`,JSON.stringify(shot.variants.off.physicalSmoke)===JSON.stringify(shot.variants.on.physicalSmoke)&&JSON.stringify(shot.variants.off.clusters)===JSON.stringify(shot.variants.on.clusters),{offTime:shot.variants.off.time,onTime:shot.variants.on.time,changedScreenPixels:shot.cloudDisplayDifference.regions.whole.changedPixels});
    }
    const first=report.shots[0].variants.on,baseI=first.clusters.reduce((s,c)=>s+c.referenceCandela,0);
    report.crossScale=report.shots.map(shot=>{const v=shot.variants.on,I=v.clusters.reduce((s,c)=>s+c.referenceCandela,0);return{scale:shot.intensityScale,physicalTime:v.time,actualPhaseSeconds:v.actualPhaseSeconds,C:v.photometry.cameraEV,P:v.photometry.storageEV,
      clusterReferenceCandela:I,referenceCandelaRatio:I/baseI,expectedRatio:shot.intensityScale,clusterCentroidMetres:v.clusters[0]?.position,centroidDifferenceFromScale1Metres:v.clusters[0]?difference(v.clusters[0].position,first.clusters[0].position):null,
      mainStoredPeak:v.sourceHDRRanges.composed.globalMax,mainRawPeak:v.rawCompensatedRanges.composed.globalMax,mirrorStoredPeak:v.sourceHDRRanges.reflection.globalMax,mirrorRawPeak:v.rawCompensatedRanges.reflection.globalMax,wind:shot.windAtBurstPhase};});
    check('raw reference source intensity follows1/4/16 at the same burst phase',baseI>0&&report.crossScale.every(s=>Math.abs(s.referenceCandelaRatio/s.expectedRatio-1)<1e-10),{comparison:report.crossScale});
    report.sourceSHA256After=await sourceHashes();report.audioAfter=audioSignature(a);
    check('production source files and audio gain configuration remain unchanged',JSON.stringify(report.sourceSHA256Before)===JSON.stringify(report.sourceSHA256After)&&JSON.stringify(report.audioBefore)===JSON.stringify(report.audioAfter),{audioBefore:report.audioBefore,audioAfter:report.audioAfter});
    check('requested weather is retained and no scene callback exceptions occur',JSON.stringify(a.state.parameters.weather)===JSON.stringify(saved.weather)&&report.runtimeErrors.length===0,{requestedWeather:a.state.parameters.weather,runtimeErrors:report.runtimeErrors});
  }catch(error){report.failure={message:String(error.message??error),stack:String(error.stack??'')};check('actual scenario completes without a hidden fallback',false,report.failure);}
  finally{
    a.pause(true);
    if(restoreScene){
      try{
        a.setDirector({mode:'off'});a.setLens(saved.lens);a.setRenderScale(saved.renderScale);if(JSON.stringify(a.state.parameters.weather)!==JSON.stringify(saved.weather))a.setWeather(saved.weather);
        await a.setNight({autoExposure:saved.night.autoExposure});await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running,timeZoneOffsetMinutes:saved.clock.timeZoneOffsetMinutes,refraction:saved.clock.refraction});
        if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.setCamera(saved.camera,saved.target);a.setFireworks(saved.fireworks);
        if(saved.director.mode!=='off')a.setDirector(saved.director);a.pause(saved.paused);
        report.restoration={...report.restoration,completed:true,physicalTime:a.state.time,remainingActive:a.fireworks().active,remainingQueued:a.fireworks().queued,UTC:a.celestial().utcMs,requestedWeather:clone(a.state.parameters.weather),paused:a.state.parameters.paused};
        check('user UTC/weather/lens/camera/firework settings and pause preference restored',a.celestial().utcMs===saved.clock.utcMs&&JSON.stringify(a.state.parameters.weather)===JSON.stringify(saved.weather)&&JSON.stringify(a.state.parameters.lens)===JSON.stringify(saved.lens)&&difference(a.state.camera,saved.camera)<1e-8&&difference(a.state.target,saved.target)<1e-8&&JSON.stringify(a.fireworks().settings)===JSON.stringify(saved.fireworks)&&a.state.parameters.paused===saved.paused,{restoration:report.restoration});
      }catch(error){report.restoration.error=String(error.stack??error);check('user scene restoration completes',false,{error:report.restoration.error});}
    }else report.restoration={...report.restoration,completed:false,leftPaused:true,remainingActive:a.fireworks().active,remainingQueued:a.fireworks().queued};
    window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);
  }
  report.passed=report.checks.every(c=>c.passed)&&report.shots.length===3;report.passedCount=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;
  report.limits=['Actual scene screenshots and complete main/mirror level-zero HDR ranges; not absolute candela/lux/SPL/display-nits calibration or FPS acceptance.',
    'Each off/on cloud pair is at exactly the same physical phase, density, camera and frozen UTC. Physical world time advances between shots: sea/SWE and cloud morphology are NOT the same spacetime snapshot across1/4/16.',
    'Natural combined P may differ; raw-compensated extrema are not integrated flux. Fixed photographicC is checked separately at16.5EV within1e-8.',
    'Current weather is retained; clouds may be absent from the view or the actual cloud delta may fall below SDR8-bit precision. A zero/small difference is not a passed visible-cloud-illumination gate.',
    'Source files are fetched and hashed as served bytes, not a claim that arbitrary preloaded ESM cache is attested. Caller reloads the frozen runtime before invoking.',
    'Explicit clearSmoke removes prior smoke before each shot. Physical time and old mass are not rolled back; no active event is deleted. Last shot may still be naturally burning after restoration.',
    'Native wind target must already be0; residual norm<1e-4 is measured, not forced to exact0. Any cross-shot source-centroid residual is reported.',
    'An active saved director restarts its mode/entry when restored; no public API restores its prior internal orbit phase. QA does not change audio gain, though real launch/burst playback counters may advance.'];
  return report;
}
