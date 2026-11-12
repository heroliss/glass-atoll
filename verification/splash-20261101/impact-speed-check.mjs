import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {resolveWaterImpact,createWaterImpactDroplets,representedDropletEnergy} from '../../water-impact.js';
import {createSplash} from '../../splash.js';

const mass=2600*Math.PI*.025**3/6;
const impact=(velocity,extra={})=>resolveWaterImpact({stoneDiameter:.025,mass,velocity,...extra});
const speeds=[0,1,3,5,8,12,22];
const samples=speeds.map(speed=>impact([0,-speed,0]));

for(let i=1;i<samples.length;i++){
  assert.ok(samples[i].maximumCrownRadiusMetres>samples[i-1].maximumCrownRadiusMetres,`radius must grow at ${speeds[i]} m/s`);
  assert.ok(samples[i].normalEnergyJoules>samples[i-1].normalEnergyJoules);
}
assert.equal(samples[0].visible,false);
assert.equal(createWaterImpactDroplets(samples[0]).count,0);
assert.ok(samples[2].maximumCrownRadiusMetres>.085 && samples[2].maximumCrownRadiusMetres<.11);
assert.ok(samples[5].maximumCrownRadiusMetres>.20 && samples[5].maximumCrownRadiusMetres<.24);
assert.ok(samples[5].maximumCrownRadiusMetres/samples[2].maximumCrownRadiusMetres>2);
assert.ok(samples[6].maximumCrownRadiusMetres<.31);

const direct=impact([0,-12,0]);
const oblique=impact([Math.sqrt(12*12-3*3),-3,0]);
assert.ok(Math.abs(direct.energyJoules-oblique.energyJoules)<1e-12);
assert.ok(oblique.maximumCrownRadiusMetres<direct.maximumCrownRadiusMetres*.55);
const sameNormal=impact([19,-5,0]);
assert.equal(sameNormal.maximumCrownRadiusMetres,impact([0,-5,0]).maximumCrownRadiusMetres);
const movingWater=impact([4,-7,0],{surfaceVelocity:[4,-2,0]});
assert.equal(movingWater.maximumCrownRadiusMetres,impact([0,-5,0]).maximumCrownRadiusMetres);
assert.equal(impact([0,3,0]).visible,false);
assert.equal(resolveWaterImpact({surfaceHeight:0,stoneDiameter:.025}),null);

for(const speed of speeds.slice(1)){
  const response=impact([0,-speed,0]);
  const drops=createWaterImpactDroplets(response,{seed:7219});
  assert.ok(representedDropletEnergy(drops).totalJoules<=response.representedDropEnergyBudgetJoules*(1+1e-9));
}
const splash=createSplash(THREE,{scene:new THREE.Scene()});
splash.spawn(0,0,0,1,{stoneDiameter:.025,mass,velocity:[0,-3,0]});
const weakFoam=splash.root.children.at(-1).children[1].material.uniforms.uFoam.value;
splash.spawn(0,0,0,1,{stoneDiameter:.025,mass,velocity:[0,-12,0]});
const strongFoam=splash.root.children.at(-1).children[1].material.uniforms.uFoam.value;
splash.spawn(0,0,0,1);
const legacyFoam=splash.root.children.at(-1).children[1].material.uniforms.uFoam.value;
assert.ok(strongFoam>weakFoam&&weakFoam>0);
assert.equal(legacyFoam,0);
splash.dispose();
console.log(JSON.stringify({passed:true,speedsMetresPerSecond:speeds,radiusMetres:samples.map(s=>s.maximumCrownRadiusMetres),obliqueRadiusMetres:oblique.maximumCrownRadiusMetres},null,2));
