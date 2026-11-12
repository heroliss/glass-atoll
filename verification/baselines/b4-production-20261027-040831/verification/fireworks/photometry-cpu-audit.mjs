// Read-only phase isolation of actual production methods. No GL/no FPS claim.
import * as THREE from '../../vendor/three.module.js';
import {createFireworks} from '../../fireworks.js';
import {performance} from 'node:perf_hooks';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const effect=createFireworks(THREE,{origin:[29,0,7],terrainHeight:()=>0,seed:14271}),camera=new THREE.PerspectiveCamera(48,1209/1292,.1,30000),mirror=camera.clone();
camera.position.set(-188,12,-126);camera.lookAt(40,130,0);camera.updateMatrixWorld();mirror.position.set(-188,-12,-126);mirror.lookAt(40,130,0);mirror.updateMatrixWorld();
effect.setQuality({trailSegments:8});effect.update({time:0,windVector:[1.8*.936,0,1.8*.352]});effect.launch({type:'chrysanthemum'});effect.launch({type:'chrysanthemum'});
const wind=t=>1.8+3.2*(1-Math.exp(-(t-3.2)/1.4));
for(let i=0;i<=315;i++){const t=3.2+4*i/315,w=wind(t);effect.update({time:t,windVector:[w*.936,0,w*.352]});}
const opts={width:1209,height:1292,dof:false,shutterSeconds:1/120},rows=[];
for(let i=0;i<100;i++){
  const time=7.2+(i+1)/144,w=wind(time),a=performance.now();effect.update({time,windVector:[w*.936,0,w*.352]});const b=performance.now();effect.getBounds();const c=performance.now();effect.getLightClusters();const d=performance.now();effect.getRadianceBound({camera,optics:opts});const e=performance.now();effect.getRadianceBound({camera:mirror,optics:{...opts,shutterSeconds:0}});const f=performance.now();effect.getBounds();const g=performance.now();
  if(i>=20)rows.push({update:b-a,forecast:c-b,clusters:d-c,sourceBoundMain:e-d,sourceBoundMirror:f-e,forecastSameStateCached:g-f,photometry:f-b,total:f-a});
}
const summary={};for(const key of Object.keys(rows[0])){const v=rows.map(r=>r[key]).sort((a,b)=>a-b);summary[key]={meanMs:v.reduce((s,x)=>s+x,0)/v.length,p95Ms:v[Math.ceil(v.length*.95)-1]};}
const sourceSHA256={};for(const file of ['fireworks.js','fireworks-physics.js','wind-response.js'])sourceSHA256[file]=createHash('sha256').update(await readFile(new URL('../../'+file,import.meta.url))).digest('hex');
const report={date:new Date().toISOString(),sourceSHA256,scope:'Node CPU-only actual update/getBounds/clusters/two camera bounds; no GL/renderer/FPS claim',scenario:'2 Chrysanthemums;8tail segments; initialized317wind knots then144Hz continued exact1.4s wind ramp;80measured frames',summary,state:effect.diagnostics(),forecastCallsPerMiss:2*(192+1)*17,rows};
effect.dispose();await writeFile(new URL('./photometry-cpu-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({scenario:report.scenario,summary,records:report.state.records,windSegments:report.state.windSegments,forecastCallsPerMiss:report.forecastCallsPerMiss},null,2));
