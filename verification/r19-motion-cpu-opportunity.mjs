// CPU-only actual-factory investigation. Frozen source transforms stay in RAM.
// No production edits, WebGL context, GPU work, browser or native-FPS claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import * as THREE from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),base=new URL('./baselines/r19-fw-physics-before-cpu-review/',import.meta.url);
const read=n=>fs.readFileSync(new URL(n,base),'utf8'),fw=read('fireworks.js'),physics=read('fireworks-physics.js'),wind=read('wind-response.js');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[],started=new Date().toISOString();
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
function imports(s,special={}){return s.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${special[p]??new URL(p.slice(2),root).href}'`);}
function replaceOnce(s,a,b){assert.equal(s.split(a).length,2,a.slice(0,80));return s.replace(a,b);}
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack)});}}
async function factory({factorCache=false,responseCache=false,profile=false}={}){
  // Exact input keys, no quantization/reassociation; bounded to one explicit frame.
  const prelude=`
const __q={sampleBody:0,parentSamples:0,resolveBurst:0,flight:0,factorHits:0,factorMisses:0,windCalls:0,windHits:0,windMisses:0,maxFactorEntries:0,maxWindEntries:0};
let __factorMap=new Map(),__windMap=new WeakMap(),__factorEntries=0,__windEntries=0;
export function __beginFrame(){for(const k of Object.keys(__q))__q[k]=0;__factorMap=new Map();__windMap=new WeakMap();__factorEntries=0;__windEntries=0;}
export function __stats(){return {...__q};}
function __flightFactors(k,dt){${profile?'__q.flight++;':''}let m=__factorMap.get(k);if(!m){m=new Map();__factorMap.set(k,m);}let v=m.get(dt);if(v){${profile?'__q.factorHits++;':''}${factorCache?'return v;':''}}else{${profile?'__q.factorMisses++;':''}}
const decay=Math.exp(-k*dt),travel=-Math.expm1(-k*dt)/k;v={decay,travel};if(__factorEntries<4096&&!m.has(dt)){m.set(dt,v);__factorEntries++;__q.maxFactorEntries=Math.max(__q.maxFactorEntries,__factorEntries);}return v;}
function __windResponse(timeline,k,birth,time){${profile?'__q.windCalls++;':''}let byK=__windMap.get(timeline);if(!byK){byK=new Map();__windMap.set(timeline,byK);}let byBirth=byK.get(k);if(!byBirth){byBirth=new Map();byK.set(k,byBirth);}let byTime=byBirth.get(birth);if(!byTime){byTime=new Map();byBirth.set(birth,byTime);}let value=byTime.get(time);if(value){${profile?'__q.windHits++;':''}${responseCache?'return value;':''}}else{${profile?'__q.windMisses++;':''}}
value=__rawWindResponse(timeline,k,birth,time);if(__windEntries<4096&&!byTime.has(time)){byTime.set(time,value);__windEntries++;__q.maxWindEntries=Math.max(__q.maxWindEntries,__windEntries);}return value;}
`;
  let text=imports(physics,{'./wind-response.js':uri(wind),'./firework-layer-profile.js':new URL('firework-layer-profile.js',base).href});
  text=replaceOnce(text,'import {windResponse}', 'import {windResponse as __rawWindResponse}');
  text=prelude+text;
  if(profile||factorCache)text=replaceOnce(text,'const decay=Math.exp(-drag*dt),travel=-Math.expm1(-drag*dt)/drag;','const {decay,travel}=__flightFactors(drag,dt);');
  if(profile||responseCache)text=replaceOnce(text,'const response=windResponse(timeline,k,body.birth,time);','const response=__windResponse(timeline,k,body.birth,time);');
  else text=replaceOnce(text,'const response=windResponse(timeline,k,body.birth,time);','const response=__rawWindResponse(timeline,k,body.birth,time);');
  if(profile){text=replaceOnce(text,'if(time<body.birth)return null;','__q.sampleBody++;if(body.parentBody)__q.parentSamples++;if(time<body.birth)return null;');text=replaceOnce(text,'if(!event.rocket)return;','__q.resolveBurst++;if(!event.rocket)return;');}
  const physicsURL=uri(text),p=await import(physicsURL);
  let f=imports(fw,{'./fireworks-physics.js':physicsURL,'./firework-exposure-window.js':new URL('firework-exposure-window.js',base).href});
  f=replaceOnce(f,'sampleBodyEmissionWindow,clamp}', 'sampleBodyEmissionWindow,clamp,__beginFrame}');
  f=replaceOnce(f,'update({time,dt,windVector}={}){simulation.update','update({time,dt,windVector}={}){__beginFrame();simulation.update');
  f=replaceOnce(f,'api.configure({});return api;','api.configure({});api.__qa={records:()=>records,active:()=>simulation.active,wind:()=>simulation.windTimeline};return api;');
  return {create:(await import(uri(f))).createFireworks,physics:p};
}
const original=await factory(),factorOnly=await factory({factorCache:true}),responseOnly=await factory({responseCache:true}),combined=await factory({factorCache:true,responseCache:true}),profile=await factory({profile:true});
const renderer=()=>({autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace(){return 0;},getActiveMipmapLevel(){return 0;},setRenderTarget(t){this.target=t;},render(){}});
const main=new THREE.PerspectiveCamera(55,1.5,.1,30000),mirror=new THREE.PerspectiveCamera(55,1.5,.1,30000);main.position.set(180,90,500);main.lookAt(60,150,0);main.updateMatrixWorld();mirror.position.set(180,-90,500);mirror.lookAt(60,150,0);mirror.updateMatrixWorld();
function make(module,{type='chrysanthemum',effectProfile='legacy'}={}){const f=module.create(THREE,{sourceVisibility:'none',clusterModel:'moments'});f.configure({type,effectProfile,autoDirection:false,azimuth:104,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});const launch=f.launch({seed:42});assert.equal(launch.accepted,true);return{f,launch,module};}
function render(f,reflection=false){f.render({renderer:renderer(),target:{width:1200,height:800},camera:reflection?mirror:main,reflection,legacySmoke:false,optics:{width:1200,height:800,shutterSeconds:1/120,dof:false},frame:{storageEV:0,rawPerCandela:3.6e-5}});const g=f.effectsScene.children[0].geometry;return{count:g.instanceCount,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,a.array.slice(0,k==='position'?a.array.length:g.instanceCount*a.itemSize)]))};}
function rows(f){return f.__qa.records().map(p=>({kind:p.kind,eventId:p.eventId,position:p.position,velocity:p.velocity,stretch:p.stretch,colour:p.colour,radius:p.radius,intensity:p.intensity,unmodulatedIntensity:p.unmodulatedIntensity,sourceAge:p.sourceAge,opticalDepth:p.opticalDepth,emissionRGBReference:p.emissionRGBReference,maximumReferenceRGB:p.maximumReferenceRGB}));}
function ledger(f){const a=f.getEmissionLedger();return{...a,data:a.data.slice(0,a.count*a.stride)};}
const modes=[['factor',factorOnly],['response',responseOnly],['combined',combined]],workloads=[];
for(const options of [{type:'chrysanthemum'},{type:'chrysanthemum',effectProfile:'two-colour-v1'},{type:'crossette'}]){
  const a=make(original,options),others=modes.map(([name,module])=>({name,...make(module,options)})),p=make(profile,options);
  check(`Actual frozen factory exact records/ledger/clusters/uploads: ${options.type}/${options.effectProfile??'legacy'}`,()=>{
    let comparisons=0;for(let frame=0;frame<3;frame++){
      const time=a.launch.burstTime+1.2+frame/60,windVector=[2+frame*.017,0,.7-frame*.003];
      for(const x of [a,...others,p])x.f.update({time,windVector});
      const R=rows(a.f),L=ledger(a.f),C=a.f.getLightClusters(),views=[render(a.f),render(a.f,true)];
      for(const b of others){assert.deepEqual(rows(b.f),R);assert.deepEqual(ledger(b.f),L);assert.deepEqual(b.f.getLightClusters(),C);assert.deepEqual(render(b.f),views[0]);assert.deepEqual(render(b.f,true),views[1]);comparisons++;}
      render(p.f);render(p.f,true);workloads.push({options,frame,time,records:R.length,...profile.physics.__stats()});
    }return{movingFrames:3,variants:modes.map(x=>x[0]),comparisons,scope:'Strict deepEqual includes all Float32 upload bytes; no GPU execution.'};
  });
  for(const x of [a,...others,p])x.f.dispose();
}
check('Generation boundary handles in-place root pose edit, new wind knot and parent recursion',()=>{
  const a=make(original,{type:'crossette'}),b=make(combined,{type:'crossette'});try{
    for(let i=0;i<3;i++){
      for(const x of [a,b]){const body=x.f.__qa.active()[0].rocket;body.position[0]+=.03125;body.velocity[2]-=.0625;x.f.update({time:x.launch.burstTime+1.4+i/60,windVector:[i*.2,0,-i*.3]});}
      assert.deepEqual(rows(a.f),rows(b.f));assert.deepEqual(render(a.f),render(b.f));
    }return{frames:3,scope:'Memo resets before every synchronous update. No across-generation pose/wind result reuse.'};
  }finally{a.f.dispose();b.f.dispose();}
});
// One bounded timing experiment. Work is actual record building and uploads to a
// no-context renderer stub, not native rendering. Entire measured loop <=1.8s.
const timings=[],budgetStart=performance.now(),budgetMs=1800;
outer:for(const effectProfile of ['legacy','two-colour-v1']){
  const runs=[['baseline',original],...modes].map(([name,module])=>({name,...make(module,{effectProfile}),samples:[]}));
  try{for(let frame=0;frame<8;frame++)for(const x of runs){
    if(performance.now()-budgetStart>budgetMs)break outer;
    const time=x.launch.burstTime+1.5+frame/60,windVector=[1+frame*.013,0,.6-frame*.002],t0=performance.now();x.f.update({time,windVector});const t1=performance.now();render(x.f);const t2=performance.now();render(x.f,true);const t3=performance.now();x.samples.push({update:t1-t0,main:t2-t1,mirror:t3-t2,total:t3-t0});
  }}finally{for(const x of runs){const mean=Object.fromEntries(['update','main','mirror','total'].map(k=>[k,x.samples.reduce((s,v)=>s+v[k],0)/x.samples.length]));timings.push({effectProfile,variant:x.name,samples:x.samples.length,meanMs:mean,firstExcludedWarmup:false});x.f.dispose();}}
}
const report={schema:'glass-atoll.r19-motion-cpu-opportunity.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},frozenSources:{fireworks:hash(fw),physics:hash(physics),wind:hash(wind)},checks,workloads,timings,timingLoopMs:performance.now()-budgetStart,budgetMs,limits:['Verification-only source transformations. No production implementation or mutation.','No context/GPU/native frames. CPU constructor/import/check overhead excluded from timing loop; timings include real Three CPU records and mock uploads.','Only one bounded timing run, JIT/GC/order sensitive; use call counts/exact equality first, not a native FPS prediction.','Module-global memo in this isolated fixture must not be copied into production: a production cache needs an explicit simulation-owned generation/context and unchanged dependency scope.']};
fs.writeFileSync(new URL('./r19-motion-cpu-opportunity.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
