import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createVegetation} from '../vegetation.js';
import {createAtmosphere} from '../sky.js';
import {createIndirectLighting} from '../indirect-lighting.js';
const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8'),match=source.match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/);
if(!match)throw new Error('Cannot locate the actual terrain implementation.');
const terrainHeight=new Function('x','z',match[1]),started=performance.now(),grove=createVegetation(THREE,{terrainHeight,seed:40219});
const sunDirection=new THREE.Vector3(Math.sin(100*Math.PI/180)*Math.cos(48*Math.PI/180),Math.sin(48*Math.PI/180),Math.cos(100*Math.PI/180)*Math.cos(48*Math.PI/180));
const atmosphere=createAtmosphere(THREE,{sunDirection});
const gi=createIndirectLighting(THREE,{terrainHeight,grove,atmosphere,quality:'high'});await gi.ready;
const timings=[];
for(let i=0;i<30;i++){
  const time=i*.3;atmosphere.update({time,wind:1.8});const stamp=performance.now();
  gi.update({time,delta:1/60,force:true,sunDirection,sunIntensity:3.6});timings.push(performance.now()-stamp);
}
timings.sort((a,b)=>a-b);
const state=gi.diagnostics(),queries=[];
for(const p of [[0,1.5,0],[-10,8,-5],[15,.2,7],[0,-1,20]])for(const n of [[0,1,0],[0,-1,0],[1,0,0]])queries.push({p,n,e:gi.sampleIrradiance(p,n)});
const report={date:new Date().toISOString(),passed:state.maximumTransferRow<=1+1e-10&&state.reciprocityError<1e-10&&queries.every(q=>q.e.every(v=>Number.isFinite(v)&&v>=0))&&state.secondBounceReflectedPower.every((v,c)=>v<=.95*state.directReflectedPower[c]+1e-7),scope:'Node CPU using actual terrain, procedural grove triangles and actual CPU cloud visibility; no GPU renderer and no frame-time claim',state,forcedUpdateMs:{median:timings[15],p95:timings[28],maximum:timings[29]},totalProcessMs:performance.now()-started,queries};
fs.writeFileSync(new URL('./indirect-lighting-scene-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));gi.dispose();grove.userData.dispose();atmosphere.dispose();if(!report.passed)process.exitCode=1;
