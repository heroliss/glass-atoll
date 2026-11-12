// Real 4096-capacity host, three explicitly bounded representative cases.
const raf=()=>new Promise(r=>requestAnimationFrame(r)),clone=x=>structuredClone(x);
export async function runLogicalSourceSceneCheck(a,{type='crossette',phases=[.8,3.6,10]}={}){
 const expected={palm:{bodies:12,mass:20.35},crossette:{bodies:180,mass:20.35},bouquet:{bodies:104,mass:2}}[type];
 if(!expected||JSON.stringify(phases)!==JSON.stringify([.8,3.6,10]))throw Error('This fixture covers explicit palm/crossette/bouquet phases only');
 const report={schema:'glass-atoll.r10-logical-source-actual-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,type,phases,expected,checks:[],captures:[],images:{},runtimeErrors:[]};
 const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
 const onError=e=>report.runtimeErrors.push(String(e.message||e.reason||'runtime failure'));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
 try{
  a.pause(true);a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});if(a.fireworks().active||a.fireworks().queued)throw Error('Use a fresh empty scene');
  a.clearSmoke();report.selection=a.setSmokeReviewProfile('logical-all');await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('moon');a.setTime({running:false});
  a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,dof:false,exposure:0,opticalBloom:true,opticalFlare:false});a.setSmokeTransmissionMode('fast');
  a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);
  a.setFireworks({type,autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:false});
  report.audioBefore=clone(a.fireworks().audio);report.launch=clone(a.launchFirework({type,seed:42,intensityScale:1}));if(!report.launch.accepted||report.launch.queued)throw Error('Actual immediate launch required');
  for(const phase of phases){
   const target=report.launch.burstTime+phase;a.pause(false);a.pauseAtPhysicalTime(target);const deadline=performance.now()+90000;
   while(!a.state.parameters.paused||a.state.time<target-1e-8){if(report.runtimeErrors.length)throw Error('Actual frame raised '+report.runtimeErrors[0]);if(performance.now()>deadline)throw Error('Phase failed to reach within90wallseconds');await raf();}
   for(let i=0;i<36;i++)await raf();
   const s=clone(a.state),smoke=clone(a.smoke()),photo=clone(a.photometry()),range=await a.inspectRadiance();report.images[String(phase)]=a.screenshot();
   const event=[...smoke.events.activeCoverage,...smoke.events.completedCoverage].find(e=>e.eventId===report.launch.id),coverage={declaredBodies:event?.bodyCount,queriedBodies:event?.materializedBodies};
   report.captures.push({phase,time:s.time,state:s,smoke,photo,range,coverage,audio:clone(a.fireworks().audio)});
   check(phase+': real all-body profile and4096 host selected',smoke.events.coverage==='all-logical'&&smoke.events.parameters.emissionProfile==='logical-family-continuous-v1'&&smoke.state.capacity===4096&&smoke.events.parameters.centralFraction===.2&&smoke.events.parameters.groundChargeFraction===.1&&coverage.declaredBodies===expected.bodies,coverage);
   check(phase+': committed pending and reserved material close',Math.abs(smoke.events.allocatedArea-expected.mass)<2e-8&&Math.abs(smoke.events.accountingResidual)<2e-8&&Math.abs(smoke.state.ledger.residual)<2e-8&&Math.abs(smoke.state.ledger.emitted+smoke.state.ledger.pendingMass+smoke.events.reservedArea-expected.mass)<2e-8);
   check(phase+': actual clock exposure and three HDR buffers safe',Math.abs(s.time-target)<1e-8&&photo.cameraEV===16.5&&['opaque','composed','reflection'].every(k=>{const r=range[k];return r.stateRestored&&r.counterConsistency&&!r.countNaN&&!r.countInf&&!r.countNegative&&r.globalMax<=photo.safeMaximum*(1+1e-4);}));
   check(phase+': no source fault or hidden future arrays',!smoke.events.fault&&smoke.events.releaseErrors===0&&smoke.events.futureCellArrays===0&&smoke.events.positionArchives===0);
  }
  const last=report.captures.at(-1);check('cold phase really queried every logical body and released all reserved material',last.coverage.queriedBodies===expected.bodies&&Math.abs(last.smoke.events.materializedArea-expected.mass)<2e-8&&last.smoke.events.pendingStreams===0&&last.smoke.events.reservedArea===0,last.coverage);
 }catch(e){report.error=String(e.stack||e);check('fixture reached all required phases',false,report.error);}
 finally{a.pause(true);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);}
 report.finalGL=a.readGLErrors('logical-source-scene-after');check('no actual runtime or GL error observed',!report.runtimeErrors.length&&!report.finalGL.errors.length&&!a.state.graphicsContextInterrupted,{runtime:report.runtimeErrors,gl:report.finalGL});
 report.counts={passed:report.checks.filter(x=>x.passed).length,total:report.checks.length};report.passed=report.checks.every(x=>x.passed);report.visualAccepted=false;
 report.limits=['One real event per explicit case; this is not all-ten visual or4096 capacity/long-accumulation performance acceptance.','Author reference material totals and10/90 ground allocation are not kg or real measured yields.','Uses new all-body/past-segment/Brownian QA profile, c.20, fieldoff and fixedC16.5; production point smoke default is unchanged.','All-body queried counts plus finite HDR values do not establish photoreal smoke, exact multiple scattering or60fps.','Forced readbacks and settled paused stills are excluded from performance claims. Reload restores defaults.'];return report;
}
