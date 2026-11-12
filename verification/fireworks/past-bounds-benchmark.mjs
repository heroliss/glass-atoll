import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import * as THREE from '../../vendor/three.module.js';
const root=new URL('../../',import.meta.url),baseline=new URL('../baselines/fireworks-before-past-bounds/',import.meta.url),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function factoryAt(directory){
  const file=new URL('fireworks.js',directory),source=fs.readFileSync(file,'utf8');
  const instrumented=source.replace("from './fireworks-physics.js'",'from '+JSON.stringify(new URL('fireworks-physics.js',directory).href)).replace('api.configure({});return api;','api.configure({});Object.defineProperty(api,"__qaSimulation",{value:simulation});return api;');
  return(await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'))).createFireworks;
}
const factories={before:await factoryAt(baseline),after:await factoryAt(root)},start=performance.now(),deadline=start+28000;
const camera=new THREE.PerspectiveCamera(48,1209/1292,.1,30000),mirror=camera.clone();camera.position.set(-188,12,-126);camera.lookAt(40,130,0);camera.updateMatrixWorld();mirror.position.set(-188,-12,-126);mirror.lookAt(40,130,0);mirror.updateMatrixWorld();
const optics={width:1209,height:1292,dof:false,shutterSeconds:1/120},wind=speed=>[speed*.936,0,speed*.352];
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b),p=q=>sorted[Math.min(sorted.length-1,Math.ceil(q*sorted.length)-1)];return{n:values.length,meanMs:values.reduce((s,v)=>s+v,0)/values.length,p95Ms:p(.95),maxMs:p(1)};};
const results=[],bounds=[];
for(const[version,create]of Object.entries(factories))for(const fps of [30,60,120,144])for(const mode of (fps===144?['ramp']:['constant','ramp'])){
  if(performance.now()>deadline-1000)throw Error('Bounded 28s CPU window exhausted');
  const a=create(THREE,{origin:[29,0,7],terrainHeight:()=>0,seed:14271}),sim=a.__qaSimulation,samples={update:[],forecast:[],clusters:[],sourceBoundMain:[],sourceBoundMirror:[],forecastSameStateCached:[],photometry:[],total:[]};a.setQuality({trailSegments:8});a.update({time:0,windVector:wind(1.8)});a.launch({type:'chrysanthemum'});a.launch({type:'chrysanthemum'});
  const speed=t=>mode==='constant'?1.8:fps===144?1.8+3.2*(1-Math.exp(-(t-3.2)/1.4)):1.8+3.2*(1-Math.exp(-t/1.4));
  const initial=fps===144?7.2:6,measured=fps===144?80:48,warmup=20;
  try{
    if(fps===144){for(let i=0;i<=315;i++){const t=3.2+4*i/315;sim.update({time:t,windVector:wind(speed(t))});}}
    else for(let i=1;i<=initial*fps;i++){const t=i/fps;sim.update({time:t,windVector:wind(speed(t))});}
    let first=null;
    for(let i=0;i<warmup+measured;i++){
      const time=initial+(i+1)/fps,t0=performance.now();a.update({time,windVector:wind(speed(time))});const t1=performance.now();const bound=a.getBounds();const t2=performance.now();a.getLightClusters();const t3=performance.now();a.getRadianceBound({camera,optics});const t4=performance.now();a.getRadianceBound({camera:mirror,optics:{...optics,shutterSeconds:0}});const t5=performance.now();a.getBounds();const t6=performance.now();
      if(i>=warmup){for(const[k,value]of Object.entries({update:t1-t0,forecast:t2-t1,clusters:t3-t2,sourceBoundMain:t4-t3,sourceBoundMirror:t5-t4,forecastSameStateCached:t6-t5,photometry:t5-t1,total:t5-t0}))samples[k].push(value);if(first===null)first={time,records:a.diagnostics().records,windSegments:sim.windTimeline.length};}
      bounds.push({version,fps,mode,time,min:bound.min,max:bound.max});
    }
    results.push({version,fps,mode,first,lastTime:sim.time,windSegmentsEnd:sim.windTimeline.length,recordsEnd:a.diagnostics().records,samples:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,stats(v)])),rawMs:samples});
  }finally{a.dispose();}
}
let maxDifference=0,compared=0;const old=bounds.filter(b=>b.version==='before'),current=bounds.filter(b=>b.version==='after');for(let i=0;i<old.length;i++){if(old[i].fps!==current[i].fps||old[i].mode!==current[i].mode||old[i].time!==current[i].time)throw Error('Mismatched inputs');for(const key of ['min','max'])for(let c=0;c<3;c++)maxDifference=Math.max(maxDifference,Math.abs(old[i][key][c]-current[i][key][c]));compared++;}
const report={date:new Date().toISOString(),elapsedSeconds:(performance.now()-start)/1000,scope:'Node CPU-only actual production update/getBounds/clusters/two camera source bounds. Same seed, full records, wind timeline and optics. Sequential bounded measurement; not full browser FPS or hardware GPU time.',baselineSHA256:sha(new URL('fireworks.js',baseline)),sourceSHA256:sha(new URL('fireworks.js',root)),otherRuntimeUnchanged:{physics:sha(new URL('fireworks-physics.js',baseline))===sha(new URL('fireworks-physics.js',root)),windResponse:sha(new URL('wind-response.js',baseline))===sha(new URL('wind-response.js',root))},warmupFrames:20,comparison:{bounds:compared,maximumAbsoluteDifference:maxDifference,passed:maxDifference<=1e-10},results};
fs.writeFileSync(new URL('past-bounds-benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:results.map(({rawMs,...r})=>r)},null,2));
