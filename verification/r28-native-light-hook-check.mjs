import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const before=read('verification/baselines/r28-before-native-light/main.js'),main=read('main.js'),checks=[];
async function check(name,fn){try{checks.push({name,passed:true,evidence:await fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
const rows=main.split('\n').filter(x=>x.startsWith('    async runCompleteNativeLightCheck('));
await check('Only one paused exclusive lazy QA method was added; every other main byte is unchanged',()=>{assert.equal(rows.length,1);assert.equal(main.replace(rows[0]+'\n',''),before);return{mainSHA256:hash(main),productionPolicyUnchanged:true};});
await check('All four unsafe states reject before imports, factory or rendering',async()=>{
  let imports=0,calls=0,clocks=0,mode='ok';const trusted=()=>{},env={qaRenderLock:false,qaFrozenWorkload:false,graphicsContextInterrupted:false,parameters:{paused:true},lastPausedRenderKey:'before',THREE:{},renderer:{},clock:{getDelta(){clocks++;}},async mockImport(name){imports++;if(mode==='import')throw Error('owned import failure');return name.includes('gpu-check')?{runCompleteNativeLightGPUCheck:async(_t,_r,o)=>{calls++;assert(env.qaRenderLock);assert.equal(o.parentLocked,true);assert.equal(o.createField,trusted);if(mode==='helper')throw Error('owned helper failure');return{completeNative:true};}}:{createExactSmokeLightFieldCandidate:trusted};}};
  const method=rows[0].trim().replace(/,$/,'').replaceAll("import('./verification/","mockImport('./verification/");
  const fn=Function('env','with(env){return ({'+method+'}).runCompleteNativeLightCheck;}')(env);
  for(const patch of [{qaRenderLock:true},{qaFrozenWorkload:true},{graphicsContextInterrupted:true},{parameters:{paused:false}}]){const saved={...env};Object.assign(env,patch);await assert.rejects(fn());assert.equal(imports,0);assert.equal(calls,0);Object.assign(env,saved);}
  assert.deepEqual(await fn({parentLocked:false,createField(){throw Error('untrusted');}}),{completeNative:true});
  for(mode of ['helper','import']){await assert.rejects(fn());assert.equal(env.qaRenderLock,false);assert.equal(env.parameters.paused,true);assert.equal(env.lastPausedRenderKey,null);}
  assert.equal(clocks,3);return{earlyGuards:4,finallyCases:3,trustedOverrides:true};
});
await check('Original physical/lighting implementations, package and accepted audio are unchanged before hardware candidate phase',()=>{
  const start=JSON.parse(read('verification/r28-start-pins.json'));
  for(const[n,p]of Object.entries(start.source)){if(n==='main.js')continue;assert.equal(hash(Buffer.from(read(n))),p.sha256,n);}
  assert.equal(hash(Buffer.from(read('fireworks-audio.js'))),'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
  return{unchanged:8,audioUnchanged:true};
});
const report={schema:'glass-atoll.r28-native-light-hook-check.v1',actualGPU:false,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},checks};
fs.writeFileSync(new URL('./r28-native-light-hook-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;
