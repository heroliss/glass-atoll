// Direct live-vs-sealed-adapter comparison: no source-code inverse assumptions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createFireworks} from '../fireworks.js';
import {FIREWORK_TYPES} from '../fireworks-physics.js';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createPyroSmokeLogicalEvents as logicalCurrent} from '../pyro-smoke-logical-events.js';
import {createPyroSmokeTrajectoryEvents as current} from '../pyro-smoke-trajectory-events.js';
const root=new URL('../',import.meta.url),source=fs.readFileSync(new URL('./baselines/r22-before-powered-smoke/pyro-smoke-trajectory-events.js',import.meta.url),'utf8').replaceAll(/from '\.\/([^']+)'/g,(_,file)=>'from '+JSON.stringify(new URL(file,root).href)),baseline=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createPyroSmokeTrajectoryEvents;
const logicalSource=fs.readFileSync(new URL('./baselines/r22-before-powered-smoke/pyro-smoke-logical-events.js',import.meta.url),'utf8').replaceAll(/from '\.\/([^']+)'/g,(_,file)=>'from '+JSON.stringify(new URL(file,root).href)),logicalBaseline=(await import('data:text/javascript;base64,'+Buffer.from(logicalSource).toString('base64'))).createPyroSmokeLogicalEvents;
const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}},near=(a,b)=>assert(Math.abs(a-b)<1e-9);
function run(type,options={},clear=false,logical=false){
  const f=createFireworks(THREE);f.configure({autoLaunch:false,autoDirection:false,azimuth:104,elevation:80});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type,seed:44}),states=[0,1].map(()=>createPyroSmokeState({capacity:65536,...(options.dispersionModel==='taylor'?{dispersionModel:'taylor',lagrangianSeconds:10}: {})})),logs=[[],[]],adapters=(logical?[logicalBaseline,logicalCurrent]:[baseline,current]).map((factory,i)=>factory({state:{snapshot:()=>states[i].snapshot(),diagnostics:()=>states[i].diagnostics(),queueEmission(e){logs[i].push(structuredClone(e));return states[i].queueEmission(e);}},sourceProvider:f.smokeSourceProvider,...options}));
  const end=launch.burstTime+8;
  function step(time){const wind=time<1?[0,0,0]:time<3?[.8,0,.2]:[-.2,0,.3];f.update({time,windVector:wind});const events=f.drainEvents(),copy=JSON.stringify(events);for(let i=0;i<2;i++){adapters[i].consume(events,{throughTime:time,windVector:wind});states[i].setWind({time,velocity:wind});states[i].advanceTo(time);}assert.equal(JSON.stringify(events),copy);assert.deepEqual(logs[1],logs[0]);assert.deepEqual(states[1].snapshot(),states[0].snapshot());assert.deepEqual(adapters[1].diagnostics(),adapters[0].diagnostics());if(!logical)assert.deepEqual(adapters[1].pendingSourcePlans(),adapters[0].pendingSourcePlans());}
  for(const time of [0,.1,.3,.7,1,2,3,launch.burstTime+.1,launch.burstTime+.3,launch.burstTime+.7,launch.burstTime+1,launch.burstTime+3,end].sort((a,b)=>a-b)){
    step(time);
    if(clear&&time===1){for(let i=0;i<2;i++){states[i]=createPyroSmokeState({time:states[i].snapshot().time,capacity:65536,...(options.dispersionModel==='taylor'?{dispersionModel:'taylor',lagrangianSeconds:10}: {})});adapters[i].clearForState(states[i],{time:states[i].snapshot().time});}assert.deepEqual(adapters[1].diagnostics(),adapters[0].diagnostics());}
  }
  const result={type,packets:logs[1].length,options,clear,logical};near(adapters[0].diagnostics().accountingResidual,0);for(const a of adapters)a.dispose();f.dispose();return result;
}
check('all ten native ordinary point/.20/12/two-births values are exactly sealed-baseline equivalent',()=>FIREWORK_TYPES.map(t=>run(t.id)));
check('ordinary continuous profiles and Taylor/48 option values stay exactly equivalent',()=>[
  run('ring',{kernelModel:'past-segment-v2',centralFraction:.05,trajectorySlots:48}),
  run('chrysanthemum',{kernelModel:'past-segment-v2',centralFraction:.05,trajectorySlots:48,dispersionModel:'taylor'}),
  run('ring',{kernelModel:'past-segment-v2',centralFraction:.05,trajectorySlots:48,dispersionModel:'taylor',emissionProfile:'ring-uniform-burn-v1'}),
  run('palm',{kernelModel:'past-segment-v2',centralFraction:.05,trajectorySlots:48,dispersionModel:'taylor',emissionProfile:'palm-fan-uniform-burn-v1'}),
  run('fan',{kernelModel:'past-segment-v2',centralFraction:.05,trajectorySlots:48,dispersionModel:'taylor',emissionProfile:'palm-fan-uniform-burn-v1'})
]);
check('ordinary clear tombstones reserved budget and IDs stay exactly equivalent',()=>[run('chrysanthemum',{},true),run('fan',{},true)]);
check('all ten ordinary logical-all source values remain exactly sealed-baseline equivalent',()=>FIREWORK_TYPES.map(t=>run(t.id,{},false,true)));
const report={schema:'glass-atoll.r22-smoke-ordinary-equivalence.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,limits:['CPU exact value comparison of source scheduling, packets, physical state and published diagnostics. No renderer/GPU result.']};fs.writeFileSync(new URL('./r22-smoke-ordinary-equivalence-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
