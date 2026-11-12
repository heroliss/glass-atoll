import fs from 'node:fs';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';import {fitPerspectiveBounds} from '../camera-framing.js';
const checks=[];
for(const aspect of [.65,.936,1.6,2.4])for(const focal of [24,48,70]){
  const camera=new THREE.PerspectiveCamera(50,aspect,.15,24000);camera.filmGauge=36;camera.setFocalLength(focal);camera.position.set(-48,12,-40);
  const box=new THREE.Box3(new THREE.Vector3(-39,0,-27),new THREE.Vector3(168,160,86)),fit=fitPerspectiveBounds(THREE,camera,box,{eyeHeight:8}),p=new THREE.Vector3();
  camera.position.copy(fit.position);camera.lookAt(fit.target);camera.updateMatrixWorld();let maximum=0;
  for(let i=0;i<8;i++){p.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);maximum=Math.max(maximum,Math.abs(p.x),Math.abs(p.y));assert(p.z>=-1&&p.z<=1);}
  assert(maximum<=.900001);assert.equal(fit.position.y,8);checks.push({aspect,focal,maximumNDC:maximum,distance:fit.distance,eyeHeight:fit.position.y});
}
const report={date:new Date().toISOString(),passed:true,total:checks.length,checks,scope:'Perspective box corner fit and physical eye height, not camera motion/subjective composition'};
fs.writeFileSync(new URL('./camera-framing-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,total:checks.length}));
