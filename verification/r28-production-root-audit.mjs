import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),main=read('main.js'),checks=[];
async function check(name,fn){try{checks.push({name,passed:true,evidence:await fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
await check('Actual main is the reviewed three-route staging plus exactly one locked lazy production QA method',()=>{
  const rows=main.split('\n').filter(x=>x.startsWith('    async runProductionNativeLightCheck('));assert.equal(rows.length,1);
  assert.equal(main.replace(rows[0]+'\n',''),read('verification/r28-production-staging/main.js'));
  assert.equal(main.split('lightFieldMaxRequestPairs:1400000,lightFieldMaxMapPairs:1000000,lightFieldMaxMapDraws:8').length,4);
  return{mainSHA256:hash(main),dailyRoutes:3};
});
await check('Seven deployed modules equal reviewed staging with only declared dependency import relocations',()=>{
  const pins=JSON.parse(read('verification/r28-production-staging-pins.json'));let compared=0;
  for(const[name,p]of Object.entries(pins.source)){if(name==='main.js')continue;let stage=read('verification/r28-production-staging/'+name);assert.equal(hash(stage),p.sha256);
    if(name==='pyro-smoke-light-field.js')stage=stage.replace("from '../../pyro-smoke-light-bound.js'","from './pyro-smoke-light-bound.js'");
    if(name==='pyro-smoke-light-tiles.js')stage=stage.replace("from '../../smoke-transmission-rectangles.js'","from './smoke-transmission-rectangles.js'");
    assert.equal(read(name),stage,name);compared++;
  }return{comparedNonMain:compared,relocations:2};
});
await check('Production QA method rejects unsafe ownership states, overrides untrusted factory and restores all finally paths',async()=>{
  const raw=main.split('\n').find(x=>x.startsWith('    async runProductionNativeLightCheck(')).trim().replace(/,$/,'');
  let imports=0,calls=0,clock=0,mode='ok';const trusted=()=>{},env={qaRenderLock:false,qaFrozenWorkload:false,graphicsContextInterrupted:false,parameters:{paused:true},lastPausedRenderKey:'before',THREE:{},renderer:{},clock:{getDelta(){clock++;}},async mockImport(n){imports++;if(mode==='import')throw Error('import failure');return n.includes('gpu-check')?{runProductionNativeLightGPUCheck:async(_t,_r,o)=>{calls++;assert(env.qaRenderLock);assert.equal(o.parentLocked,true);assert.equal(o.createField,trusted);if(mode==='helper')throw Error('helper failure');return{completeNative:true};}}:{createPyroSmokeLightField:trusted};}};
  const method=raw.replaceAll("import('./","mockImport('./"),fn=Function('env','with(env){return ({'+method+'}).runProductionNativeLightCheck;}')(env);
  for(const change of [{qaRenderLock:true},{qaFrozenWorkload:true},{graphicsContextInterrupted:true},{parameters:{paused:false}}]){const saved={...env};Object.assign(env,change);await assert.rejects(fn());assert.equal(imports,0);assert.equal(calls,0);Object.assign(env,saved);}
  assert.deepEqual(await fn({parentLocked:false,createField(){throw Error('untrusted');}}),{completeNative:true});
  for(mode of ['helper','import']){await assert.rejects(fn());assert.equal(env.qaRenderLock,false);assert.equal(env.parameters.paused,true);assert.equal(env.lastPausedRenderKey,null);}assert.equal(clock,3);
  return{earlyGuards:4,finallyCases:3,trustedOverrides:true};
});
await check('All remaining inherited runtime pins and accepted audio are unchanged',()=>{
  const before=JSON.parse(read('verification/r27-final-manifest.json')).source,allowed=new Set(['main.js','package.json','pyro-smoke-light-field.js','pyro-smoke-light-tiles.js','pyro-smoke.js','pyro-smoke-renderer.js']);let unchanged=0;
  for(const[n,p]of Object.entries(before))if(!allowed.has(n)){assert.equal(hash(read(n)),p.sha256,n);unchanged++;}
  assert.equal(hash(read('fireworks-audio.js')),'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');return{unchanged,audioUnchanged:true,newModule:'pyro-smoke-light-native-state.js'};
});
const r={schema:'glass-atoll.r28-production-root-audit.v1',actualGPU:false,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},checks};
fs.writeFileSync(new URL('./r28-production-root-audit.json',import.meta.url),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({passed:r.passed,counts:r.counts,failed:checks.filter(x=>!x.passed)},null,2));if(!r.passed)process.exitCode=1;
