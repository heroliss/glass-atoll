import * as THREE from '../../vendor/three.module.js';
import {createFireworks} from '../../fireworks.js';
import {performance} from 'node:perf_hooks';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const a=createFireworks(THREE,{terrainHeight:()=>1}),camera=new THREE.PerspectiveCamera(48,1209/1292,.1,30000);
camera.position.set(-30,18,-140);camera.lookAt(40,120,0);camera.updateMatrixWorld();a.update({time:0,windVector:[5,0,1]});a.launch({type:'chrysanthemum'});a.launch({type:'chrysanthemum'});
const samples=[];for(let i=0;i<160;i++){const t=5.1+i/144,start=performance.now();a.update({time:t,windVector:[5,0,1]});a.getLightClusters();a.getRadianceBound({camera,optics:{width:1209,height:1292},rawPerCandela:3.6e-5});if(i>=32)samples.push(performance.now()-start);}
const sorted=[...samples].sort((x,y)=>x-y),p=q=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*q)-1)],report={date:new Date().toISOString(),scope:'Node CPU-only update+clusters+camera-bound; no GL upload/draw, no scene FPS claim',sourceSHA256:createHash('sha256').update(await readFile(new URL('../../fireworks.js',import.meta.url))).digest('hex'),samples:samples.length,meanMs:samples.reduce((s,x)=>s+x,0)/samples.length,p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),maximumMs:p(1),state:a.diagnostics(),rawMs:samples};a.dispose();await writeFile(new URL('./cpu-benchmark.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({scope:report.scope,samples:report.samples,meanMs:report.meanMs,p95Ms:report.p95Ms,p99Ms:report.p99Ms,records:report.state.records},null,2));
