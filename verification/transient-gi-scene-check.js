// Actual-scene local-only GI A/B. Caller sets native wind0 and native GI low/high.
// Does not edit source files, delete active events, clear smoke, or override P.
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const clone=x=>structuredClone(x);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const norm=a=>Math.hypot(...a);
const near=(a,b,t=1e-12)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b));
const rangesFinite=r=>['opaque','composed','reflection'].every(k=>r[k]&&r[k].countNaN===0&&r[k].countInf===0&&r[k].countNegative===0&&r[k].stateRestored&&r[k].counterConsistency&&Number.isFinite(r[k].globalMax));
const basePower=gi=>({directReflectedPower:gi.directReflectedPower,secondBounceReflectedPower:gi.secondBounceReflectedPower,quality:gi.quality,bounces:gi.bounces,geometry:gi.geometry});
const rawSources=lights=>lights.lights.map(l=>({id:l.id,type:l.type,position:l.position,direction:l.direction,candela:l.candela,rawRGB:l.rawRGB,radius:l.radius}));
const quality=s=>({graphics:s.parameters.graphics,quality:s.parameters.quality,preset:s.parameters.qualityPreset,sampling:s.parameters.renderSampling,renderScale:s.renderScale,dimensions:[s.lens.width,s.lens.height,s.lens.outputWidth,s.lens.outputHeight],samples:s.lens.samples,caustics:s.caustics});
async function decode(url){const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});if(!ctx)throw new Error('2D PNG decoder unavailable');ctx.drawImage(image,0,0);return{width:c.width,height:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};}
async function comparePNGs(a,b){
  const x=await decode(a),y=await decode(b);if(x.width!==y.width||x.height!==y.height)throw new Error('GI PNG dimensions changed');let changed=0,max=0,squared=0,positive=0,negative=0;
  for(let i=0;i<x.data.length;i+=4){let d=0;for(let c=0;c<3;c++){const delta=y.data[i+c]-x.data[i+c];d=Math.max(d,Math.abs(delta));squared+=delta*delta;positive+=Math.max(0,delta);negative+=Math.max(0,-delta);}changed+=Number(d>0);max=Math.max(max,d);}
  return{width:x.width,height:x.height,changedPixels:changed,changedFraction:changed/(x.width*x.height),maximumByteDifference:max,rmsByteDifference:Math.sqrt(squared/(x.width*x.height*3)),positiveByteSum:positive,negativeByteSum:negative,
    scope:'Actual SDR scene PNG, all pixels. Not a semantic receiver mask or a calibrated linear-radiance/energy measurement; no image processing beyond decoding and differences.'};
}
function rawExtrema(ranges,P){return Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,{minRGB:ranges[k].minRGB.map(v=>v===null?null:v/2**P),maxRGB:ranges[k].maxRGB.map(v=>v===null?null:v/2**P),globalMax:ranges[k].globalMax/2**P}]));}
function publishedProbes(a){
  if(typeof a.indirectProbeState!=='function')return{available:false,reason:'Optional read-only API not present in this loaded main'};
  const value=clone(a.indirectProbeState()),bits={};
  for(const key of ['red','green','blue'])bits[key]=Array.from(new Uint32Array(Float32Array.from(value[key]).buffer));
  return{available:true,...value,float32Bits:bits,physicalTime:a.state.time,scope:'Published raw SH coefficients as supplied to shader uniforms, plus separate exposure multiplier. Not a per-pixel HDR readback or private base target.'};
}
function historyState(a){const l=clone(a.state.lens);return{storageEV:l.storageEV,historyEV:l.historyEV,dynamicLighting:l.dynamicLighting,temporal:l.temporal};}
function compareProbes(a,b){
  if(!a?.available||!b?.available)return{available:false};const rows=[];let maximumAbsoluteDifference=0,count=0;
  for(const key of ['red','green','blue'])for(let i=0;i<a[key].length;i++)if(a.float32Bits[key][i]!==b.float32Bits[key][i]){const absoluteDifference=Math.abs(a[key][i]-b[key][i]);maximumAbsoluteDifference=Math.max(maximumAbsoluteDifference,absoluteDifference);count++;if(rows.length<24)rows.push({channel:key,index:i,before:a[key][i],after:b[key][i],beforeBits:a.float32Bits[key][i],afterBits:b.float32Bits[key][i],absoluteDifference});}
  return{available:true,identicalPublishedFloat32:count===0,differentCoefficients:count,maximumAbsoluteDifference,exposureBefore:a.exposure,exposureAfter:b.exposure,sameExposure:a.exposure===b.exposure,enabledBefore:a.enabled,enabledAfter:b.enabled,firstDifferences:rows};
}

