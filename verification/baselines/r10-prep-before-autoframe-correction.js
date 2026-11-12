// QA setup only. Caller owns the live renderer/window and the subsequent8s
// benchmark. No query, drawing, canvas resize, source edits or FPS measurement.
const clone=v=>structuredClone(v);
const POSE=Object.freeze({camera:Object.freeze([-155.371,12,-119.478]),target:Object.freeze([34.054,73.929,20.738])});
const maxError=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
function frame(deadline){return new Promise((resolve,reject)=>{const wait=Math.min(5000,deadline-performance.now());if(!(wait>0)){reject(new Error('Preparation wall deadline exceeded'));return;}let id;const timer=setTimeout(()=>{cancelAnimationFrame(id);reject(new Error('Preparation rAF timed out; no hidden-tab synthetic clock advance'));},wait);id=requestAnimationFrame(()=>{clearTimeout(timer);resolve();});});}

/** Fresh empty caller window must already be native1920x1080. Leaves the two
 * real events/smoke paused at maxburst+.1, warmed fast route, for the existing
 * runSmokeTransmissionScenePerformance. Preferences/time are intentionally not
 * restored: this function prepares a documented fixture, never rewinds events.
 */
export async function prepareTransmissionBenchmark(a){
 const report={schema:'glass-atoll.r10-prepare-transmission-benchmark.v1',dateUTC:new Date().toISOString(),ready:false,actualScene:true,measuresFPS:false,headSource:'adaptive',launches:[],warmups:[],limits:[
  'QA setup only; no GPU timers, render FPS or performance-gain claim.',
  'Caller supplies the actual native1920x1080 window/context and owns later8s observer; no qaRenderLock during rAF setup.',
  'Sound is not changed: publicAPI has no sound-enable setter. Actual sound settings are recorded; caller may enable it natively before setup.',
  'Physics/events/matter cannot be rewound. Success leaves the fixture paused; failure also pauses and preserves any real events already launched.',
  'R9 dense source-field configuration may differ; do not compare it as an isolated before/after FPS gain.'
 ]},deadline=performance.now()+60000;
 try{
  for(const k of ['pause','state','fireworks','smoke','smokeSnapshot','setQuality','setRenderScale','setGraphics','setLens','setDirector','timePreset','setTime','setNight','setDiagnosticCameraEV','setSmokeReviewProfile','setFireworks','setCamera','launchFirework','pauseAtPhysicalTime','setSmokeTransmissionMode','photometry','celestial'])assert(k==='state'?a?.state?.ready:typeof a?.[k]==='function','Missing ready actual API '+k);
  const initial=a.state,fw=a.fireworks(),smoke=a.smoke(),matter=a.smokeSnapshot();
  report.initial={state:clone(initial),fireworks:clone(fw),smoke:clone(smoke),diagnosticCameraEV:a.diagnosticCameraEV,sound:clone(a.audio??null)};
  assert(!initial.graphicsContextInterrupted,'Reload an interrupted graphics context');
  assert(fw.active===0&&fw.queued===0&&!fw.settings?.autoLaunch,'Use a fresh scene with no active/queued/automatic fireworks');
  assert(matter.packets.length===0&&matter.pendingEmissions===0&&(smoke.events?.reservedArea??0)===0&&!smoke.events?.fault,'Use empty smoke with no pending/reserved matter; setup does not erase old sources');
  assert(fw.tailIntegration?.requested==='adaptive','Reload the application adaptive default; setup does not silently repair an old runtime');
  assert(initial.lens.outputWidth===1920&&initial.lens.outputHeight===1080,'Caller must supply the actual1920x1080 output window before this helper');
  assert(Math.abs(initial.parameters.wind-1.8)<1e-12,'Use the native default1.8m/s wind before this reproducible fixture');
  if(typeof a.readGLErrors==='function'){report.entryGL=a.readGLErrors('r10-transmission-prepare-entry');assert(report.entryGL.errors.length===0,'Entry GL errors are recorded; reload/diagnose before preparing');}
  a.pause(true);a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});
  a.setQuality('medium');a.setLens({automatic:false,focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});a.setRenderScale(1);
  await a.setGraphics({hdrMode:'sdr',hdr:false,displayTransform:'legacy'});
  await a.timePreset('moon');await a.setTime({running:false});await a.setNight({autoExposure:true});
  const utc=a.celestial().utcMs;report.frozenMoonUTC=utc;
  assert(utc===Date.parse('2026-10-26T14:00:00Z'),'Loaded Moon preset did not select the documented UTC');
  a.setDiagnosticCameraEV(16.5);
  report.productionProfile=a.setSmokeReviewProfile('production');
  a.setFireworks({type:'chrysanthemum',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:false});
  a.setCamera([...POSE.camera],[...POSE.target]);
  // Both calls are in one JS turn; no rAF/physics tick separates their births.
  for(const seed of [42,43]){const launch=a.launchFirework({type:'chrysanthemum',seed,intensityScale:1});report.launches.push({...clone(launch),declaredSeed:seed});assert(launch?.accepted&&!launch.queued&&launch.actualStarCount===192,'Both real192-head events must launch immediately');}
  report.burstTime=Math.max(...report.launches.map(e=>e.burstTime));
  assert(report.launches.every(e=>e.burstTime===report.burstTime),'Both events must have the same actual burst clock');
  // Launch autoFrame actually ran; the benchmark then uses the documented
  // manual shore pose, which takes control before the next physical frame.
  a.setCamera([...POSE.camera],[...POSE.target]);report.autoFrameThenManualShorePose=true;
  report.pauseTarget=report.burstTime+.1;a.pauseAtPhysicalTime(report.pauseTarget);a.pause(false);
  while(!a.state.parameters.paused){await frame(deadline);assert(!a.state.graphicsContextInterrupted,'Context interrupted during fixture flight');}
  assert(Math.abs(a.state.time-report.pauseTarget)<1e-8,'Actual exact pause target was not reached');
  report.phaseBeforeRebudget={time:a.state.time,photometry:clone(a.photometry())};
  // Same-C public rebudget at a new exact pause phase; never writes storageP.
  a.setDiagnosticCameraEV(16.5);report.phaseAfterRebudget={time:a.state.time,photometry:clone(a.photometry())};
  for(const mode of ['legacy','fast']){
   a.setSmokeTransmissionMode(mode,{resetHistory:true});const start=performance.now();
   for(let i=0;i<36;i++){await frame(deadline);const s=a.state;assert(s.parameters.paused&&Math.abs(s.time-report.pauseTarget)<1e-8,'Warmup changed the paused physical phase');assert(a.smokeTransmissionMode===mode,'Warmup route echo mismatch');assert(!s.graphicsContextInterrupted,'Context interrupted during route warmup');}
   const f=a.fireworks();assert(f.tailIntegration?.requested==='adaptive','Underlying tail integration changed during transmission warmup');
   report.warmups.push({mode,rAFs:36,wallMilliseconds:performance.now()-start,routeEcho:a.smokeTransmissionMode,time:a.state.time,photometry:clone(a.photometry()),tailIntegration:clone(f.tailIntegration)});
  }
  const s=a.state,f=a.fireworks(),p=a.photometry(),d=a.smoke();
  assert(s.lens.width===1920&&s.lens.height===1080&&s.lens.outputWidth===1920&&s.lens.outputHeight===1080&&s.renderScale===1,'Actual renderer must remain native1920x1080/q1');
  assert(s.parameters.qualityPreset==='medium'&&s.lens.samples===8&&s.parameters.renderSampling.shadowSize===4096&&s.parameters.renderSampling.waveResolution===512,'Actual medium resources do not match the declared fixture');
  assert(!s.parameters.lens.automatic&&!s.parameters.lens.dof&&s.lens.focalMm===28&&s.parameters.lens.opticalBloom&&!s.parameters.lens.opticalFlare,'Lens/automatic-resolution configuration changed');
  assert(s.parameters.graphics.displayTransform==='legacy'&&s.parameters.graphics.hdrMode==='sdr'&&!s.lens.hdr.enabled,'Actual output is not SDRlegacy');
  assert(a.diagnosticCameraEV===16.5&&Math.abs(p.cameraEV-16.5)<1e-8,'Actual photographyC must remain16.5EV');
  assert(maxError(s.camera,POSE.camera)<1e-8&&maxError(s.target,POSE.target)<1e-8,'AutoFrame or another controller displaced the fixed shore pose');
  assert(a.celestial().utcMs===utc,'Astronomical UTC was not frozen');
  assert(f.active===2&&f.queued===0&&f.activeEvents.every(e=>e.type==='chrysanthemum'&&e.actualStarCount===192&&e.intensityScale===1),'Prepared real source pair changed');
  assert(f.settings.persistentSmoke&&f.settings.cloudIllumination&&f.settings.resolvedSmokeLighting===false,'Persistent/cloud must be on and resolvedSmokeLighting explicitly off');
  const params=d.events.parameters;
  assert(d.sourceModel==='trajectory-v1'&&(d.events.kernelModel??'point')==='point'&&params.centralFraction===.2&&params.trajectorySlots===12&&(params.emissionProfile??'two-births')==='two-births'&&(d.state.dispersion?.model??'brownian')==='brownian','Actual smoke is not the production point/.2/12/two-births/Brownian profile');
  report.setup={state:clone(s),fireworks:clone(f),smoke:clone(d),photometry:clone(p),clock:clone(a.celestial()),sound:clone(a.audio??null),route:a.smokeTransmissionMode,camera:clone(s.camera),target:clone(s.target),actualPhaseSeconds:s.time-report.burstTime};
  if(typeof a.readGLErrors==='function'){report.preparedGL=a.readGLErrors('r10-transmission-prepared');assert(report.preparedGL.errors.length===0,'Prepared GL errors are recorded, not ignored');}
  report.ready=true;return report;
 }catch(error){report.error=String(error.stack||error);try{a?.pause?.(true);report.failureState=clone(a?.state);}catch{}return report;}
}
