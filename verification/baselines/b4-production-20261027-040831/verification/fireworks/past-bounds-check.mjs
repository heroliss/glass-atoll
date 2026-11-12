import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import * as THREE from '../../vendor/three.module.js';
const root=new URL('../../',import.meta.url),baseline=new URL('../baselines/fireworks-before-past-bounds/',import.meta.url);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function factoryAt(directory){
  const source=fs.readFileSync(new URL('fireworks.js',directory),'utf8');
  const instrumented=source.replace('sampleBody,starEnvelope','sampleBody as sampleBodyRaw,starEnvelope')
    .replace("from './fireworks-physics.js'",'from '+JSON.stringify(new URL('fireworks-physics.js',directory).href))
    .replace("const rootDummyNeverPresent=0;",'')
    .replace('export function createFireworks(',`const sampleCalls=[];function sampleBody(body,time,timeline){sampleCalls.push({body,time});return sampleBodyRaw(body,time,timeline);}\nexport function createFireworks(`)
    .replace('api.configure({});return api;','api.configure({});Object.defineProperties(api,{__qaSimulation:{value:simulation},__qaCalls:{value:sampleCalls},__qaForceBoundsMiss:{value:()=>{boundsKey="";}}});return api;');
  if(!instrumented.includes('__qaSimulation')||!instrumented.includes('function sampleBody(body,time,timeline)'))throw Error('QA instrumentation failed');
  return (await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'))).createFireworks;
}
const before=await factoryAt(baseline),after=await factoryAt(root),start=performance.now(),checks=[],details=[];
let compared=0,maximumAbsoluteDifference=0,futureCompared=0,cacheHits=0;
function check(name,condition,data={}){checks.push({name,passed:!!condition,...data});if(!condition)console.error('FAIL',name,JSON.stringify(data));}
function pair(type='chrysanthemum',seed=14271){
  return [before,after].map(create=>{const effect=create(THREE,{seed,terrainHeight:()=>1});effect.setQuality({trailSegments:8});effect.update({time:0,windVector:[1.8*.936,0,1.8*.352]});effect.launch({type});effect.launch({type});return effect;});
}
function close(a,b){
  if(typeof a!==typeof b)return false;
  if(typeof a==='number'){const d=Math.abs(a-b);maximumAbsoluteDifference=Math.max(maximumAbsoluteDifference,d);return Object.is(a,b)||d<=1e-10;}
  if(a&&typeof a==='object'){if(Object.keys(a).join('|')!==Object.keys(b).join('|'))return false;return Object.keys(a).every(k=>close(a[k],b[k]));}
  return a===b;
}
function bounds(effects,{force=false}={}){
  for(const effect of effects){effect.__qaCalls.length=0;if(force)effect.__qaForceBoundsMiss();}
  const a=effects[0].getBounds(),b=effects[1].getBounds();compared++;
  if(!close(a,b))throw Error('Bounds differ at time '+effects[0].__qaSimulation.time+' '+JSON.stringify({a,b}));
  const now=effects[0].__qaSimulation.time,oldFuture=effects[0].__qaCalls.filter(c=>c.time>now),newFuture=effects[1].__qaCalls.filter(c=>c.time>now);
  const times=calls=>calls.map(c=>[c.body.birth,c.body.life,c.body.drag,c.time]);
  if(JSON.stringify(times(oldFuture))!==JSON.stringify(times(newFuture)))throw Error('Future samples were skipped or reordered at '+now);
  futureCompared+=oldFuture.length;cacheHits+=effects[0].__qaCalls.length-effects[1].__qaCalls.length;
  return {a,b,oldCalls:effects[0].__qaCalls.length,newCalls:effects[1].__qaCalls.length,futureCalls:newFuture.length};
}
function update(effects,time,wind){for(const effect of effects)effect.__qaSimulation.update({time,windVector:wind});}
function dispose(effects){for(const effect of effects)effect.dispose();}
for(const fps of [30,60,120])for(const mode of ['constant','ramp']){
  const effects=pair(),firstCompared=compared,firstHits=cacheHits;let speed=1.8;
  try{
    for(let frame=0;frame<=fps*12;frame++){
      if(frame&&mode==='ramp')speed+=(5-speed)*(1-Math.exp(-1/fps/1.4));
      update(effects,frame/fps,[speed*.936,0,speed*.352]);
      if(frame%Math.max(1,Math.round(fps/12))===0)bounds(effects);
    }
    details.push({fps,mode,comparisons:compared-firstCompared,savedCalls:cacheHits-firstHits,windSegments:effects[1].__qaSimulation.windTimeline.length});
    check(`whole factory ${mode} ${fps}Hz`,true,details.at(-1));
  }finally{dispose(effects);}
}
for(const type of ['crossette','fan','willow','palm']){
  const effects=pair(type,21117),firstCompared=compared;
  try{
    for(let frame=0;frame<=60*24;frame++){
      const time=frame/60,speed=1.8+3.2*(1-Math.exp(-time/1.4));update(effects,time,[speed*.936,Math.sin(time*.3)*.1,speed*.352]);
      if(frame%10===0)bounds(effects);
    }
    check(`${type}: pre-birth, burst/split, burn-out and event removal`,true,{comparisons:compared-firstCompared,active:effects[1].__qaSimulation.active.length});
  }finally{dispose(effects);}
}
{
  const effects=pair('crossette');
  try{
    update(effects,12,[2.1,0,.4]);bounds(effects,{force:true});
    let mutationChecks=0;
    const mutate=fn=>{for(const e of effects)fn(e.__qaSimulation.active[0]);bounds(effects,{force:true});mutationChecks++;};
    mutate(e=>{e.heads[0].position[0]+=.125;e.heads[0].velocity[1]-=.25;});
    mutate(e=>{e.heads[0].drag+=.025;e.heads[0].gravity=9.7;});
    mutate(e=>{e.heads[0].birth+=.0001;e.heads[0].life+=.001;});
    mutate(e=>{const child=e.heads.find(b=>b.parentBody);child.velocityDelta[2]+=.08;});
    mutate(e=>{const child=e.heads.find(b=>b.parentBody);child.parentBody={...child.parentBody,position:[...child.parentBody.position],velocity:[...child.parentBody.velocity]};child.parentBody.position[2]+=.2;});
    check('numeric birth pose/drag/gravity/life and recursive parent changes invalidate',true,{mutationChecks});
  }finally{dispose(effects);}
}
{
  const effects=pair();
  try{
    for(let frame=0;frame<=7*60;frame++){const t=frame/60;update(effects,t,[1.8+.05*t,0,.7]);if(frame%10===0)bounds(effects);}
    const first=bounds(effects,{force:true}),cached=bounds(effects,{force:true});
    update(effects,7.001,[-5,.2,3]);const changed=bounds(effects,{force:true});
    check('later wind preserves historical samples but recalculates every future sample',cached.newCalls===cached.futureCalls&&changed.newCalls>=changed.futureCalls&&changed.newCalls<changed.oldCalls,{first,cached,changed});
    const cache=effects[1].getBounds();check('original complete key retains same-state object cache',cache===effects[1].getBounds());
  }finally{dispose(effects);}
}
{
  const effects=pair('willow'),firstCompared=compared;let observedPrune=false,previousLength=0;
  try{
    for(let frame=0;frame<=60*90;frame++){
      const t=frame/60,speed=1.8+Math.sin(t*.4)*.8;update(effects,t,[speed*.936,0,speed*.352]);
      const sim=effects[1].__qaSimulation;observedPrune||=sim.windTimeline.length<previousLength;previousLength=sim.windTimeline.length;
      if(frame===30*60||frame===60*60)for(const effect of effects){effect.__qaSimulation.launch({type:frame===30*60?'crossette':'fan'});effect.__qaSimulation.launch({type:'chrysanthemum'});}
      if(frame%30===0)bounds(effects);
    }
    check('active lifecycle, later launches and timeline pruning',observedPrune,{comparisons:compared-firstCompared,windSegments:effects[1].__qaSimulation.windTimeline.length});
  }finally{dispose(effects);}
}
{
  const old=fs.readFileSync(new URL('fireworks.js',baseline),'utf8'),current=fs.readFileSync(new URL('fireworks.js',root),'utf8');
  const strip=s=>s.replace('  const boundsPastSamples=new WeakMap();let boundsSampleGeneration=0;\n','').replace(/    getBounds\(\)\{[\s\S]*?\n    getLightClusters,/, '    getLightClusters,').replaceAll('\r','');
  check('runtime diff confined to getBounds plus its WeakMap closure',strip(old)===strip(current));
  check('past-only sample cache and weak ownership are explicit',current.includes('const boundsPastSamples=new WeakMap()')&&current.includes('t>=b.birth&&t<=simulation.time?')&&current.includes('parentVersion'));
}
const report={date:new Date().toISOString(),scope:'CPU actual old/new factories; only QA module exposes simulation and sample-call trace. 1e-10 m numerical comparison gate; actual maximum error separately reported. No browser/GL/FPS claim.',baselineSHA256:sha(new URL('fireworks.js',baseline)),sourceSHA256:sha(new URL('fireworks.js',root)),elapsedSeconds:(performance.now()-start)/1000,passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,comparedBounds:compared,maximumAbsoluteDifference,futureSamplesCompared:futureCompared,savedHistoricalCalls:cacheHits,checks,details};
fs.writeFileSync(new URL('past-bounds-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,checks:checks.map(c=>({name:c.name,passed:c.passed}))},null,2));if(!report.passed)process.exitCode=1;