export async function runTransientGISceneCheck(a,{restoreScene=true,intensityScale,receiverView=false}={}){
  const initial=clone(a.state),originalGI=clone(a.graphics().indirect),saved={clock:clone(a.celestial()),sun:clone(initial.parameters.sun),lens:clone(initial.parameters.lens),weather:clone(initial.parameters.weather),
    camera:[...initial.camera],target:[...initial.target],paused:initial.parameters.paused,fireworks:clone(a.fireworks().settings),autoExposure:a.night().settings.autoExposure,renderScale:initial.renderScale,director:clone(initial.parameters.director),
    transient:originalGI.transient.requestedEnabled};
  const report={schema:'glass-atoll.transient-gi-actual-scene.v3-probe-observation',date:new Date().toISOString(),checks:[],cases:[],images:{},views:{},runtimeErrors:[],restoration:{requested:restoreScene},
    controls:{seed:42,type:'ring',burstPhaseSeconds:1.1,C:16.5,cameraExposureTolerance:1e-8,focalMm:28,P:'naturally selected from the full current raw envelope; allowed to differ',toggle:'all6 local one-hop sources only; native GI remains at its original low/high mode'}};
  const check=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,evidence});
  const error=e=>report.runtimeErrors.push({kind:'error',message:e.message,stack:String(e.error?.stack||''),time:a.state.time});
  const rejection=e=>report.runtimeErrors.push({kind:'unhandledrejection',message:String(e.reason?.message??e.reason),time:a.state.time});
  window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);
  let fixed=null,qualityFixed=null,target=null,moonUTC=null,view='face';
  async function settle(){for(let i=0;i<45;i++)await raf();let extra=0;while(Math.abs(a.photometry().storageEV-a.photometry().targetEV)>1e-10&&extra++<420)await raf();if(Math.abs(a.photometry().storageEV-a.photometry().targetEV)>1e-10)throw new Error('Natural P did not reach its safety target');return{minimumRAFs:45,extraPAdaptationRAFs:extra};}
  async function capture(id,enabled,{toggle=true}={}){
    const immediate=toggle?a.setTransientIndirect(enabled):null;report.toggleCalls??=[];report.toggleCalls.push({id,enabled,toggleCalled:toggle,time:a.state.time,immediate:clone(immediate)});
    const settling=await settle(),p=clone(a.photometry()),s=clone(a.state),probeBefore=publishedProbes(a),historyBefore=historyState(a),image=a.screenshot(),probeAfterScreenshot=publishedProbes(a),historyAfterScreenshot=historyState(a),range=await a.inspectRadiance(),after=clone(a.photometry()),gi=clone(a.graphics().indirect),probeAfterRange=publishedProbes(a),historyAfterRange=historyState(a);
    const row={id,view,enabled,toggleCalled:toggle,immediate:clone(immediate),time:s.time,phase:s.time-report.launch.burstTime,camera:s.camera,target:s.target,UTC:a.celestial().utcMs,photometry:p,afterPhotometry:after,range,rawExtrema:rawExtrema(range,p.storageEV),
      GI:gi,basePower:basePower(gi),clusters:clone(a.fireworkClusters()),directSources:rawSources(a.localLights()),atmosphere:clone(a.atmosphere()),smoke:clone(a.smoke()),smokeSnapshot:clone(a.smokeSnapshot()),fireworks:clone(a.fireworks()),lens:s.lens,quality:quality(s),settling,
      indirectProbeState:probeBefore,probeObservation:{beforeScreenshot:probeBefore,afterScreenshot:probeAfterScreenshot,afterRange:probeAfterRange,duringScreenshot:compareProbes(probeBefore,probeAfterScreenshot),duringRange:compareProbes(probeAfterScreenshot,probeAfterRange)},historyObservation:{beforeScreenshot:historyBefore,afterScreenshot:historyAfterScreenshot,afterRange:historyAfterRange}};
    const first=report.cases.find(c=>c.view===view);report.cases.push(row);report.images[id]=image;
    check(`${id}: exact phase,pose,UTC and photographicC`,s.parameters.paused&&Math.abs(s.time-target)<1e-8&&distance(s.camera,fixed.camera)<1e-8&&distance(s.target,fixed.target)<1e-8&&row.UTC===moonUTC&&Math.abs(p.cameraEV-16.5)<1e-8,{phase:row.phase,C:p.cameraEV,P:p.storageEV,time:s.time});
    check(`${id}: real main/composed/mirror HDR finite and nonnegative`,rangesFinite(range),{maxima:Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,range[k].globalMax]))});
    check(`${id}: full raw indirect budget is selected before safe storageP`,Object.hasOwn(p.components,'indirect')&&Number.isFinite(p.components.indirect)&&p.components.indirect>=0&&p.storedBound<=p.safeMaximum*(1+1e-12)&&['opaque','composed','reflection'].every(k=>range[k].globalMax<=p.safeMaximum*(1+1e-4)&&range[k].globalMax<65504),{components:p.components,storedBound:p.storedBound,safeMaximum:p.safeMaximum});
    check(`${id}: stable P for screenshot/ranges with one display compensation`,[range.storageEV,range.photometry.storageEV,after.storageEV].every(P=>near(P,p.storageEV,1e-10))&&near(p.outputExposureScale,.76*2**(p.cameraEV-p.storageEV),1e-12),{P:p.storageEV,lensRangeP:range.storageEV,rangeP:range.photometry.storageEV,afterP:after.storageEV,C:p.cameraEV});
    check(`${id}: actual requested localGI branch and current frame are live`,gi.ready&&gi.quality===originalGI.quality&&gi.transient.enabled===enabled&&gi.transient.requestedEnabled===enabled&&near(gi.transient.physicalTime,target,1e-12)&&gi.extraSamplers===0&&gi.uniformVectors===originalGI.uniformVectors,{transient:gi.transient,quality:gi.quality});
    check(`${id}: native quality,sourcegain,cloudflag and smokeflag remain fixed`,same(row.quality,qualityFixed)&&row.fireworks.activeEvents.some(e=>e.id===report.launch.id&&e.intensityScale===report.intensityScale)&&row.fireworks.settings.cloudIllumination===saved.fireworks.cloudIllumination&&row.fireworks.settings.persistentSmoke===saved.fireworks.persistentSmoke,{quality:row.quality,activeEvents:row.fireworks.activeEvents});
    if(first)check(`${id}: density,raw sourceI/direct lights and cloud state are unchanged`,same(row.smokeSnapshot,first.smokeSnapshot)&&same(row.clusters,first.clusters)&&same(row.directSources,first.directSources)&&same(row.atmosphere.diagnostics.weather,first.atmosphere.diagnostics.weather)&&same(row.atmosphere.diagnostics.transientClouds,first.atmosphere.diagnostics.transientClouds),{packets:row.smoke.state.packetCount,clusters:row.clusters,cloudTransient:row.atmosphere.diagnostics.transientClouds});
    return row;
  }
  async function captureView(){
    const prefix=view==='face'?'localGI':'receiver_localGI',off=await capture(prefix+'_off',false),repeat1=await capture(prefix+'_off_repeat1',false,{toggle:false}),repeat2=await capture(prefix+'_off_repeat2',false,{toggle:false}),on=await capture(prefix+'_on',true),cleared=await capture(prefix+'_cleared',false);
    const pairs=[[off,repeat1],[repeat1,repeat2],[off,repeat2]],floor=[];
    for(const [x,y]of pairs)floor.push({from:x.id,to:y.id,difference:await comparePNGs(report.images[x.id],report.images[y.id])});
    const visibleDifference=await comparePNGs(report.images[off.id],report.images[on.id]),clearDifference=await comparePNGs(report.images[off.id],report.images[cleared.id]);
    const repeatFloor={pairs:floor,maximumChangedPixels:Math.max(...floor.map(x=>x.difference.changedPixels)),maximumByteDifference:Math.max(...floor.map(x=>x.difference.maximumByteDifference)),maximumRMSByteDifference:Math.max(...floor.map(x=>x.difference.rmsByteDifference)),
      scope:'Three independently exported off images, with no intervening GI toggle for repeats. Physicaltime/pose/C/source/density identical. No floor is subtracted from old strict gates.'};
    report.views[view]={pose:clone(fixed),caseIDs:[off,repeat1,repeat2,on,cleared].map(c=>c.id),visibleDifference,clearDifference,repeatFloor,
      signalExceedsObservedRepeatFloor:visibleDifference.rmsByteDifference>repeatFloor.maximumRMSByteDifference&&visibleDifference.positiveByteSum>0,
      probeComparisons:{offToRepeat1:compareProbes(off.indirectProbeState,repeat1.indirectProbeState),repeat1ToRepeat2:compareProbes(repeat1.indirectProbeState,repeat2.indirectProbeState),offToOn:compareProbes(off.indirectProbeState,on.indirectProbeState),offToCleared:compareProbes(off.indirectProbeState,cleared.indirectProbeState)},
      observationScope:'Probe/history fields are read-only diagnostics. No assertion or tolerance was changed for their addition. HDR ranges remain full-attachment extrema/counts, not sample-level image differences.'};
    if(view==='face'){report.visibleDifference=visibleDifference;report.clearDifference=clearDifference;report.repeatFloor=repeatFloor;}
    check(`${view}: actual scene display responds to the local one-hop increment`,visibleDifference.changedPixels>0&&visibleDifference.positiveByteSum>0,{difference:visibleDifference,repeatFloor,scope:'Original nonzero-visible gate is retained. All local sources, including ground lamps; not isolated pyro-only energy.'});
    check(`${view}: raw local incident/reflected power is positive when enabled`,on.GI.transient.incidentPowerRGB.some(v=>v>0)&&on.GI.transient.reflectedPowerRGB.some(v=>v>0),{incident:on.GI.transient.incidentPowerRGB,reflected:on.GI.transient.reflectedPowerRGB});
    check(`${view}: disabling clears the raw increment immediately without point18s residue`,cleared.immediate.enabled===false&&cleared.immediate.incidentPowerRGB.every(v=>v===0)&&cleared.immediate.reflectedPowerRGB.every(v=>v===0)&&cleared.GI.transient.reflectedPowerRGB.every(v=>v===0),{immediate:cleared.immediate,settled:cleared.GI.transient});
    check(`${view}: base solar/moon solution powers and native mode remain unchanged`,same(off.basePower,on.basePower)&&same(off.basePower,cleared.basePower),{off:off.basePower,on:on.basePower,cleared:cleared.basePower,scope:'Public base powers/geometry; not private coefficient equality.'});
    check(`${view}: off returns to the same raw budget and actual displayed pixels`,near(off.photometry.components.indirect,cleared.photometry.components.indirect,1e-12)&&near(off.photometry.storageEV,cleared.photometry.storageEV,1e-12)&&clearDifference.changedPixels===0,{offIndirect:off.photometry.components.indirect,clearedIndirect:cleared.photometry.components.indirect,offP:off.photometry.storageEV,clearedP:cleared.photometry.storageEV,difference:clearDifference,repeatFloor,strictOriginalZeroPixelGate:true});
    check(`${view}: new combined raw bound includes local one-hop while native base is retained`,on.photometry.components.indirect>off.photometry.components.indirect&&cleared.photometry.components.indirect>=0,{off:off.photometry.components.indirect,on:on.photometry.components.indirect,cleared:cleared.photometry.components.indirect});
  }
  try{
    for(const key of ['setTransientIndirect','pauseAtPhysicalTime','fireworkClusters','inspectRadiance','screenshot'])if(typeof a[key]!=='function')throw new Error('Reload the integrated main with QA API '+key);
    if(initial.parameters.wind!==0)throw new Error('Set the native wind control to0 before this scene check');
    if(intensityScale!==undefined&&(!Number.isFinite(intensityScale)||intensityScale<0||intensityScale>64))throw new RangeError('QA intensityScale requires a finite0..64; omitted means current settings');
    if(typeof receiverView!=='boolean')throw new TypeError('receiverView must be boolean');
    if(originalGI.quality==='off')throw new Error('Select native GI low/high before this local-only A/B; helper does not alter the all-GI quality selector');
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const windStart=a.state.time,windWall=performance.now();while(norm(a.smokeSnapshot().currentWind)>=1e-4){if(a.state.time-windStart>20||performance.now()-windWall>45000)throw new Error('Effective smoke wind did not settle within20physical seconds');await wait(80);}
    report.wind={waitPhysicalSeconds:a.state.time-windStart,actual:clone(a.smokeSnapshot().currentWind)};
    const retireStart=a.state.time,retireWall=performance.now();while(a.fireworks().active||a.fireworks().queued){if(a.state.time-retireStart>90||performance.now()-retireWall>150000)throw new Error('Existing events did not retire naturally; no event was deleted');await wait(100);}
    a.pause(true);const c=a.celestial();report.appliedMoonPreset=!(c.mode==='astronomical'&&c.sun.altitudeDeg<-6&&c.moon.altitudeDeg>0);if(report.appliedMoonPreset)await a.timePreset('moon');await a.setTime({running:false});moonUTC=a.celestial().utcMs;
    await a.setNight({autoExposure:true});if(a.localLights().flashlight.enabled)throw new Error('Native flashlight capsC at16; disable it before the16.5EV fixture');
    a.setLens({focal:28,exposure:0,dof:false,opticalFlare:false,automatic:false});a.setRenderScale(saved.renderScale);a.setCamera([-48,12,-40],[0,2.5,0]);
    report.intensityScale=intensityScale??saved.fireworks.intensityScale??1;report.controls.requestedIntensityScale=intensityScale??'current';report.controls.actualIntensityScale=report.intensityScale;
    a.setFireworks({type:'ring',autoDirection:true,elevation:80,autoFrame:true,autoLaunch:false,intensityScale:report.intensityScale});
    await settle();await a.inspectRadiance();const wall=performance.now();while(!a.graphics().indirect.ready){if(performance.now()-wall>20000)throw new Error('Production GI transport did not become ready');await raf();}
    report.launch=a.launchFirework({type:'ring',seed:42,smileyLayout:'reference',intensityScale:report.intensityScale});if(!report.launch.accepted||report.launch.queued)throw new Error('Fresh ring was not launched immediately');
    target=report.launch.burstTime+1.1;report.pauseTarget=a.pauseAtPhysicalTime(target);const until=performance.now()+30000;while(!a.state.parameters.paused||a.state.time<target-1e-8){if(performance.now()>until)throw new Error('Exact burst-phase pause timed out');await raf();}
    if(Math.abs(a.state.time-target)>1e-8)throw new Error('Exact physical pause missed its target');await settle();fixed={camera:[...a.state.camera],target:[...a.state.target]};a.setFireworks({autoFrame:false});a.setCamera(fixed.camera,fixed.target);await settle();qualityFixed=quality(a.state);report.fixedPose=clone(fixed);report.fixedQuality=clone(qualityFixed);
    const diagnostic=a.diagnostics?.(),sandSource=diagnostic?.sandSource??'';report.materialHookEvidence={actualSandSourceHasGI:sandSource.includes('getIndirectIrradiance(vGIWorld,giWorldNormal)'),actualSandSourceHasWorldVarying:sandSource.includes('vGIWorld'),leafDebug:diagnostic?.vegetation?.leafOptics?.debug,
      staticAudit:'main creates sand/wind hooks first, then cloud wrapper→GI wrapper→local wrapper; motion wrapper also calls its captured previous hook. No later sand/vegetation standard-material hook replacement was found. Actual sand compiled-source object is observable; foliage program uniforms are not publicly exposed.'};
    check('actual compiled sand retains GI and foliage is not in unlit debug',report.materialHookEvidence.actualSandSourceHasGI&&report.materialHookEvidence.actualSandSourceHasWorldVarying&&report.materialHookEvidence.leafDebug?.unlit===0,report.materialHookEvidence);
    await captureView();
    if(receiverView){
      view='receiver';report.receiverRequestedPose={camera:[12,3.2,20],target:[-8,8,-3],purpose:'shore-facing canopy undersides; closer spatial coverage, not a changed sun, source strength or camera exposure'};
      const density=clone(a.smokeSnapshot()),clusters=clone(a.fireworkClusters());a.setCamera(report.receiverRequestedPose.camera,report.receiverRequestedPose.target);await settle();fixed={camera:[...a.state.camera],target:[...a.state.target]};
      check('closer receiver view changes only camera at the same exact source phase',Math.abs(a.state.time-target)<1e-8&&same(density,a.smokeSnapshot())&&same(clusters,a.fireworkClusters()),{actualPose:fixed,requested:report.receiverRequestedPose,time:a.state.time});
      await captureView();
    }
    check('no scene frame exceptions during the actual GI comparison',report.runtimeErrors.length===0,{errors:report.runtimeErrors});
  }catch(e){report.failure={message:String(e.message??e),stack:String(e.stack??'')};check('actual GI scenario completes without a hidden fallback',false,report.failure);}
  finally{
    a.pause(true);
    if(restoreScene){try{
      a.setDirector({mode:'off'});a.setLens(saved.lens);a.setRenderScale(saved.renderScale);if(!same(a.state.parameters.weather,saved.weather))a.setWeather(saved.weather);await a.setNight({autoExposure:saved.autoExposure});
      await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running,timeZoneOffsetMinutes:saved.clock.timeZoneOffsetMinutes,refraction:saved.clock.refraction});
      if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.setCamera(saved.camera,saved.target);a.setFireworks(saved.fireworks);a.setTransientIndirect(saved.transient);if(saved.director.mode!=='off')a.setDirector(saved.director);a.pause(saved.paused);
      report.restoration={...report.restoration,completed:true,remainingActive:a.fireworks().active,remainingQueued:a.fireworks().queued,physicalTime:a.state.time};
      check('user scene and localGI settings restored without deleting the live event',a.celestial().utcMs===saved.clock.utcMs&&same(a.state.parameters.weather,saved.weather)&&same(a.state.parameters.lens,saved.lens)&&same(a.fireworks().settings,saved.fireworks)&&distance(a.state.camera,saved.camera)<1e-8&&distance(a.state.target,saved.target)<1e-8&&a.state.parameters.paused===saved.paused&&a.graphics().indirect.transient.requestedEnabled===saved.transient,{restoration:report.restoration});
    }catch(e){report.restoration.error=String(e.stack??e);check('scene restoration completes',false,{error:report.restoration.error});}}
    else report.restoration={...report.restoration,leftPaused:true,completed:false,remainingActive:a.fireworks().active};
    window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);
  }
  report.passed=report.checks.every(c=>c.passed)&&report.cases.length===(receiverView?10:5);report.passedCount=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;
  report.integrationAudit={source:'read-only main.js integration review; actual runtime source must be reloaded by caller',order:['current raw fireworks clusters → localLights.update','cloud raw sources, cloud shadow and base GI update','prepareTransient(localLights.records rawRGB)','combined indirect getRadianceBound → radiometry bounds.indirect','selectP → setSceneExposure(P) on local lights and GI → main/reflection draws'],
    findings:['No new P double application found in this order: source rawRGB is independent of stored uniforms, raw SH is bounded before selection, GI lookup applies the finalP once.','Old duplicate post-budget cloud/GI update was removed from the current frame path.','Native indirect off is ANDed into prepareTransient and getRadianceBound returns0 while off; this helper deliberately holds native mode fixed rather than conflating all-GI toggling with local-only toggling.'],
    risks:['Toggle forces the base cache solve too; compare the first off after that solve, not a pre-toggle partly blended base.','Public base-power equality is not private per-probe bitwise attestation; the actual off/on/off PNG return is an independent receiver-level regression.','SH1/rest geometry visibility may leak and does not resolve wind-deformed leaves, smoke shadows, water-interface GI or specular transport.','Local increment contains the3 ground lamps and pyro slots; a visible image delta alone is not proof of pyro-only indirect light.']};
  report.limits=['Actual production scene and complete main/mirror HDR range reads, not absolute photometry, whole-scene energy conservation or FPS.','Within each view: same event, physicaltime, density, UTC, pose, photographicC and raw direct sources. P follows the combined safety envelope. Closer receiver view intentionally changes camera and may choose a different safeP.','Optional intensityScale is only the temporary QA event source, defaulting to current settings; no production default/gain is edited.','No clearSmoke was invoked: existing cold smoke is included and remains physically present. Old events retire naturally; final live event is not deleted.','Native wind must already be0; residual norm<1e-4 is measured, not forced.','Three off exports measure identical-render variability; no observed floor is subtracted and the original strict0pixel-return assertion remains. First26/28 failure report and originalcfb0ee74 helper are preserved separately.','Decoded SDR differences are not unexposed linear-radiance integrals. A signal above the measured floor is a separate observation, not an arbitrary tolerance that turns a failed original gate into success.','Restoring an active saved director restarts its mode/entry; the public API cannot restore its previous private orbit phase.'];
  return report;
}
