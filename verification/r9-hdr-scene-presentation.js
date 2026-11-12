// One actual scene, two display looks. Native HDR readback is a separate
// presentation check, not an SDR screenshot or panel/source photometry.
const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const clone=x=>structuredClone(x),json=x=>JSON.stringify(x);
const extrema=r=>Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,Object.fromEntries(['minRGB','maxRGB','globalMin','globalMax','countNaN','countInf','countNegative','counterConsistency','stateRestored'].map(n=>[n,r[k][n]]))]));
export async function runR9HDRScenePresentation(a,{peakNits=1200}={}){
  if(peakNits!==1200)throw Error('This recorded scene gate is explicitly1200nit');
  const report={schema:'glass-atoll.r9-HDR-exact1200-scene.v1',actualGPU:true,dateUTC:new Date().toISOString(),peakNits,images:{},checks:{}};
  a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
  const deadline=performance.now()+45000;
  while(a.fireworks().active||a.fireworks().queued){if(performance.now()>deadline)throw Error('Previous events failed to retire');await raf();}
  a.clearSmoke();report.sourceSelection=a.setSmokeReviewProfile('production');
  await a.setGraphics({hdrMode:'hdr',systemCalibration:false,peakNits,paperWhiteNits:280,displayTransform:'legacy'});
  await a.timePreset('stars');await a.setTime({running:false});
  a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,exposure:0,dof:false,opticalBloom:true,opticalFlare:true});
  a.setFireworks({type:'peony',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:4,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:false});
  report.launch=clone(a.launchFirework({type:'peony',seed:42,palette:'blue',intensityScale:4}));
  if(!report.launch.accepted||report.launch.queued)throw Error('One actual blue launch required');
  const target=report.launch.burstTime+1.1;a.pauseAtPhysicalTime(target);
  const stop=performance.now()+30000;
  while(!a.state.parameters.paused||a.state.time<target-1e-8){if(performance.now()>stop)throw Error('Physical pause timeout');await raf();}
  for(let i=0;i<36;i++)await raf();
  const frozen=()=>({time:a.state.time,camera:a.state.camera,target:a.state.target,C:a.photometry().cameraEV,P:a.photometry().storageEV,smoke:a.smokeSnapshot(),clusters:a.fireworkClusters(),utc:a.celestial().utcMs});
  report.baseline={frozen:clone(frozen()),range:await a.inspectRadiance(),graphics:clone(a.graphics()),temporal:clone(a.state.lens.temporal)};
  report.images.legacy=a.screenshot();
  await a.setGraphics({displayTransform:'aces2'});await raf();await raf();
  report.images.aces2=a.screenshot();await raf();await raf();
  report.candidate={frozen:clone(frozen()),range:await a.inspectRadiance(),graphics:clone(a.graphics()),temporal:clone(a.state.lens.temporal)};
  report.beforeCopy=a.readGLErrors('r9-native1200-before');
  report.presentation=await a.runHDRPresentationCheck({requireExtended:true,timeoutMs:10000});
  report.afterCopy=a.readGLErrors('r9-native1200-after');
  const s=report.candidate.graphics.displayTransform;
  report.checks={physicalSnapshotUnchanged:json(report.baseline.frozen)===json(report.candidate.frozen),rawRangeUnchanged:json(extrema(report.baseline.range))===json(extrema(report.candidate.range)),exactTargetReady:s.preparation.status==='ready'&&s.preparation.peakNits===1200,actualSDR100:s.sdr.effective==='aces2'&&s.sdr.peakNits===100,actualHDR1200:s.hdr.effective==='aces2'&&s.hdr.peakNits===1200,full963Admission:s.output.resources.some(r=>r.peakNits===1200&&r.validation.actualGPU===true&&r.validation.sampleCount===963&&r.validation.failedChannels===0),nativePresentationPassed:report.presentation.passed===true,actualCopyTarget1200:report.presentation.frame.settings.peakNits===1200,extendedWitness:report.presentation.comparison.source.aboveOneRGB>0&&report.presentation.comparison.destination.aboveOneRGB>0,cleanGL:report.beforeCopy.errors.length===0&&report.afterCopy.errors.length===0};
  report.passed=Object.values(report.checks).every(Boolean);
  report.limits=['Explicit1200nit test on the existing HDR presentation path; not physical panel/source luminance calibration.','PNG exports use the100nit SDR path. Only actual native presentation readback verifies retained extended values.','Frozen master comparison is range/counter and source-state identity, not a full master pixel hash.','Source intensity4 and C16.5 are fixed QA settings, not production default or measured firework candela.','One readback frame stalls the GPU and is excluded from performance claims.','Leaves the actual scene paused for native UI inspection; reload restores production defaults.'];
  return report;
}
