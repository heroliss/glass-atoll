import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {islandCelestialView,keepIslandInPreset,islandFireworksView} from '../island-view-framing.js';
import {getFireworkShowEnvelope} from '../firework-show-envelope.js';

const checks=[];
const witness=[0,1.35,0];
const configure=(aspect,focal)=>{const c=new THREE.PerspectiveCamera(50,aspect,.15,24000);c.filmGauge=36;c.setFocalLength(focal);return c;};
function projection(camera,view,point){camera.position.fromArray(view.position);camera.lookAt(new THREE.Vector3(...view.target));camera.updateMatrixWorld();return new THREE.Vector3(...point).project(camera);}
function witnessFits(camera,view){const p=projection(camera,view,witness);assert(p.z>=-1&&p.z<=1&&Math.abs(p.x)<=.860001&&Math.abs(p.y)<=.860001);}

for(const aspect of [.46,.94,1.6,2.4])for(const focal of [20,28,70]){
  for(const altitude of [-70,-.3,0,45,90])for(const azimuth of [0,90,180,270]){
    const a=azimuth*Math.PI/180,e=altitude*Math.PI/180,camera=configure(aspect,focal);
    const raw=islandCelestialView([Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)]);
    const view=keepIslandInPreset(THREE,camera,raw);witnessFits(camera,view);
    checks.push({name:'celestial island witness',aspect,focal,altitude,azimuth,adjusted:view.islandFraming.adjusted});
  }
  // Includes the old sky-only sun view and narrow portrait stars framing.
  for(const raw of [{position:[-48,2.8,38],target:[-148,2.8,38]},{position:[38,2.5,-46],target:[5,26,4]},{position:[-48,2.5,26],target:[4,36,-2]}]){
    const camera=configure(aspect,focal),view=keepIslandInPreset(THREE,camera,raw);witnessFits(camera,view);
    checks.push({name:'skyward authored preset repaired',aspect,focal,adjusted:view.islandFraming.adjusted});
  }
  for(const azimuth of [0,103,180,270]){
    const camera=configure(aspect,focal),envelope=getFireworkShowEnvelope({type:'peony',origin:[29,.67,7],muzzleOffsetMetres:.66,azimuth,settings:{elevation:78,launchSpreadDegrees:3,starDragModel:'bounded-descent'}});
    const view=islandFireworksView(THREE,camera,{azimuth,envelope}),box=view.islandFraming.sourceBounds;
    for(let i=0;i<8;i++){const p=projection(camera,view,[i&1?box.max[0]:box.min[0],i&2?box.max[1]:box.min[1],i&4?box.max[2]:box.min[2]]);assert(p.z>=-1&&p.z<=1&&Math.abs(p.x)<=.920001&&Math.abs(p.y)<=.920001);}
    const horizontalLook=new THREE.Vector3(view.target[0]-view.position[0],0,view.target[2]-view.position[2]).normalize();
    assert(horizontalLook.dot(new THREE.Vector3(...view.islandFraming.patternNormal))>1-1e-12);
    checks.push({name:'selected shell + island fit, pattern aligned',aspect,focal,azimuth,distance:view.islandFraming.distance});
  }
}
assert.throws(()=>islandCelestialView([NaN,0,1]));
assert.throws(()=>keepIslandInPreset(THREE,configure(1,28),{position:witness,target:[0,1,2]}));
const report={passed:true,total:checks.length,scope:'Pure perspective/frustum and pattern-bearing checks; no rendered occlusion, subjective composition or camera motion claim',checks};
fs.writeFileSync(new URL('./island-view-framing-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
