import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';
import {runComplexStylesGPUCheck} from './all-styles-gpu-check.js';
import * as THREE from '../../vendor/three.module.js';
import {createFireworks} from '../../fireworks.js';
import {COMPLEX_FIREWORK_TYPES} from '../../complex-fireworks.js';
let attemptedGL=0;const impossibleRenderer={getContext(){attemptedGL++;throw Error('CPU preflight must not reachGL');}};
await assert.rejects(()=>runComplexStylesGPUCheck(THREE,impossibleRenderer,{parentLocked:false,createFireworks}),/parent lock/);
await assert.rejects(()=>runComplexStylesGPUCheck(THREE,impossibleRenderer,{parentLocked:true}),/factory/);assert.equal(attemptedGL,0);
const rows=[];for(const d of COMPLEX_FIREWORK_TYPES){const fw=createFireworks(THREE,{terrainHeight:()=>0,seed:14271,trailIntegration:'adaptive'});try{assert.equal(fw.types.length,20);fw.configure({autoLaunch:false,autoDirection:false,azimuth:104,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});const launch=fw.launch({type:d.id,seed:14271}),time=launch.burstTime+2;fw.update({time,windVector:[0,0,0]});const graph=fw.smokeSourceProvider.describeCombustion(launch.id),bodies=graph.nodes.filter(b=>Number.isSafeInteger(b.bodyId)&&time>=b.birth&&time<b.endTime);assert.equal(launch.actualStarCount,d.count);assert.equal(graph.counts.bodies,d.count);assert(bodies.length>0);for(const b of bodies){const q=fw.smokeSourceProvider.sampleBody(launch.id,{bodyId:b.bodyId,time});assert(q.position.every(Number.isFinite));}rows.push({type:d.id,heads:d.count,liveBodiesAtStage:bodies.length});}finally{fw.dispose();}}
const p=new URL('all-styles-gpu-check.js',import.meta.url),report={passed:true,cpuOnly:true,gpuExecuted:false,total:12,gateTests:2,styles:rows,helperSHA256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')};fs.writeFileSync(new URL('all-styles-gpu-preflight.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,total:12,gpuExecuted:false,helperSHA256:report.helperSHA256}));
