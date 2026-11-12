import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import * as THREE from '../../vendor/three.module.js';
const sha=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const root=new URL('../../',import.meta.url),baseline=new URL('../baselines/fireworks-before-scalar-bound/',import.meta.url);
async function factoryAt(directory){
  const file=new URL('fireworks.js',directory),source=fs.readFileSync(file,'utf8');
  const instrumented=source.replace("from './fireworks-physics.js'",'from '+JSON.stringify(new URL('fireworks-physics.js',directory).href))
    .replace('api.configure({});return api;','api.configure({});Object.defineProperty(api,"__qaSimulation",{value:simulation});return api;');
  if(!instrumented.includes('__qaSimulation'))throw Error('QA exposure failed');
  return (await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'))).createFireworks;
}
const factories={before:await factoryAt(baseline),after:await factoryAt(root)},start=performance.now(),deadline=start+28000;
const camera=new THREE.PerspectiveCamera(48,1209/1292,.1,30000);camera.position.set(-30,18,-140);camera.lookAt(40,120,0);camera.updateMatrixWorld();
const mirror=camera.clone();mirror.position.y*=-1;mirror.up.set(0,-1,0);mirror.lookAt(40,-120,0);mirror.updateMatrixWorld();
const optics={width:1209,height:1292,focalMm:28,aperture:8,focusMetres:60,sensorHeightMm:24,dof:false,shutterSeconds:1/120};
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b),p=q=>sorted[Math.min(sorted.length-1,Math.ceil(q*sorted.length)-1)];return {n:values.length,meanMs:values.reduce((s,v)=>s+v,0)/values.length,p95Ms:p(.95),maxMs:p(1)};};
const wind=speed=>[speed*.936,0,speed*.352],results=[],poses={};
for(const [version,createFireworks]of Object.entries(factories))for(const fps of [30,60,120])for(const mode of ['constant','ramp']){
  if(performance.now()>deadline-1500)throw Error('Bounded benchmark deadline reached');
  const a=createFireworks(THREE,{terrainHeight:()=>1,seed:14271}),simulation=a.__qaSimulation,samples={update:[],clusters:[],mainBound:[],mirrorBound:[],core:[],forecastBounds:[],withForecast:[]},counts=[];
  let effective=1.8,step=0,startSegments=null,firstSpeed=null;
  const advance=target=>{while(step<target){step++;if(mode==='ramp')effective+=(5-effective)*(1-Math.exp(-1/fps/1.4));simulation.update({time:step/fps,windVector:wind(effective)});}};
  try{
    a.update({time:0,windVector:wind(effective)});a.launch({type:'chrysanthemum'});a.launch({type:'chrysanthemum'});
    for(const n of [6*fps-2,6*fps-1]){advance(n);a.update({time:n/fps,dt:1/fps,windVector:wind(effective)});a.getLightClusters();a.getRadianceBound({camera,optics});a.getRadianceBound({camera:mirror,optics:{...optics,shutterSeconds:0}});}
    for(let j=0;j<64;j++){
      if(performance.now()>deadline-500)throw Error('Bounded benchmark deadline reached');
      const target=6*fps+j,t0=performance.now();while(step<target){step++;if(mode==='ramp')effective+=(5-effective)*(1-Math.exp(-1/fps/1.4));}
      a.update({time:target/fps,dt:1/fps,windVector:wind(effective)});const t1=performance.now();a.getLightClusters();const t2=performance.now();
      a.getRadianceBound({camera,optics});const t3=performance.now();a.getRadianceBound({camera:mirror,optics:{...optics,shutterSeconds:0}});const t4=performance.now();a.getBounds();const t5=performance.now();
      for(const [key,value]of Object.entries({update:t1-t0,clusters:t2-t1,mainBound:t3-t2,mirrorBound:t4-t3,core:t4-t0,forecastBounds:t5-t4,withForecast:t5-t0}))samples[key].push(value);
      const d=a.diagnostics();counts.push(d.records);
      if(j===0){startSegments=d.windSegments;firstSpeed=effective;poses[version+mode+fps]=simulation.particles({smoke:false}).map(p=>({id:p.event+':'+p.id,position:p.position,velocity:p.velocity}));}
    }
    results.push({version,fps,mode,firstTime:6,lastTime:simulation.time,initialWind:1.8,targetWind:mode==='ramp'?5:1.8,tauSeconds:1.4,firstEffectiveWind:firstSpeed,lastEffectiveWind:effective,windSegmentsStart:startSegments,windSegmentsEnd:simulation.state.windSegments,recordsMin:Math.min(...counts),recordsMax:Math.max(...counts),samples:Object.fromEntries(Object.entries(samples).map(([key,values])=>[key,stats(values)])),rawMs:samples});
  }finally{a.dispose();}
}
function compare(a,b){let position=0,velocity=0,sum=0;for(let i=0;i<a.length;i++){if(a[i].id!==b[i].id)throw Error('Head identity mismatch');const p=Math.hypot(...a[i].position.map((v,c)=>v-b[i].position[c])),v=Math.hypot(...a[i].velocity.map((v,c)=>v-b[i].velocity[c]));position=Math.max(position,p);velocity=Math.max(velocity,v);sum+=p*p;}return {heads:a.length,maxPositionMetres:position,rmsPositionMetres:Math.sqrt(sum/a.length),maxVelocityMps:velocity};}
const trajectory=[];for(const mode of ['constant','ramp'])for(const fps of [30,60,120])trajectory.push({mode,fps,time:6,comparison:'same input timeline, before vs after',...compare(poses['before'+mode+fps],poses['after'+mode+fps])});
const report={date:new Date().toISOString(),elapsedSeconds:(performance.now()-start)/1000,scope:'Bounded CPU-only actual factory hot loops, simulation-only pre-roll through an in-memory QA getter. No GPU draw/upload or complete scene FPS.',hashes:{beforePhysics:sha(new URL('fireworks-physics.js',baseline)),afterPhysics:sha(new URL('fireworks-physics.js',root)),beforeFactory:sha(new URL('fireworks.js',baseline)),factory:sha(new URL('fireworks.js',root)),helper:sha(new URL('wind-response.js',root))},samplesPerCase:64,statisticsNote:'64 samples per matched scenario; CPU-only bounded window, not a scene frame-rate guarantee.',results,trajectory};
fs.writeFileSync(new URL('scalar-bound-benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,results:results.map(({rawMs,...result})=>result)},null,2));
