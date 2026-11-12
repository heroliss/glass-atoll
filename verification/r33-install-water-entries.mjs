import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),url=new URL('main.js',root),before=fs.readFileSync(url,'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');assert.equal(sha(before),'3dc48edd0c6f284760275c7a86a70993acbd41c0c9b95381ab917f77c614cba1');
const entry=`    runR33WaterSolarControls(options={}){return runR33WaterSolarJob('runR33WaterSolarControls',options);},
    runR33WaterSolarTiming(options={}){return runR33WaterSolarJob('runR33WaterSolarTiming',options);},
`;
const job=`async function runR33WaterSolarJob(exportName,options){
  if(!['runR33WaterSolarControls','runR33WaterSolarTiming'].includes(exportName)||Reflect.ownKeys(options).length)throw new Error('R33 uses one fixed reviewed closed job; no caller overrides');
  if(qaRenderLock||qaFrozenWorkload||renderBenchmark.active||graphicsContextInterrupted||!parameters.paused||qualityApplying||displaySettingsApplying||refreshingDisplay||displaySettingsPending||displayRefreshPending||qaSmokeVariants||inspection||throwGesture||pendingThrow||transition||parameters.director.mode!=='off'||fireworks.diagnostics().active||fireworks.diagnostics().queued||pyroSmoke.packetCount)throw new Error('Pause an empty healthy scene after display calibration and interaction settle first');
  const key=JSON.stringify(frozenWorkloadInfo());qaRenderLock=true;let bridge=null,result=null;
  try{
    const module=await import('./verification/r33-water-solar-gpu-check.js');
    if(JSON.stringify(frozenWorkloadInfo())!==key||graphicsContextInterrupted||!parameters.paused||qualityApplying||displaySettingsApplying||refreshingDisplay)throw new Error('Scene changed during R33 loading; user action preserved');
    bridge=createR32WaterSolarBridge();result=await module[exportName](THREE,renderer,{parentLocked:true,bridge});return result;
  }finally{
    try{const restored=bridge?.restore();if(result&&restored){result.rootRestoration=restored;if(!restored.passed){result.measurementPassed=result.passed;result.passed=false;}}}
    finally{clock.getDelta();qaRenderLock=false;}
  }
}
`;
const anchor='    async runR32WaterSolarCheck(options={}){';assert.equal(before.split(anchor).length,2);assert.equal(before.split('function createR32WaterSolarBridge(){').length,2);
const after=before.replace(anchor,entry+anchor).replace('function createR32WaterSolarBridge(){',job+'function createR32WaterSolarBridge(){');assert.equal(after.replace(entry,'').replace(job,''),before);
const archive=new URL('verification/baselines/r33-before-water-entries/',root);fs.mkdirSync(archive,{recursive:false});fs.writeFileSync(new URL('main.js',archive),before,{flag:'wx'});fs.writeFileSync(url,after);
fs.writeFileSync(new URL('verification/r33-main-water-integration.json',root),JSON.stringify({schema:'glass-atoll.r33-closed-water-job-entry-integration.v1',passed:true,actualGPU:false,beforeMainSHA256:sha(before),afterMainSHA256:sha(after),exactInverse:true,normalFrameAndHDRFunctionsUnchanged:true,bridgeUnchanged:true,jobFunctionSHA256:sha(job.trim()),scope:'Two no-override QA wrappers and one guarded private caller; no image/source/quality/physics/audio change. Source pins and hardware still require separate admission.'},null,2)+'\n');console.log(JSON.stringify({passed:true,main:sha(after),jobSHA256:sha(job.trim())}));
