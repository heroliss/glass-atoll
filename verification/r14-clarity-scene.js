const clone=x=>structuredClone(x),raf=()=>new Promise(requestAnimationFrame),json=x=>JSON.stringify(x);
export async function runClarityScene(a){
 const r={schema:'glass-atoll.r14-clarity-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,checks:[],captures:[],images:{},errors:[]},check=(name,passed)=>r.checks.push({name,passed:!!passed}),error=e=>r.errors.push(String(e.message||e.reason||e));
 window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);
 try{
  a.pause(true);a.setDirector({mode:'off'});await a.timePreset('day');await a.setTime({running:false});a.setCamera([53,9,27],[19,-.1,1]);a.setSea({clarity:.9});const c=a.photometry().cameraEV;a.setDiagnosticCameraEV(c);
  const base=clone(a.state),frozen={time:base.time,utc:a.celestial().utcMs,camera:base.camera,target:base.target,quality:base.parameters.qualityPreset,wind:base.parameters.wind,swell:base.parameters.sea.swellHeight,windSea:base.parameters.sea.windSea,matter:json(a.smokeSnapshot()),interaction:json(a.interactions())};
  for(const[index,clarity]of [.9,.3,0,1,.9].entries()){
   a.setSea({clarity});for(let i=0;i<80;i++)await raf();const key=String(Math.round(clarity*100))+(index===4?'_repeat':''),state=clone(a.state),photo=clone(a.photometry()),water=clone(a.waterDiagnostics()),range=await a.inspectRadiance(),gl=a.readGLErrors('clarity '+key);
   r.images[key]=a.screenshot();r.captures.push({key,clarity,state,photo,water,range,gl});
   check(key+': same camera physical clock wave wind quality matter and interactions',state.time===frozen.time&&a.celestial().utcMs===frozen.utc&&Math.hypot(...state.camera.map((v,i)=>v-frozen.camera[i]))<1e-9&&Math.hypot(...state.target.map((v,i)=>v-frozen.target[i]))<1e-9&&state.parameters.qualityPreset===frozen.quality&&state.parameters.wind===frozen.wind&&state.parameters.sea.swellHeight===frozen.swell&&state.parameters.sea.windSea===frozen.windSea&&json(a.smokeSnapshot())===frozen.matter&&json(a.interactions())===frozen.interaction&&photo.cameraEV===c);
   check(key+': live water and native control match requested clarity',water.optics.clarity===clarity&&state.parameters.sea.clarity===clarity&&Number(document.getElementById('water-clarity').value)===Math.round(clarity*100));
   check(key+': three actual HDR buffers finite nonnegative safe',['opaque','composed','reflection'].every(k=>range[k]?.stateRestored&&range[k]?.counterConsistency&&!range[k].countNaN&&!range[k].countInf&&!range[k].countNegative&&range[k].globalMax<=photo.safeMaximum*(1+1e-4)));
  }
  check('runtime and graphics remain valid',!r.errors.length&&!a.state.graphicsContextInterrupted&&r.captures.every(v=>!v.gl.errors.length));
 }catch(e){r.error=String(e.stack||e);check('complete actual clarity sweep',false);}
 finally{a.pause(true);a.setDiagnosticCameraEV(null);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);}
 r.counts={passed:r.checks.filter(c=>c.passed).length,total:r.checks.length};r.passed=r.checks.every(c=>c.passed);r.limits=['Authored RGB suspended-particle control, not measured NTU/Secchi or full-spectrum calibration.','Fixed real scene state/photography; readbacks and paused settling are not FPS or GPU timing.','Default90 restored, diagnostic camera exposure cleared. No wider water/shoreline goal acceptance.'];return r;
}
