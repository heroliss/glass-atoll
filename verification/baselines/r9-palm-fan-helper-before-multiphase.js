// QA only: one real launch, two temporary hosts, identical light and clock.
// Emission timing/locations legitimately differ. No equal-image acceptance gate.
const IDS=['early','continuous'];
const clone=x=>structuredClone(x),json=x=>JSON.stringify(x);
const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const near=(a,b,t=1e-8)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t;
const safeRange=r=>['opaque','composed','reflection'].every(k=>r[k]&&r[k].stateRestored&&r[k].counterConsistency&&r[k].countNaN===0&&r[k].countInf===0&&r[k].countNegative===0&&Number.isFinite(r[k].globalMax));
const audioState=a=>{const d=a.fireworks().audio;return{enabled:a.audio.enabled,scheduled:d.scheduled,discarded:d.discarded,recordedPlays:d.recordedPlays,synthesizedPlays:d.synthesizedPlays,relativeBurstGain:d.relativeBurstGain,postCompressorHeadroomGain:d.postCompressorHeadroomGain,source:d.source};};

export async function runPalmFanBurnSceneCheck(a,{THREE,camera,createVariants,selectVariant,getVariantSnapshots,getVariantDiagnostics,type='palm',seed=42,intensityScale=1,phases=[.8,3.6,10],angles=['front','detail'],restoreScene=true}={}){
  if(!['palm','fan'].includes(type)||!Array.isArray(phases)||phases.some((v,i)=>!Number.isFinite(v)||v<=0||i&&v<=phases[i-1])||!angles.every(v=>['front','detail'].includes(v)))throw Error('Bounded palm/fan phase comparison required');
  const report={schema:'glass-atoll.palm-fan-burn-same-event-scene.v1',actualGPU:true,dateUTC:new Date().toISOString(),type,seed,intensityScale,phases,angles,checks:[],captures:[],images:{},runtimeErrors:[],restoration:{requested:restoreScene}};
  const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,...(evidence===undefined?{}:{evidence})});
  const saved={parameters:clone(a.state.parameters),camera:clone(a.state.camera),target:clone(a.state.target),clock:clone(a.celestial()),fireworks:clone(a.fireworks().settings),director:clone(a.director()),diagnosticC:a.diagnosticCameraEV};
  const onError=e=>report.runtimeErrors.push(String(e.message||e.reason||'runtime error'));
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
  async function settle(){for(let i=0;i<32;i++)await raf();return clone(a.state.lens.temporal);}
  try{
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const retireUntil=performance.now()+45000;
    while(a.fireworks().active||a.fireworks().queued){if(performance.now()>retireUntil)throw Error('Previous events did not retire');await raf();}
    a.clearSmoke();await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});
    await a.timePreset('moon');await a.setTime({running:false});
    a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:false});
    a.setFireworks({type,autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:true,intensityScale});
    report.variantIDs=clone(await createVariants());
    check('two empty real hosts share the current physical origin',json([...report.variantIDs].sort())===json([...IDS].sort())&&IDS.every(id=>getVariantSnapshots()[id]?.packets.length===0));
    report.audioBefore=clone(audioState(a));report.launch=clone(a.launchFirework({type,seed,intensityScale}));
    if(!report.launch.accepted||report.launch.queued)throw Error('Shared launch not accepted immediately');
    report.launchPhysics=clone(a.fireworks().activeEvents.find(e=>e.id===report.launch.id));
    const utc=a.celestial().utcMs;let front=null,detailCentre=null;
    for(const phase of phases){
      const target=report.launch.burstTime+phase;a.pauseAtPhysicalTime(target);
      const deadline=performance.now()+30000;
      while(!a.state.parameters.paused||a.state.time<target-1e-8){if(performance.now()>deadline)throw Error('Exact physical pause timed out');await raf();}
      if(!near(a.state.time,target))throw Error('Exact phase missed');
      const frozen=clone(getVariantSnapshots()),frozenJSON=json(frozen),clusters=clone(a.fireworkClusters()),frozenAudio=clone(audioState(a));
      if(!front)front={camera:clone(a.state.camera),target:clone(a.state.target)};
      if(!detailCentre&&Array.isArray(clusters[0]?.position)&&clusters[0].position.length===3&&clusters[0].position.every(Number.isFinite))detailCentre=clone(clusters[0].position);
      const budget=type==='palm'?20.35:.9,diagnostics=clone(getVariantDiagnostics());
      check(`phase${phase}: every host conserves committed pending and reserved budget`,IDS.every(id=>{const d=diagnostics[id],l=d.state.ledger,p=d.events;return near(p.allocatedArea,budget,2e-9)&&near(l.emitted+l.pendingMass+p.reservedArea,budget,2e-9)&&Math.abs(l.residual)<1e-9&&Math.abs(p.accountingResidual)<1e-9&&d.state.merges===0;}),Object.fromEntries(IDS.map(id=>[id,{packets:frozen[id].packets.length,ledger:diagnostics[id].state.ledger,reservedArea:diagnostics[id].events.reservedArea}])));
      check(`phase${phase}: continuous candidate really selected`,diagnostics.continuous.events.parameters.emissionProfile==='palm-fan-uniform-burn-v1');
      for(const angle of angles){
        let pose=front;
        if(angle==='detail'){
          // Freeze a real hot-phase light centroid. Cold sources have no live
          // clusters, and public activeEvents intentionally omits burst XYZ.
          const centre=detailCentre;
          if(!Array.isArray(centre)||!centre.every(Number.isFinite))throw Error('Actual light centroid or burst origin required');
          pose={camera:centre.map((v,i)=>v+[-48,12,-95][i]),target:[...centre]};
        }
        a.setCamera(pose.camera,pose.target);const accepted={camera:clone(a.state.camera),target:clone(a.state.target)};
        for(const id of IDS){
          await selectVariant(id);a.setCamera(accepted.camera,accepted.target);const settling=await settle();
          const image=a.screenshot(),state=clone(a.state),photo=clone(a.photometry()),range=await a.inspectRadiance(),ss=clone(getVariantSnapshots()),dd=clone(getVariantDiagnostics());
          const key=`${type}_${phase}_${angle}_${id}`;report.images[key]=image;
          report.captures.push({key,id,angle,phase,time:state.time,camera:state.camera,target:state.target,detailAnchor:detailCentre,lens:state.lens,photometry:photo,range,settling,smoke:dd[id],snapshot:ss[id],clusters:clone(a.fireworkClusters()),audio:clone(audioState(a))});
          check(`${key}: source clock camera exposure and matter frozen`,json(ss)===frozenJSON&&json(a.fireworkClusters())===json(clusters)&&near(state.time,target)&&near(photo.cameraEV,16.5)&&json(state.camera)===json(accepted.camera)&&json(state.target)===json(accepted.target)&&a.celestial().utcMs===utc);
          check(`${key}: actual main mirror and composed values safe`,safeRange(range)&&photo.storedBound<=photo.safeMaximum*(1+1e-10)&&['opaque','composed','reflection'].every(k=>range[k].globalMax<=photo.safeMaximum*(1+1e-4)));
          check(`${key}: no audio replay during host selection`,json(audioState(a))===json(frozenAudio));
        }
      }
      if(phase!==phases.at(-1)){a.setCamera(front.camera,front.target);a.pause(false);}
    }
    report.audioAfter=clone(audioState(a));report.finalDiagnostics=clone(getVariantDiagnostics());
    const expectedAudioEvents=type==='fan'?9:2;
    check('one shared launch did not duplicate original audio event delivery',report.audioAfter.scheduled+report.audioAfter.discarded-report.audioBefore.scheduled-report.audioBefore.discarded===expectedAudioEvents,{expectedOriginalEvents:expectedAudioEvents,before:report.audioBefore,after:report.audioAfter,scope:'Delivery accounting only; disabled audio is discarded, not a new listening/waveform acceptance.'});
    check('no asynchronous frame exceptions',report.runtimeErrors.length===0&&!a.state.graphicsContextInterrupted);
  }catch(e){report.failure={message:String(e.message||e),stack:String(e.stack||'')};check('actual same-event source comparison completes',false,report.failure);}
  finally{
    a.pause(true);
    if(restoreScene)try{
      a.setDirector({mode:'off'});a.setLens(saved.parameters.lens);
      await a.setGraphics(saved.parameters.graphics);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});
      if(saved.clock.mode==='artistic')a.setSun(saved.parameters.sun);
      a.setDiagnosticCameraEV(saved.diagnosticC);a.setCamera(saved.camera,saved.target);a.setFireworks(saved.fireworks);if(saved.director.mode!=='off')a.setDirector(saved.director);a.pause(saved.parameters.paused);report.restoration.completed=true;
    }catch(e){report.restoration.error=String(e.stack||e);check('restore preferences',false,report.restoration);}
    window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);
  }
  report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};
  report.passed=report.technicalPassed=report.checks.every(c=>c.passed)&&report.captures.length===IDS.length*angles.length*phases.length;
  report.visualAccepted=false;
  report.limits=['Technical gates do not accept photographic appearance; actual PNGs need review.','One actual event feeds both hosts, light/audio only once. Two source geometries legitimately differ, no identical-image claim.','Uniform authored life release and fan mouth/comet split are not measured chemistry/yield. Reference total is not calibrated kg/PM.','The original production host is separately restored by the caller; explicit clear and physical elapsed time cannot be rewound.','No lighting/source intensity or C compensation; independently safe P can differ per host.','No smoke self-shadow/multiple-scattering/CFD or per-star fluid-grid claim.'];
  return report;
}
