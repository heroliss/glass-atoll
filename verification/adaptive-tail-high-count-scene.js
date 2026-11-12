// QA only: two actual chrysanthemum events in the full running scene.
// One mode, not a legacy/adaptive paired cost comparison. No extra GPU timer.
const raf=()=>new Promise(r=>requestAnimationFrame(r));
export async function runAdaptiveTailHighCountScene(a){
  const report={schema:'glass-atoll.adaptive-tail-high-count-scene.v1',dateUTC:new Date().toISOString(),actualScene:true,mode:'adaptive',seed:[42,43],checks:[],samples:[],images:{}};
  const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
  a.pause(true);a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});
  if(a.fireworks().active||a.fireworks().queued)throw Error('Fresh empty scene required');
  a.clearSmoke();report.sourceSelection=a.setSmokeReviewProfile('production');
  await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('moon');a.setTime({running:false});
  a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,dof:false,exposure:0,opticalBloom:true,opticalFlare:false});
  a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);
  a.setFireworks({type:'chrysanthemum',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:true});
  a.setFireworksTrailIntegration('adaptive');
  report.launches=[a.launchFirework({type:'chrysanthemum',seed:42,intensityScale:1}),a.launchFirework({type:'chrysanthemum',seed:43,intensityScale:1})];
  if(!report.launches.every(x=>x.accepted&&!x.queued))throw Error('Two immediate real launches required');
  const target=Math.max(...report.launches.map(x=>x.burstTime))+.1;a.pause(false);a.pauseAtPhysicalTime(target);
  const deadline=performance.now()+30000;
  while(!a.state.parameters.paused||a.state.time<target-1e-8){if(performance.now()>deadline)throw Error('Exact peak phase timeout');await raf();}
  for(let i=0;i<36;i++)await raf();
  report.initial={state:a.state,fireworks:a.fireworks(),photo:a.photometry(),smoke:a.smoke(),audio:a.audio};
  check('actual two192-head events rendered in adaptive mode',a.fireworks().activeEvents.length===2&&a.fireworks().activeEvents.every(e=>e.type==='chrysanthemum'&&e.actualStarCount===192)&&a.fireworks().tailIntegration.effective==='adaptive-with-legacy8-budget-fallback',a.fireworks().tailIntegration);
  report.images.hot=a.screenshot();report.hotRange=await a.inspectRadiance();
  check('hot main composed and mirror values finite and safe',['opaque','composed','reflection'].every(k=>{const r=report.hotRange[k];return r.stateRestored&&r.counterConsistency&&!r.countNaN&&!r.countInf&&!r.countNegative&&r.globalMax<=a.photometry().safeMaximum*(1+1e-4);}),Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,report.hotRange[k].globalMax])));
  let interval=null;
  try{interval=setInterval(()=>report.samples.push({time:a.state.time,burstAge:a.state.time-target+.1,tail:a.fireworks().tailIntegration,records:a.fireworks().records,active:a.fireworks().active,photo:{C:a.photometry().cameraEV,P:a.photometry().storageEV}}),500);a.pause(false);report.benchmark=await a.benchmark(8);}
  finally{clearInterval(interval);a.pause(true);}
  report.final={state:a.state,fireworks:a.fireworks(),photo:a.photometry(),smoke:a.smoke(),audio:a.audio};report.images.cold=a.screenshot();
  report.finalGL=a.readGLErrors('adaptive-high-count-exit');
  check('actual full benchmark completed',report.benchmark.status==='completed'&&report.benchmark.validity==='valid');
  check('active count stayed bounded during natural expiry',report.samples.length>0&&report.samples.every(s=>s.active<=2));
  check('no observed GL error or context interruption',report.finalGL.errors.length===0&&!a.state.graphicsContextInterrupted,report.finalGL);
  report.counts={passed:report.checks.filter(x=>x.passed).length,total:report.checks.length};report.passed=report.checks.every(x=>x.passed);
  report.limits=['One actual eight-second evolving full-scene stress window, not a same-time paired cost comparison or guarantee for other views/devices.','Uses production point/two-birth smoke, explicit C16.5 and SDR legacy, current native sound state recorded. No source intensity change.','Hot range readback and SDR screenshot happen before benchmark. Compact500ms CPU diagnostics occur inside its window.','Tail branch counters are CPU projections, not actual GPU invocation counts. Camera auto-frame freezes naturally after setup; all actual poses are retained.','Leaves event and smoke paused; reload restores defaults.'];
  return report;
}
