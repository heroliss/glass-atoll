import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),mainURL=new URL('main.js',root),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const before=fs.readFileSync(mainURL,'utf8');assert.equal(sha(before),'e43f1445109226a16f5fbd6ba70656a5faa6401c076ce16ce57369e055680674');
const entry=`    async runR32WaterSolarCheck(options={}){
      if(Reflect.ownKeys(options).length)throw new Error('R32 water check uses one fixed reviewed zero-source fixture; no caller overrides');
      if(qaRenderLock||qaFrozenWorkload||renderBenchmark.active||graphicsContextInterrupted||!parameters.paused||qualityApplying||qaSmokeVariants||inspection||throwGesture||pendingThrow||transition||parameters.director.mode!=='off'||fireworks.diagnostics().active||fireworks.diagnostics().queued||pyroSmoke.packetCount)throw new Error('Pause an empty healthy scene with no interaction or diagnostic first');
      const entryKey=JSON.stringify(frozenWorkloadInfo());qaRenderLock=true;let bridge=null,result=null;
      try{
        const {runR32WaterSolarCheck}=await import('./verification/r32-water-solar-gpu-check.js');
        if(JSON.stringify(frozenWorkloadInfo())!==entryKey||graphicsContextInterrupted||!parameters.paused)throw new Error('Scene changed while loading water check; original user action preserved');
        bridge=createR32WaterSolarBridge();
        result=await runR32WaterSolarCheck(THREE,renderer,{parentLocked:true,bridge});
        return result;
      }finally{
        try{const restored=bridge?.restore();if(result&&restored){result.rootRestoration=restored;if(!restored.passed){result.measurementPassed=result.passed;result.passed=false;}}}
        finally{clock.getDelta();qaRenderLock=false;}
      }
    },
`;
const bridge=`function createR32WaterSolarBridge(){
  const originalMesh=water.mesh,originalGeometry=water.mesh.geometry,originalMaterial=water.mesh.material,originalUniforms=water.uniforms;
  const originalParent=originalMesh.parent,originalSibling=originalParent?.children.indexOf(originalMesh),bodyInertBefore=document.body.inert;
  const entryKey=JSON.stringify(frozenWorkloadInfo());let borrowed=false,restoration=null;
  const fingerprint=()=>JSON.stringify(frozenWorkloadInfo());
  function borrow(){
    if(borrowed||restoration||fingerprint()!==entryKey||!parameters.paused||graphicsContextInterrupted)throw new Error('Water fixture changed or was already borrowed');
    const buffer=renderer.getDrawingBufferSize(new THREE.Vector2());
    if(buffer.x!==1209||buffer.y!==1292||originalUniforms.uSunIrradiance.value!==0||originalUniforms.uSubmergedCount.value!==0||originalUniforms.uDebugMode.value!==0)throw new Error('R32 first fixture requires native1209x1292, exact zero key, no props and debug0');
    borrowed=true;document.body.inert=true;
    return Object.freeze({mesh:originalMesh,camera:camera.clone(),width:buffer.x,height:buffer.y,frame:structuredClone(frameSnapshot),waterDiagnostics:water.diagnostics(),phaseTime:time,bodyInertBefore});
  }
  function restore(){
    if(restoration)return restoration;
    const errors=[];
    if(water.mesh!==originalMesh||originalMesh.geometry!==originalGeometry||originalMesh.material!==originalMaterial||water.uniforms!==originalUniforms||originalMesh.parent!==originalParent||originalParent?.children.indexOf(originalMesh)!==originalSibling)errors.push('Original water mesh/material/geometry/uniforms/parent changed');
    const intentUnchanged=fingerprint()===entryKey;
    if(!intentUnchanged)errors.push('User scene intent changed; no original values were overwritten');
    document.body.inert=bodyInertBefore;
    restoration={changed:borrowed,passed:errors.length===0&&!graphicsContextInterrupted,errors,userIntentOverwritten:false,originalRefs:errors.length===0,drawsSubmitted:0,bodyInertRestored:document.body.inert===bodyInertBefore};return restoration;
  }
  return Object.freeze({revision:'r32-borrowed-water-bridge-v1',factory:createR32WaterSolarBridge,fingerprint,borrow,restore});
}
`;
const anchor='    async runR31NativePhaseProfile(options={}){';assert.equal(before.split(anchor).length,2);assert.equal(before.split('function frame(){').length,2);
const after=before.replace(anchor,entry+anchor).replace('function frame(){',bridge+'function frame(){');
assert.equal(after.replace(entry,'').replace(bridge,''),before);
const archive=new URL('verification/baselines/r32-before-water-entry/',root);fs.mkdirSync(archive,{recursive:false});fs.writeFileSync(new URL('main.js',archive),before,{flag:'wx'});
fs.writeFileSync(mainURL,after);
fs.writeFileSync(new URL('verification/r32-main-water-integration.json',root),JSON.stringify({schema:'glass-atoll.r32-water-qa-entry-integration.v1',passed:true,actualGPU:false,beforeMainSHA256:sha(before),afterMainSHA256:sha(after),exactInverse:true,changesOnlyQAEntryAndCPUBridge:true,normalFrameUnchanged:true,productionWaterUnchanged:true,bridgeSHA256:sha(bridge.trim()),entrySHA256:sha(entry.trim()),limits:['No new rendering occurred in this integration. First fixture is a borrowed original empty paused night and one32x32 native-pixel scissor.','Only the separately reviewed helper may draw owned material clones/target; original scene and approved audio are untouched.']},null,2)+'\n');
console.log(JSON.stringify({passed:true,before:sha(before),after:sha(after),bridgeSHA256:sha(bridge.trim())}));
