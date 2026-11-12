import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import {islandFireworksView} from '../../island-view-framing.js';
const baseline=fs.readFileSync(new URL('./before/island-view-framing.js',import.meta.url),'utf8');
const rebound=baseline.replace("from './camera-framing.js'",`from '${new URL('../../camera-framing.js',import.meta.url).href}'`);
const {islandFireworksView:before}=await import('data:text/javascript;base64,'+Buffer.from(rebound).toString('base64'));
const checks=[];
const envelope={min:[-180,0,-115],max:[240,265,185]};
for(const aspect of [.46,.94,1.6,2.4])for(const focal of [20,28,70])for(const azimuth of [0,103,180,270]){
  const camera=new THREE.PerspectiveCamera(50,aspect,.15,24000);camera.filmGauge=36;camera.setFocalLength(focal);
  assert.deepEqual(islandFireworksView(THREE,camera,{azimuth,envelope}),before(THREE,camera,{azimuth,envelope}));
  assert.deepEqual(islandFireworksView(THREE,camera,{azimuth,envelope,automaticFan:false}),before(THREE,camera,{azimuth,envelope}));
  const next=islandFireworksView(THREE,camera,{azimuth,envelope,automaticFan:true}),oldRotated=before(THREE,camera,{azimuth:azimuth+90,envelope});
  assert.deepEqual(next,oldRotated);
  camera.position.fromArray(next.position);camera.lookAt(new THREE.Vector3(...next.target));camera.updateMatrixWorld();
  for(let i=0;i<8;i++){
    const p=new THREE.Vector3(i&1?envelope.max[0]:envelope.min[0],i&2?envelope.max[1]:envelope.min[1],i&4?envelope.max[2]:envelope.min[2]).project(camera);
    assert(p.z>=-1&&p.z<=1&&Math.abs(p.x)<=.920001&&Math.abs(p.y)<=.920001);
  }
  const launchBearing=new THREE.Vector3(Math.sin(azimuth*Math.PI/180),0,-Math.cos(azimuth*Math.PI/180)),observer=new THREE.Vector3(...next.islandFraming.patternNormal);
  assert(Math.abs(observer.dot(launchBearing))<1e-12);
  checks.push({aspect,focal,azimuth,passed:true});
}
const source=fs.readFileSync(new URL('../../island-view-framing.js',import.meta.url),'utf8');
const report={passed:true,total:checks.length,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),checks,scope:'Pure numerical framing: manual exact equality, automatic fan observer rotated90degrees, forecast corners fit; no rendered occlusion/appearance claim'};
fs.writeFileSync(new URL('./frame-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,total:checks.length}));
