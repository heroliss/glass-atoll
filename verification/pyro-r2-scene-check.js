import * as THREE from '../vendor/three.module.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const settle=async()=>{for(let i=0;i<32;i++)await new Promise(r=>requestAnimationFrame(r));};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function save(a){return {clock:a.celestial(),sun:a.state.parameters.sun,lens:a.state.parameters.lens,camera:a.state.camera,target:a.state.target,paused:a.state.parameters.paused,fireworks:a.fireworks().settings};}
async function restore(a,s){a.setDirector({mode:'off'});a.pause(true);a.setLens(s.lens);await a.setTime({utcMs:s.clock.utcMs,...s.clock.observer,mode:s.clock.mode,rate:s.clock.rate,running:s.clock.running});if(s.clock.mode==='artistic')a.setSun(s.sun);a.setCamera(s.camera,s.target);a.setFireworks(s.fireworks);a.pause(s.paused);}

export async function runDirectorSceneCheck(a){
  const s=save(a),checks=[],check=(name,passed,detail={})=>checks.push({name,passed:!!passed,detail});
  try{
    a.setDirector({mode:'off'});await a.setTime({running:false});
    const before={camera:a.state.camera,target:a.state.target,UTC:a.celestial().utcMs,weather:a.state.parameters.weather,lens:a.state.parameters.lens};
    a.pause(false);a.setDirector({mode:'island',periodSeconds:240});
    check('entry starts at actual current pose without an immediate pop',distance(a.state.camera,before.camera)<1e-10&&distance(a.state.target,before.target)<1e-10);
    await wait(650);check('director actually moves in the production loop',a.director().active&&distance(a.state.camera,before.camera)>.01,{director:a.director()});
    check('director leaves UTC weather and photography unchanged',a.celestial().utcMs===before.UTC&&JSON.stringify(a.state.parameters.weather)===JSON.stringify(before.weather)&&JSON.stringify(a.state.parameters.lens)===JSON.stringify(before.lens));
    a.pause(true);const paused=a.state.camera,phase=a.director().elapsedSeconds;await wait(160);
    check('global pause freezes pose and director physical clock',distance(paused,a.state.camera)<1e-8&&phase===a.director().elapsedSeconds);
    a.setDirector({mode:'off'});const cancelled=a.state.camera;a.pause(false);await wait(120);
    check('manual mode retains pose and never automatically restarts',!a.director().active&&a.director().mode==='off'&&distance(cancelled,a.state.camera)<1e-7);
    a.setFireworks({type:'ring',autoLaunch:false,autoFrame:true});const planned=a.setDirector({mode:'fireworks',periodSeconds:240});
    check('continuous director is the sole camera owner',a.director().active&&!a.fireworks().settings.autoFrame&&!!planned.forecast,{planningMs:planned.planningMs,radius:planned.radiusMetres,entrySeconds:planned.entrySeconds,forecast:planned.forecast});
    await wait((planned.entrySeconds+.25)*1000);a.pause(true);
    const state=a.state,d=a.director(),probe=new THREE.PerspectiveCamera(state.lens.verticalFovDegrees,state.lens.width/state.lens.height,.15,24000);probe.position.fromArray(state.camera);probe.lookAt(new THREE.Vector3(...state.target));probe.updateMatrixWorld();
    const f=d.forecast,corners=[];for(let i=0;i<8;i++)corners.push(new THREE.Vector3(i&1?f.max[0]:f.min[0],i&2?f.max[1]:f.min[1],i&4?f.max[2]:f.min[2]).project(probe).toArray());
    check('completed orbit entry fits the real forecast and island in the actual camera',d.phase==='orbit'&&corners.every(v=>Math.abs(v[0])<.90&&Math.abs(v[1])<.90&&v[2]>-1&&v[2]<1),{camera:state.camera,target:state.target,fov:state.lens.verticalFovDegrees,corners});
    const settings=a.fireworks().settings;a.setFireworks({...settings});check('full UI settings echo does not cancel an unchanged orbit forecast',a.director().active);
    a.setFireworks({elevation:settings.elevation===80?78:80});check('actual launch geometry edit cancels the frozen show forecast',!a.director().active&&a.director().mode==='off');
    a.setCamera(state.camera,state.target);check('explicit pose immediately cancels the director',!a.director().active&&a.director().mode==='off');
    a.setDirector({mode:'island'});a.setFireworks({autoFrame:true});check('one-shot framing takes ownership without competing with orbit',!a.director().active&&a.fireworks().settings.autoFrame);
    a.setDirector({mode:'island'});a.setLens({focal:35});check('manual focal-length change cancels the frozen composition',!a.director().active);
    return {date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,limits:['Actual production scene/API; native keyboard takeover is checked separately.','Framing check covers the frozen selected-show envelope and current lens; it does not promise arbitrary later launch edits are pre-framed.','Static and pose checks do not establish cinematic quality or FPS.']};
  }finally{await restore(a,s);}
}

