// CPU-only review of the actual current main.js methods. No module import of
// main, renderer, browser, clock loop, shader, context or real performance run.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const start=source.indexOf('    async benchmarkFrozenSmoke(');
const end=source.indexOf('    benchmark(seconds=',start);
assert(start>=0&&end>start,'The actual frozen benchmark method must exist');
const method=source.slice(start,end).trim();
const infoStart=source.indexOf('function frozenWorkloadInfo(){');
const infoEnd=source.indexOf('\nfunction frame(){',infoStart);
assert(infoStart>=0&&infoEnd>infoStart,'The actual signature function must exist');
const infoBody=source.slice(infoStart,infoEnd);
const pauseMethod=source.match(/^    pause\(value=true\)\{[^\n]+\},/m)?.[0];
assert(pauseMethod,'Use the actual public pause intent method');

function make(paused=true){
  let resolve;
  const counters={launches:1,stones:0};
  const env={
    parameters:{paused,current:.16},qaRenderLock:false,qaFrozenWorkload:false,
    qaFrozenGuard:null,graphicsContextInterrupted:false,qaCameraExposureEV:1.5,
    interactionEpoch:0,pauseIntentEpoch:0,pauseTargetTime:null,
    radiometry:{state:{cameraEV:2}},lastPausedRenderKey:'before',time:20,
    renderScale:1,qaSmokeTransmissionField:null,fireworksSettings:{type:'peony'},
    celestialController:{state:{utcMs:123}},document:{hidden:false},
    camera:{position:{toArray:()=>[1,2,3]}},controls:{target:{toArray:()=>[0,0,0]}},
    localLights:{state:{mode:'night',lamps:[{enabled:true,brightness:.45,color:'#ffdfa5'}],flashlight:{enabled:false,brightness:.7}}},
    fireworks:{diagnostics:()=>({activeEvents:[{id:1}],launches:counters.launches})},
    stoneThrow:{diagnostics:()=>({counters:{launched:counters.stones}})},
    pyroSmoke:{packetCount:8,setProjectionMode(value){if(value==='bad')throw new Error('bad projection');},setLightingBakeMode(){}},
    updateScenePhotometry(){},ui:{setPaused(){}},clock:{getDelta(){}}
  };
  env.renderBenchmark={active:false,start(){this.active=true;return new Promise(r=>{resolve=r;});},cancel(reason){this.active=false;resolve({status:'cancelled',validity:'invalid',averageFps:null,reason,frames:10});}};
  env.frozenWorkloadInfo=new Function('env','with(env){return ('+infoBody+');}')(env);
  const api=new Function('env','with(env){return ({'+pauseMethod+'\n'+method+'});}')(env);
  return{env,api,counters,finish(result={status:'completed',validity:'valid',averageFps:60,frames:10}){env.renderBenchmark.active=false;resolve(result);}};
}

const checks=[];
async function check(name,fn){try{await fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
function cleaned(env){assert.equal(env.qaFrozenWorkload,false);assert.equal(env.qaFrozenGuard,null);assert.equal(env.qaCameraExposureEV,1.5);}
function invalid(result){assert.equal(result.validity,'invalid');assert.equal(result.status,'cancelled');assert.equal(result.averageFps,null);assert.equal(result.workload.interrupted,true);}

await check('setup exception restores every temporary flag',async()=>{
  const {env,api}=make(true);await assert.rejects(api.benchmarkFrozenSmoke({projectionMode:'bad'}),/bad projection/);cleaned(env);assert.equal(env.parameters.paused,true);
});
await check('context loss preserves fault pause and invalid result',async()=>{
  const {env,api}=make(false),pending=api.benchmarkFrozenSmoke();env.graphicsContextInterrupted=true;env.parameters.paused=true;env.renderBenchmark.cancel('webgl-context-lost');invalid(await pending);cleaned(env);assert.equal(env.parameters.paused,true);
});
await check('explicit same-value play intent is preserved',async()=>{
  const {env,api,finish}=make(true),pending=api.benchmarkFrozenSmoke();api.pause(false);finish();invalid(await pending);cleaned(env);assert.equal(env.parameters.paused,false);
});
await check('input immediately before timeout is rejected without next RAF',async()=>{
  const {env,api,finish}=make(true),pending=api.benchmarkFrozenSmoke();env.parameters.current=.25;finish();const result=await pending;invalid(result);assert.notEqual(JSON.stringify(result.workload.before),JSON.stringify(result.workload.after));cleaned(env);
});
await check('local lamp brightness is represented in final signature',async()=>{
  const {env,api,finish}=make(true),pending=api.benchmarkFrozenSmoke();env.localLights.state.lamps[0].brightness=.9;finish();invalid(await pending);cleaned(env);
});
await check('unchanged workload completes and restores original pause',async()=>{
  const {env,api,finish}=make(true),pending=api.benchmarkFrozenSmoke();finish();const result=await pending;assert.equal(result.validity,'valid');assert.equal(result.workload.interrupted,false);assert.equal(JSON.stringify(result.workload.before),JSON.stringify(result.workload.after));cleaned(env);assert.equal(env.parameters.paused,true);
});
await check('raw user action epoch cancels even a no-value-change input',async()=>{
  const {env,api,finish}=make(true),pending=api.benchmarkFrozenSmoke();env.interactionEpoch++;finish();invalid(await pending);cleaned(env);
});
await check('hidden page or renderer lock cannot produce a valid timeout result',async()=>{
  for(const key of ['hidden','qaRenderLock']){const {env,api,finish}=make(true),pending=api.benchmarkFrozenSmoke();if(key==='hidden')env.document.hidden=true;else env.qaRenderLock=true;finish();invalid(await pending);cleaned(env);}
});
await check('fewer than two drawn frames is explicitly invalid',async()=>{
  const {env,api,finish}=make(true),pending=api.benchmarkFrozenSmoke();finish({status:'completed',validity:'valid',averageFps:0,frames:0});invalid(await pending);cleaned(env);
});

const report={scope:'Pure CPU extraction with stubs of actual main methods; not DOM delivery, GPU correctness or native benchmark acceptance',sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),methodSHA256:crypto.createHash('sha256').update(method+infoBody+pauseMethod).digest('hex'),passed:checks.every(x=>x.passed),checks};
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
