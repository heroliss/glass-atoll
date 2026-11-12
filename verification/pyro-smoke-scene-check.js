const wait=ms=>new Promise(r=>setTimeout(r,ms));
const settle=async()=>{for(let i=0;i<45;i++)await new Promise(r=>requestAnimationFrame(r));};
const finite=r=>['opaque','composed','reflection'].every(k=>r[k].countNaN===0&&r[k].countInf===0&&r[k].countNegative===0);
async function pixels(url){const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}
async function difference(a,b){const x=await pixels(a),y=await pixels(b);let squared=0,changed=0,maximum=0;for(let i=0;i<x.length;i+=4){let d=0;for(let c=0;c<3;c++){const delta=x[i+c]-y[i+c];squared+=delta*delta;d=Math.max(d,Math.abs(delta));}if(d)changed++;maximum=Math.max(maximum,d);}return{changedPixels:changed,maximumByteDifference:maximum,rmsByteDifference:Math.sqrt(squared/(x.length/4*3))};}

export async function runSmokeSceneCheck(a,{restoreScene=true}={}){
  const saved={clock:a.celestial(),sun:a.state.parameters.sun,lens:a.state.parameters.lens,camera:a.state.camera,target:a.state.target,paused:a.state.parameters.paused,fireworks:a.fireworks().settings};
  const report={date:new Date().toISOString(),checks:[],images:{},runtimeErrors:[]},check=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,evidence});
  const onError=e=>report.runtimeErrors.push({message:e.message,stack:String(e.error?.stack||''),time:a.state.time});window.addEventListener('error',onError);
  try{
    a.setDirector({mode:'off'});a.setFireworks({autoLaunch:false});a.pause(false);
    const deadline=performance.now()+30000;while((a.fireworks().active||a.fireworks().queued)&&performance.now()<deadline)await wait(80);
    if(a.fireworks().active||a.fireworks().queued)throw new Error('Existing events have not finished; this test never deletes them.');
    await a.timePreset('moon');await a.setTime({running:false});a.setLens({focal:28,exposure:0,dof:false,opticalFlare:false});a.setCamera([-48,12,-40],[0,2.5,0]);
    a.setFireworks({type:'ring',autoLaunch:false,autoDirection:true,autoFrame:true,elevation:80,persistentSmoke:true,cloudIllumination:true,intensityScale:1});a.clearSmoke();
    await wait(4000);const launch=a.launchFirework();report.launch=launch;
    while(a.state.time<launch.burstTime+1.1)await wait(15);a.pause(true);await settle();
    report.hot={time:a.state.time,smoke:a.smoke(),snapshot:a.smokeSnapshot(),photometry:a.photometry(),camera:a.state.camera,target:a.state.target,fireworks:a.fireworks(),range:await a.inspectRadiance()};report.images.hot=a.screenshot();
    check('live event stream creates18 independent persistent packets',report.hot.smoke.state.packetCount===18&&report.hot.smoke.events.injectedEvents===2,{packets:report.hot.smoke.state.packetCount,sources:report.hot.smoke.events.injectedEvents});
    check('production main volume pass is present at the selected phase',report.hot.smoke.rendering.lastRender?.reflection===false&&report.hot.smoke.rendering.lastRender.instances>0,report.hot.smoke.rendering.lastRender);
    check('hot actual composed and mirror HDR are finite nonnegative',finite(report.hot.range));
    check('combined source budget fits FP16 headroom',report.hot.photometry.storedBound<=report.hot.photometry.safeMaximum,{bound:report.hot.photometry.storedBound,safe:report.hot.photometry.safeMaximum});
    a.setFireworks({persistentSmoke:false});await settle();report.images.hidden=a.screenshot();report.hidden={time:a.state.time,range:await a.inspectRadiance(),snapshot:a.smokeSnapshot(),photometry:a.photometry()};
    check('hiding smoke preserves physical time and material mass',report.hidden.time===report.hot.time&&report.hidden.snapshot.ledger.airborne===report.hot.snapshot.ledger.airborne);
    check('hidden volume path still yields finite main and mirror',finite(report.hidden.range));
    report.hotVisibleDifference=await difference(report.images.hot,report.images.hidden);check('volume contributes to the actual fixed-phase exported image',report.hotVisibleDifference.changedPixels>16,report.hotVisibleDifference);
    a.setFireworks({persistentSmoke:true});a.pause(false);
    while(a.state.time<launch.burstTime+22)await wait(60);a.pause(true);await settle();
    report.cold={time:a.state.time,smoke:a.smoke(),snapshot:a.smokeSnapshot(),fireworks:a.fireworks(),photometry:a.photometry(),range:await a.inspectRadiance()};report.images.cold=a.screenshot();
    check('cold smoke outlives retired energetic events',report.cold.fireworks.active===0&&report.cold.smoke.state.packetCount===18&&report.cold.smoke.state.ledger.airborne===report.hot.smoke.state.ledger.airborne,{active:report.cold.fireworks.active,age:report.cold.time-launch.burstTime,mass:report.cold.smoke.state.ledger.airborne});
    check('cold volume is still drawn and HDR remains finite',report.cold.smoke.rendering.lastRender.instances>0&&finite(report.cold.range));
    check('paused physical density remains exactly stable',JSON.stringify(a.smokeSnapshot())===JSON.stringify(report.cold.snapshot));
    check('no production-frame exceptions during the integrated scenario',report.runtimeErrors.length===0,{count:report.runtimeErrors.length,first:report.runtimeErrors[0]});
    report.passed=report.checks.every(c=>c.passed);report.passedCount=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;
    report.limits=['Actual scene at authored source scale1; not an absolute pyrotechnic light calibration.','Wind was set through the native wind control before this test; residual wind smoothing is recorded in physical state.','22-second actual persistence verifies integration; 1800-second state behavior is separately CPU-verified.','Conditional-mean scatter/centre ordering, no light-to-smoke self-extinction, no new local GI, no CFD/settling/ground fold.'];return report;
  }finally{
    window.removeEventListener('error',onError);
    a.pause(true);
    if(restoreScene){a.setLens(saved.lens);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.setCamera(saved.camera,saved.target);a.setFireworks(saved.fireworks);a.pause(saved.paused);}
  }
}
