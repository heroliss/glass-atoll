const raf=()=>new Promise(r=>requestAnimationFrame(r)),clone=x=>structuredClone(x),json=x=>JSON.stringify(x);
const physicalRange=r=>Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,Object.fromEntries(['minRGB','maxRGB','globalMin','globalMax','countNaN','countInf','countNegative'].map(n=>[n,r[k][n]]))]));
export async function runTransmissionSceneCheck(a){
 const report={schema:'glass-atoll.r10-transmission-same-event-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,checks:[],captures:[],images:{}};
 const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
 a.pause(true);a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});
 if(a.fireworks().active||a.fireworks().queued)throw Error('Fresh empty scene required');
 a.clearSmoke();report.sourceSelection=a.setSmokeReviewProfile('production');await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});await a.timePreset('moon');a.setTime({running:false});
 a.setDiagnosticCameraEV(16.5);a.setLens({focal:28,dof:false,exposure:0,opticalBloom:true,opticalFlare:false});
 a.setCamera([-155.3710544104007,12,-119.47836859531397],[34.05384350318789,73.92902718970932,20.738023431172135]);
 a.setFireworks({type:'chrysanthemum',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,intensityScale:1,persistentSmoke:true,cloudIllumination:true,resolvedSmokeLighting:false});
 report.launches=[a.launchFirework({type:'chrysanthemum',seed:42}),a.launchFirework({type:'chrysanthemum',seed:43})];if(!report.launches.every(l=>l.accepted&&!l.queued))throw Error('Two real launches required');
 const target=Math.max(...report.launches.map(l=>l.burstTime))+.8;a.pause(false);a.pauseAtPhysicalTime(target);const deadline=performance.now()+30000;
 while(!a.state.parameters.paused||a.state.time<target-1e-8){if(performance.now()>deadline)throw Error('Exact phase timeout');await raf();}
 const snapshot=json(a.smokeSnapshot()),clusters=json(a.fireworkClusters()),pose={camera:clone(a.state.camera),target:clone(a.state.target)},utc=a.celestial().utcMs;let reference=null;
 for(const mode of ['legacy','fast']){
  a.setSmokeTransmissionMode(mode);for(let i=0;i<36;i++)await raf();
  const s=clone(a.state),p=clone(a.photometry()),range=await a.inspectRadiance(),image=a.screenshot();report.images[mode]=image;
  const same={snapshot:json(a.smokeSnapshot())===snapshot,clusters:json(a.fireworkClusters())===clusters,clock:s.time===target,utc:a.celestial().utcMs===utc,pose:Math.hypot(...s.camera.map((v,i)=>v-pose.camera[i]))<1e-8&&Math.hypot(...s.target.map((v,i)=>v-pose.target[i]))<1e-8,C:p.cameraEV===16.5,tail:a.fireworks().tailIntegration.requested==='adaptive',route:a.smokeTransmissionMode===mode};
  const r=physicalRange(range);report.captures.push({mode,state:s,photo:p,range,columns:a.smoke().columns,same});
  check(mode+': actual physical source camera exposure and tail preserved',Object.values(same).every(Boolean),same);
  check(mode+': three actual HDR buffers safe',['opaque','composed','reflection'].every(k=>{const v=range[k];return v.stateRestored&&v.counterConsistency&&!v.countNaN&&!v.countInf&&!v.countNegative&&v.globalMax<=p.safeMaximum*(1+1e-4);}));
  if(reference){check('raw ranges and storage exposure unchanged',json(r)===reference.range&&p.storageEV===reference.P);check('entire actual SDR PNG byteexact',image===reference.image);}
  else reference={range:json(r),P:p.storageEV,image};
 }
 report.finalGL=a.readGLErrors('transmission-scene-after');check('actual GL caller state remains live without errors',report.finalGL.errors.length===0&&report.finalGL.programLive&&!report.finalGL.programDeletePending,report.finalGL);
 report.counts={passed:report.checks.filter(x=>x.passed).length,total:report.checks.length};report.passed=report.checks.every(x=>x.passed);
 report.limits=['Same actual paused source/time/pose, two host transmission paths. No smoke or head count reduction.','SDR PNG identity plus full-domain HDR extrema/counters is not a full master HDR pixel hash.','No renderer FPS or uninstrumented CPU performance claim; this fixture contains forced readbacks.','Leaves scene paused in fast route. Production point smoke remains unchanged.'];return report;
}
