import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../../vendor/three.module.js';
import {createFireworks} from '../../../fireworks.js';
import {createLocalLights,LOCAL_LIGHT_COUNT} from '../../../local-lights.js';
import {createEnvironmentLocalLights,ENVIRONMENT_LIGHT_COUNT,environmentLightGLSL} from './qa-environment-lights.js';

const folder=new URL('./',import.meta.url),root=new URL('../../../',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder),'utf8'));
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const read=name=>fs.readFileSync(new URL(name,folder),'utf8');
const checks=[];
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}
const approx=(actual,expected)=>assert(Math.abs(actual-expected)<=3e-9*Math.max(1,Math.abs(expected)),String(actual)+' vs '+String(expected));

check('route files parse and source inputs remain unchanged',()=>{
  for(const entry of manifest.entries){assert.equal(hash(fs.readFileSync(new URL(entry.input,root),'utf8')),entry.inputSHA256);assert.equal(hash(read(entry.output)),entry.outputSHA256);execFileSync(process.execPath,['--check',fileURLToPath(new URL(entry.output,folder))],{stdio:'pipe'});}
  assert.equal(hash(read('qa-environment-lights.js')),manifest.adapterSHA256);
  return {routeFiles:manifest.entries.length,sourcePins:true};
});
check('island and smoke stay at twenty; water and air use six',()=>{
  assert.equal(LOCAL_LIGHT_COUNT,20);assert.equal(ENVIRONMENT_LIGHT_COUNT,6);
  for(const name of ['uLocalPosition','uLocalColour','uLocalDirection','uLocalCone'])assert(environmentLightGLSL.includes(name+'[6]'));
  assert(!environmentLightGLSL.includes('[20]'));assert(!environmentLightGLSL.includes('i<20'));
  const main=read('main.js'),water=read('water.js'),air=read('aerial-perspective.js'),marker='$'+'{ENVIRONMENT_LIGHT_COUNT}';
  assert(main.includes('clusters:receiverClusters'));assert(main.includes('environmentLocalLights.update({frame:baseFrame,clusters})'));
  assert(main.includes('localLighting:localLights'));assert(main.includes('sources:localLights.records'));
  assert(main.includes('water=createWater(')&&main.includes('localLights:environmentLocalLights'));
  assert(main.includes('aerialPerspective=createAerialPerspective('));
  assert.equal(water.split('for(int i=0;i<'+marker+';i++)').length-1,1);
  assert.equal(air.split('for(int i=0;i<'+marker+';i++)').length-1,3);
  assert(read('local-lights-native20.js').includes('LOCAL_LIGHT_COUNT=4+FIREWORK_RECEIVER_LIGHT_COUNT'));
  const smoke=fs.readFileSync(new URL('pyro-smoke-renderer.js',root),'utf8');
  assert(smoke.includes('for(int i=0;i<'+'$'+'{LOCAL_LIGHT_COUNT};i++)'));
  return {island:20,environment:6,smoke:20,waterLoops:1,airLoops:3};
});
check('environment copies fixtures once, conserves cluster RGB and extinguishes',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),full=createLocalLights(THREE,{scene}),env=createEnvironmentLocalLights(THREE,full);
  try{
    full.configure({mode:'on',flashlight:{enabled:true,brightness:.5}});
    const frame={time:0,dt:1/60,sceneScale:.25,storageEV:-2,rawPerCandela:3.6e-5};
    const clusters=[{position:[5,90,8],radius:3,color:[.5,.6,1],referenceCandela:100,mergedEventIds:[1,2]},{position:[-10,150,-6],radius:6,color:[1,.3,.2],referenceCandela:250,eventId:3}];
    const receivers=Array.from({length:16},(_,i)=>({position:[i,50,0],radius:.1,color:[1,.2,.1],referenceCandela:i+1}));
    full.update({frame,camera,sunAltitude:-20,clusters:receivers});env.update({frame,clusters});
    assert.equal(full.records.length,20);assert.equal(env.records.length,6);assert.equal(env.uniforms.uLocalPosition.value.length,6);
    for(const name of ['uLocalPosition','uLocalColour','uLocalDirection','uLocalCone'])for(let i=0;i<4;i++)assert.deepEqual(env.uniforms[name].value[i].toArray(),full.uniforms[name].value[i].toArray());
    for(let j=0;j<2;j++)for(let c=0;c<3;c++)approx(env.records[4+j].rawRGB[c],clusters[j].color[c]*clusters[j].referenceCandela*frame.rawPerCandela);
    full.setSceneExposure(-1);env.setSceneExposure(-1);
    for(let i=0;i<4;i++)assert.deepEqual(env.uniforms.uLocalColour.value[i].toArray(),full.uniforms.uLocalColour.value[i].toArray());
    for(let j=0;j<2;j++)for(let c=0;c<3;c++)approx(env.uniforms.uLocalColour.value[4+j].getComponent(c),env.records[4+j].rawRGB[c]*.5);
    env.update({frame:{...frame,time:20,storageEV:-1,sceneScale:.5},clusters:[]});
    assert(env.records.slice(4).every(r=>r.candela===0&&r.rawRGB.every(x=>x===0)));
    assert(env.uniforms.uLocalColour.value.slice(4).every(v=>v.x===0&&v.y===0&&v.z===0));
    return {receivers:16,fixtures:4,environmentProxies:2,extinctionZero:true};
  }finally{full.dispose();}
});
check('actual launched fireworks conserve RGB through two merged cloud proxies',()=>{
  const f=createFireworks(THREE,{terrainHeight:()=>0,origin:[29,1.3,7],simulationOptions:{referenceBrightnessGain:64,maxActive:32}});
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),full=createLocalLights(THREE,{scene}),env=createEnvironmentLocalLights(THREE,full);
  let nonzero=0,merged=0,last=0;
  try{
    f.configure({autoLaunch:false,autoDirection:false,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0});
    f.update({time:0,windVector:[1,0,.5]});for(const [i,type]of ['peony','willow','chrysanthemum'].entries())f.launch({type,seed:7821+i,azimuth:55+i*90});
    const times=[0,.1,.5,1,1.5,2,3,4,5,7,10,14,18,22,28];
    for(const time of times){
      f.update({time,windVector:[1,0,.5]});const cloud=f.getLightClusters(),receivers=f.getReceiverLightClusters(),frame={time,dt:1/30,sceneScale:.5,storageEV:-1,rawPerCandela:3.6e-5};
      assert(cloud.length<=2);assert(receivers.length<=16);
      let cloudI=0,receiverI=0;const cloudRGB=[0,0,0],receiverRGB=[0,0,0];
      for(const c of cloud){cloudI+=c.referenceCandela;for(let k=0;k<3;k++)cloudRGB[k]+=c.referenceCandela*c.color[k];}
      for(const c of receivers){receiverI+=c.referenceCandela;for(let k=0;k<3;k++)receiverRGB[k]+=c.referenceCandela*c.color[k];}
      approx(cloudI,receiverI);for(let k=0;k<3;k++)approx(cloudRGB[k],receiverRGB[k]);
      full.update({frame,camera,sunAltitude:-20,clusters:receivers});env.update({frame,clusters:cloud});
      assert.equal(env.records.length,6);assert.equal(full.records.length,20);
      for(let k=0;k<3;k++)approx(env.records[4].rawRGB[k]+env.records[5].rawRGB[k],cloudRGB[k]*frame.rawPerCandela);
      if(cloud.length)nonzero++;if(cloud.some(c=>c.mergedEventIds?.length>1))merged++;
      if(time===times.at(-1)){last=cloud.length;assert.equal(last,0);assert(env.records.slice(4).every(r=>r.rawRGB.every(x=>x===0)));}
    }
    assert(nonzero>3);assert(merged>0);
    return {sampledPhases:times.length,nonzeroPhases:nonzero,mergedPhases:merged,lastClusterCount:last,extinctionZero:true};
  }finally{full.dispose();f.dispose();}
});

const report={schema:'glass-atoll.environment6-preflight.v1',passed:checks.every(c=>c.passed),checks,actualGPU:false,limits:['No browser, GPU shader compilation, first-frame timing or pixel comparison was performed.','Two cloud clusters preserve total I/RGB but may be spatially inaccurate for simultaneous far-separated shows.','Source records follow actual physical firework state without temporal smoothing, with zero after expiration.']};
fs.writeFileSync(new URL('preflight.json',folder),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
