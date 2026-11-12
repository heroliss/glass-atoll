import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createVegetation} from '../vegetation.js';
import {profileVegetationMotion} from '../vegetation-stability.js';
const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8'),match=source.match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/),terrainHeight=new Function('x','z',match[1]);
const pose=source.match(/shore:\{position:\[([^\]]+)\],target:\[([^\]]+)\]\}/),position=JSON.parse('['+pose[1]+']'),target=JSON.parse('['+pose[2]+']');
const grove=createVegetation(THREE,{terrainHeight,seed:40219}),camera=new THREE.PerspectiveCamera(40,1.6,.15,24000);camera.filmGauge=36;camera.setFocalLength(28);camera.position.fromArray(position);camera.lookAt(...target);camera.updateMatrixWorld();
const reports=[];for(const wind of [1.8,5]){const p=profileVegetationMotion(THREE,grove,camera,{wind,time:60,height:900});reports.push({...p,rows:undefined});}
const jitter=i=>{const r=(n,b)=>{let x=0,f=1/b;while(n>0){x+=(n%b)*f;n=Math.floor(n/b);f/=b;}return x;};return [r(i%8+1,2)-.4453125,r(i%8+1,3)-.5];};
const jumps=Array.from({length:8},(_,i)=>{const a=jitter(i),b=jitter(i+1);return Math.hypot(a[0]-b[0],a[1]-b[1]);});
const report={date:new Date().toISOString(),camera:{position,target,focalMm:28,filmGaugeMm:36,viewport:[1440,900]},reports,jitterJumpsPixels:jumps,maximumJitterJumpPixels:Math.max(...jumps),scope:'current actual geometry + analytic wind, simulated projection only, not a dynamic raster acceptance'};
fs.writeFileSync(new URL('./vegetation-motion-profile.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));grove.userData.dispose();
