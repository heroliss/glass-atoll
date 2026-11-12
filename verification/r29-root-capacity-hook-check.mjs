import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),stage=read('verification/r29-capacity-staging/main.js'),checks=[];
async function check(name,fn){try{checks.push({name,passed:true,evidence:await fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
await check('Staged main differs only by four explicit daily budgets and three diagnostic methods',()=>{
  let inverse=stage;const methods=[];for(const title of ['Source','Light','Joint']){const prefix='    async runR29'+title+'PeakCheck(',rows=inverse.split('\n').filter(x=>x.startsWith(prefix));assert.equal(rows.length,1);methods.push(prefix.trim());inverse=inverse.replace(rows[0]+'\n','');}
  assert.equal(inverse.split('4000000').length,5);inverse=inverse.replaceAll('4000000','1400000');assert.equal(inverse,read('verification/baselines/r29-before-capacity/main.js'));return{dailyBudgetEdits:4,methods,stagedSHA256:sha(stage)};
});
for(const title of ['Source','Light','Joint'])await check(title+' method preserves exclusive ownership and trusted factories on success and every failure path',async()=>{
  const methodName='runR29'+title+'PeakCheck',raw=stage.split('\n').find(x=>x.startsWith('    async '+methodName+'(')).trim().replace(/,$/,'');let imports=0,calls=0,clock=0,mode='ok';
  const trustedT=()=>{},trustedL=()=>{},entry='runR29'+title+'PeakGPUCheck';
  const env={qaRenderLock:false,qaFrozenWorkload:false,renderBenchmark:{active:false},graphicsContextInterrupted:false,parameters:{paused:true},lastPausedRenderKey:'before',THREE:{},renderer:{},createSmokeTransmissionGPU:trustedT,clock:{getDelta(){clock++;}},async mockImport(n){imports++;if(mode==='import')throw Error('import fault');return n.includes('gpu-check')?{[entry]:async(_t,_r,o)=>{calls++;assert(env.qaRenderLock);assert.equal(o.parentLocked,true);assert.equal(o.createTransmission,trustedT);assert.equal(o.createLightField,trustedL);if(mode==='helper')throw Error('helper fault');return{fixedNative:true};}}:{createPyroSmokeLightField:trustedL};}};
  const method=raw.replaceAll("import('./","mockImport('./"),fn=Function('env','with(env){return ({'+method+'}).'+methodName+';}')(env);
  for(const patch of [{qaRenderLock:true},{qaFrozenWorkload:true},{renderBenchmark:{active:true}},{graphicsContextInterrupted:true},{parameters:{paused:false}}]){const saved={...env};Object.assign(env,patch);await assert.rejects(fn());assert.equal(imports,0);assert.equal(calls,0);Object.assign(env,saved);}
  assert.deepEqual(await fn({parentLocked:false,createTransmission(){throw Error('untrusted');},createLightField(){throw Error('untrusted');}}),{fixedNative:true});
  for(mode of ['helper','import']){await assert.rejects(fn());assert.equal(env.qaRenderLock,false);assert.equal(env.parameters.paused,true);assert.equal(env.lastPausedRenderKey,null);}assert.equal(clock,3);return{earlyGuards:5,finallyPaths:3,trustedOverrides:true};
});
await check('Only two pack capacity literals and one light capacity literal change actual algorithms; other staged modules only relocate imports',()=>{
  const dir='verification/r29-capacity-staging/',baseline='verification/baselines/r29-before-capacity/';
  assert.equal(read(dir+'pyro-smoke-transmission-pack.js').replaceAll('4000000','1400000'),read(baseline+'pyro-smoke-transmission-pack.js'));
  assert.equal(read(dir+'pyro-smoke-light-tiles.js').replace('4000000','1400000').replace("from '../../smoke-transmission-rectangles.js'","from './smoke-transmission-rectangles.js'"),read(baseline+'pyro-smoke-light-tiles.js'));
  assert.equal(read(dir+'smoke-transmission-layout.js'),read(baseline+'smoke-transmission-layout.js'));
  assert.equal(read(dir+'pyro-smoke-transmission-gpu.js').replace("from '../../pyro-smoke-renderer.js'","from './pyro-smoke-renderer.js'").replace("from '../../smoke-transmission-rectangles.js'","from './smoke-transmission-rectangles.js'"),read(baseline+'pyro-smoke-transmission-gpu.js'));
  assert.equal(read(dir+'pyro-smoke-light-field.js').replace("from '../../pyro-smoke-light-bound.js'","from './pyro-smoke-light-bound.js'"),read(baseline+'pyro-smoke-light-field.js'));
  assert.equal(read(dir+'pyro-smoke-light-native-state.js'),read(baseline+'pyro-smoke-light-native-state.js'));
  return{opticalShaderOrSchedulerEdits:0,capacityLiterals:3};
});
const r={schema:'glass-atoll.r29-root-capacity-hook-cpu.v1',actualGPU:false,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},checks};
fs.writeFileSync(new URL('./r29-root-capacity-hook-check.json',import.meta.url),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({passed:r.passed,counts:r.counts,failed:checks.filter(x=>!x.passed)},null,2));if(!r.passed)process.exitCode=1;
