const wait=ms=>new Promise(r=>setTimeout(r,ms));
const settle=async()=>{for(let i=0;i<45;i++)await new Promise(r=>requestAnimationFrame(r));};
const finite=r=>['opaque','composed','reflection'].every(k=>!r[k].countNaN&&!r[k].countInf&&!r[k].countNegative);

export async function runSmokeLightModelCheck(a){
  if(a.state.parameters.wind!==0)throw new Error('Set the native wind control to0 before this comparison.');
  const report={date:new Date().toISOString(),checks:[],cases:[]},check=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,evidence});
  const errors=[],onError=e=>errors.push({message:e.message,stack:String(e.error?.stack||'')});window.addEventListener('error',onError);
  try{
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const deadline=performance.now()+30000;while((a.fireworks().active||a.fireworks().queued)&&performance.now()<deadline)await wait(80);
    if(a.fireworks().active||a.fireworks().queued)throw new Error('Existing events did not retire naturally.');
    await a.timePreset('moon');await a.setTime({running:false});a.setLens({focal:28,exposure:0,dof:false,opticalFlare:false});a.setCamera([-48,12,-40],[0,2.5,0]);
    a.setFireworks({type:'ring',intensityScale:1,elevation:80,autoDirection:true,autoFrame:true,persistentSmoke:true,cloudIllumination:true,clusterModel:'legacy',finiteClusterPhase:false});a.clearSmoke();await wait(4000);
    const launch=a.launchFirework({seed:42}),target=launch.burstTime+1.1;a.pauseAtPhysicalTime(target);const pauseDeadline=performance.now()+20000;
    while(!a.state.parameters.paused&&performance.now()<pauseDeadline)await wait(10);
    if(a.state.time!==target||!a.state.parameters.paused)throw new Error('Exact physical pause was not reached.');
    const physical=JSON.stringify(a.smokeSnapshot()),pose=JSON.stringify([a.state.camera,a.state.target]),I=[];
    for(const [name,clusterModel,finiteClusterPhase]of [['legacy-point','legacy',false],['legacy-finite','legacy',true],['moments-point','moments',false],['moments-finite','moments',true]]){
      a.setFireworks({clusterModel,finiteClusterPhase});await settle();const clusters=a.fireworkClusters(),p=a.photometry(),range=await a.inspectRadiance();
      const current={name,clusterModel,finiteClusterPhase,time:a.state.time,image:a.screenshot(),clusters,photometry:p,smoke:a.smoke(),range,camera:a.state.camera,target:a.state.target};report.cases.push(current);
      check(`${name}: phase pose and physical density are unchanged`,a.state.time===target&&JSON.stringify([a.state.camera,a.state.target])===pose&&JSON.stringify(a.smokeSnapshot())===physical);
      check(`${name}: actual RGB/headroom and requested model are valid`,finite(range)&&p.storedBound<=p.safeMaximum&&current.smoke.rendering.lastRender.finiteClusterPhase===finiteClusterPhase,{P:p.storageEV,C:p.cameraEV,draw:current.smoke.rendering.lastRender});
      I.push(JSON.stringify(clusters.map(l=>({position:l.position,color:l.color,I:l.referenceCandela}))));
    }
    check('all four models retain exactly the same raw source positions/color/intensity',I.every(x=>x===I[0]));
    check('camera photography C remains fixed',report.cases.every(c=>Math.abs(c.photometry.cameraEV-report.cases[0].photometry.cameraEV)<1e-8));
    check('no integrated frame exceptions',errors.length===0,{errors});
    report.launch=launch;report.passed=report.checks.every(c=>c.passed);report.passedCount=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;report.runtimeErrors=errors;
    report.limits=['Same actual event/physical time/density/pose and C. P is independently budgeted and recorded, not forcibly overridden.','RMS proxy and isotropic interior are separate low-frequency approximations; neither is exact area-light integration for a planar smiley.','No source gain, mass, PSF, camera exposure, or particle trajectory is changed.','This comparison leaves the final moments+finite model paused for inspection.'];return report;
  }finally{window.removeEventListener('error',onError);a.pause(true);}
}