export async function captureR2Smiley(a,{flarePair=false}={}){
  const s=save(a),report={date:new Date().toISOString()};
  try{
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const deadline=performance.now()+30000;while((a.fireworks().active||a.fireworks().queued)&&performance.now()<deadline)await wait(100);
    if(a.fireworks().active||a.fireworks().queued)throw new Error('Existing energetic events have not finished; no events were deleted for a capture.');
    await a.timePreset('moon');await a.setTime({running:false});a.setLens({focal:28,exposure:0,dof:false,opticalFlare:false});a.setCamera([-48,12,-40],[0,2.5,0]);
    a.setFireworks({type:'ring',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80});
    const event=a.launchFirework();report.launch=event;
    while(a.state.time<event.burstTime+1.05)await wait(15);a.pause(true);await settle();
    report.image=a.screenshot();report.ranges=await a.inspectRadiance();report.event=a.fireworks();report.camera=a.state.camera;report.target=a.state.target;report.lens=a.state.lens;report.photometry=a.photometry();report.lighting=a.localLights();
    report.checks=[{name:'ring compatibility request now produces an explicit smiley',passed:report.event.activeEvents.some(e=>e.pattern==='smiley'&&e.type==='ring')},
      {name:'actual main composed and mirror RGB remain finite/nonnegative',passed:['opaque','composed','reflection'].every(k=>report.ranges[k].countNaN===0&&report.ranges[k].countInf===0&&report.ranges[k].countNegative===0)},
      {name:'scene source budget stays below FP16 headroom',passed:report.photometry.storedBound<=report.photometry.safeMaximum}];
    if(flarePair){
      const before={time:a.state.time,camera:a.state.camera,target:a.state.target,clock:a.celestial().utcMs,P:a.photometry().storageEV,C:a.photometry().cameraEV};
      a.setLens({opticalFlare:true});await settle();
      report.flareImage=a.screenshot();report.flareRanges=await a.inspectRadiance();
      const after={time:a.state.time,camera:a.state.camera,target:a.state.target,clock:a.celestial().utcMs,P:a.photometry().storageEV,C:a.photometry().cameraEV};
      report.flareComparison={before,after,settings:a.state.parameters.lens};
      const same=before.time===after.time&&before.clock===after.clock&&before.P===after.P&&distance(before.camera,after.camera)<1e-10&&distance(before.target,after.target)<1e-10&&Math.abs(before.C-after.C)<1e-10;
      report.checks.push({name:'flare comparison retains physical phase, pose and P/C',passed:same,toleranceEV:1e-10},
        {name:'flare-on composed and reflection RGB remain finite/nonnegative',passed:['opaque','composed','reflection'].every(k=>report.flareRanges[k].countNaN===0&&report.flareRanges[k].countInf===0&&report.flareRanges[k].countNegative===0)});
    }
    report.passed=report.checks.every(c=>c.passed);report.passedCount=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;report.limits=['Actual scene at fixed physical phase, ordinary SDR export; no calibrated nits or measured pyrotechnic cd claim.','Persistent smoke, transient cloud illumination and local GI are subsequent R2 work, not present in this capture.','Optional flare pair is the same single finite-energy image PSF; it does not illuminate physical objects.'];return report;
  }finally{await restore(a,s);}
}
