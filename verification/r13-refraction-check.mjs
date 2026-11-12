import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),source=read('water.js'),baseline=read('verification/r13-refraction-baseline-water.js'),checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}};
const cloud=read('cloud-lighting.js').match(/export const cloudShadowLookupGLSL=\/\* glsl \*\/(\`[\s\S]*?\`);/)[1];
const instrumented=source.replace("import { cloudShadowLookupGLSL } from './cloud-lighting.js';",'const cloudShadowLookupGLSL='+cloud+';').replace("from 'three'",'from '+JSON.stringify(new URL('vendor/three.module.js',root).href)).replace(/from '\.\/([^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,root).href));
const {createWater,normaliseSubmergedObjects,MAX_SUBMERGED_OBJECTS}=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
const close=(a,b,t=1e-10)=>assert(Math.abs(a-b)<=t,`${a} != ${b}`),V=(x,y,z)=>new THREE.Vector3(x,y,z);
let water,scene,sky,sand;
try{
check('Original water baseline sealed; no added render target, sampler or screen-edge bed fallback',()=>{
  assert.equal(hash(baseline),'7f3ba0f5eaa599ac8cf60dcc299a440d134a708ea336ae7e8999081a883df4c8');
  assert.equal((source.match(/new THREE\.WebGLRenderTarget/g)||[]).length,(baseline.match(/new THREE\.WebGLRenderTarget/g)||[]).length);
  const samplers=s=>[...s.matchAll(/uniform\s+(?:highp\s+)?sampler\w+\s+([^;]+);/g)].map(m=>m[0]).sort();assert.deepEqual(samplers(source),samplers(baseline));assert(!source.includes('objectAboveBed'));assert(!source.includes('safeUV=clamp(refrUV'));assert(source.includes('if(uSubmergedCount==0)return false'));
  return{additionalSamplers:0,additionalTargets:0,maximumBounds:MAX_SUBMERGED_OBJECTS};
});
check('Snapshots preserve real2.5cm radius, copy ownership, freeze inputs and reject malformed batches',()=>{
  const input=[{id:4,position:[1,-.2,3],diameterMetres:.025}],snapshot=normaliseSubmergedObjects(input);assert.equal(snapshot[0].radiusMetres,.0125);assert(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot[0])&&Object.isFrozen(snapshot[0].position));input[0].position[0]=99;assert.equal(snapshot[0].position[0],1);
  for(const bad of [null,{},Array.from({length:37},()=>({position:[0,0,0],radiusMetres:.01})),[{position:[0,NaN,0],radiusMetres:.01}],[{position:[0,0,0],radiusMetres:0}],[{position:[0,0],radiusMetres:.01}],[{position:[0,0,0],diameterMetres:Infinity}]])assert.throws(()=>normaliseSubmergedObjects(bad));
  assert.equal(normaliseSubmergedObjects(Array.from({length:36},(_,i)=>({position:[i,-.2,0],radiusMetres:.0125}))).length,36);return{copied:true,realRadius:.0125,maximum:36,rejected:7};
});
check('Actual factory setter defaults empty, validates atomically, clears unused slots and avoids unchanged revision churn',()=>{
  scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,1,.05,100);camera.position.set(0,1,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();sky=new THREE.CubeTexture();sand=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);const atmosphere={uniforms:{},mesh:{visible:true}},indirect={uniforms:{},glsl:'vec3 getIndirectIrradiance(vec3 p,vec3 n){return vec3(0.);}'};
  water=createWater({capabilities:{maxSamples:0},getContext:()=>({MAX_SAMPLES:0,getParameter:()=>0})},scene,camera,V(0,1,0),{terrainHeight:()=>-1,skyCube:sky,sandTexture:sand,atmosphere,waveSpectrum:{uniforms:{}},indirectLighting:indirect});
  assert.equal(water.uniforms.uSubmergedCount.value,0);assert.equal(water.setSubmergedObjects([]).revision,0);
  const input=[{id:1,position:[0,-.2,0],diameterMetres:.025}],a=water.setSubmergedObjects(input);assert(a.changed);const before=JSON.stringify(water.diagnostics().submergedProps);assert.throws(()=>water.setSubmergedObjects([...input,{position:[NaN,0,0],radiusMetres:.1}]));assert.equal(JSON.stringify(water.diagnostics().submergedProps),before);assert.equal(water.setSubmergedObjects(input).changed,false);assert.equal(water.setSubmergedObjects(input).revision,a.revision);
  water.setSubmergedObjects([]);assert.equal(water.uniforms.uSubmergedCount.value,0);assert(water.uniforms.uSubmergedBounds.value.every(v=>v.toArray().every(x=>x===0)));return{submittedRadius:.0125,atomic:true,noRevisionChurn:true};
});
function refract(incident,normal,eta){const c=normal.dot(incident),k=1-eta*eta*(1-c*c);return incident.clone().multiplyScalar(eta).addScaledVector(normal,-eta*c-Math.sqrt(k));}
function traceReference({camera,entry,ray,sphere,bedDistance=2,aux}){
  let calls=0;const projected=p=>{const q=p.clone().project(camera);return new THREE.Vector2(q.x*.5+.5,q.y*.5+.5);};
  const c=sphere.center.clone().sub(entry),closest=c.dot(ray),perp=c.clone().addScaledVector(ray,-closest),disc=sphere.radius**2-perp.lengthSq();if(disc<=0)return{hit:false,calls};let lo=Math.max(.00001,closest-Math.sqrt(disc)),hi=Math.min(bedDistance,closest+Math.sqrt(disc));if(hi<=lo)return{hit:false,calls};
  const probe=s=>{const p=entry.clone().addScaledVector(ray,s),uv=projected(p);if(uv.x<=0||uv.x>=1||uv.y<=0||uv.y>=1)return null;calls++;const q=aux(uv);if(!q)return null;const tolerance=.0001;if(q.distanceTo(sphere.center)>sphere.radius+tolerance||q.y-entry.y>=0)return null;return{q,error:p.clone().sub(q).dot(p.clone().sub(camera.position).normalize()),uv};};
  let previous=lo,bracket=false,highSample;for(let j=0;j<4;j++){const s=lo+(hi-lo)*j/3,q=probe(s);if(q&&q.error>=0){lo=previous;hi=s;highSample=q;bracket=true;break;}previous=s;}if(!bracket)return{hit:false,calls};
  for(let j=0;j<6;j++){const mid=(lo+hi)/2,q=probe(mid);if(q&&q.error>=0){hi=mid;highSample=q;}else lo=mid;}const q=highSample,delta=q.q.clone().sub(entry),t=delta.dot(ray),error=delta.addScaledVector(ray,-t).length(),tolerance=.0001+(hi-lo);return{hit:t>.00001&&t<bedDistance&&error<=tolerance,calls,t,error,point:q.q};
}
check('Snell-ray bound search recovers the real2.5cm receiver before bed at normal/oblique views',()=>{
  const rows=[];for(const degrees of [0,20,45,65]){const angle=degrees*Math.PI/180,camera=new THREE.PerspectiveCamera(50,1,.01,100);camera.position.set(-Math.sin(angle),Math.cos(angle),0);camera.lookAt(0,0,0);camera.updateMatrixWorld();const entry=V(0,0,0),ray=refract(entry.clone().sub(camera.position).normalize(),V(0,1,0),1/1.333),sphere=new THREE.Sphere(ray.clone().multiplyScalar(.4),.0125),actual=new THREE.Sphere(sphere.center,.011625);
    const aux=uv=>{const d=V(uv.x*2-1,uv.y*2-1,1).unproject(camera).sub(camera.position).normalize();return new THREE.Ray(camera.position,d).intersectSphere(actual,new THREE.Vector3());};
    const result=traceReference({camera,entry,ray,sphere,aux});assert(result.hit);close(result.t,.4-.011625,.0005);assert(result.calls<=10);rows.push({degrees,hitDistance:result.t,exact:.4-.011625,errorMetres:result.error,depthProbes:result.calls,actualDiameter:.02325,boundingDiameter:.025});}
  return rows;
});
check('Offscreen, above-water, below-bed and occluded auxiliary geometry cannot produce a coloured proxy',()=>{
  const camera=new THREE.PerspectiveCamera(20,1,.01,100);camera.position.set(0,1,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();const entry=V(0,0,0),ray=V(0,-1,0),sphere=new THREE.Sphere(V(0,-.3,0),.0125),auxOccluded=()=>V(0,.1,0);
  assert.equal(traceReference({camera,entry,ray,sphere,aux:auxOccluded}).hit,false);
  assert.equal(traceReference({camera,entry,ray,sphere:new THREE.Sphere(V(0,.2,0),.0125),aux:()=>{throw Error('must reject before depth');}}).hit,false);
  assert.equal(traceReference({camera,entry,ray,sphere:new THREE.Sphere(V(0,-3,0),.0125),bedDistance:2,aux:()=>{throw Error('must reject before depth');}}).hit,false);
  const oblique=V(.7,-.714142842854285,0),off=new THREE.Sphere(oblique.clone().multiplyScalar(1),.0125),result=traceReference({camera,entry,ray:oblique,sphere:off,aux:()=>{throw Error('offscreen sample must not clamp');}});assert.equal(result.hit,false);assert.equal(result.calls,0);return{occluded:false,aboveWater:false,belowBed:false,offscreenDepthReads:0};
});
check('Beer length is true receiver distance, never bed distance; no second geometry scale or screen slab',()=>{
  const extinction=[.164,.044,.032],actual=.3,bed=2,correct=extinction.map(v=>Math.exp(-v*actual)),wrong=extinction.map(v=>Math.exp(-v*bed));assert(correct.every((v,c)=>v>wrong[c]));
  assert(source.indexOf('if(objectHit){pathLength=objectDistance;receiver=vWorld+T*pathLength;}')<source.indexOf('vec3 transmission=exp(-extinction*pathLength)'));assert(source.includes('sunlightPath=max(.0,-receiver.y)'));assert(source.includes('volumePoint=vWorld+T*(pathLength*.5)'));assert(source.includes('if(objectHit)refracted=objectColour*solarTransmission;'));
  assert(!source.includes('objectAboveBed>.06'));assert(source.includes('vec3 perpendicular=centre-ray*closest'));assert(source.includes('dot(q-entry,waterNormal)>=0.'));return{receiverMetres:actual,bedMetres:bed,correctTransmission:correct,wrongBedTransmission:wrong};
});
}finally{if(water){scene.remove(water.mesh);water.mesh.geometry.dispose();water.mesh.material.dispose();water.refraction.dispose();water.reflection.dispose();water.treeShadow.dispose();for(const k of ['uHeightMap','uCaustic','uHydroState'])water.uniforms[k].value?.dispose?.();}sky?.dispose();sand?.dispose();}
const report={kind:'R13 bounded submerged-prop geometry, snapshot and optical-path CPU checks; actual GPU pending',passed:checks.every(c=>c.passed),count:checks.length,checks,runtimeSHA256:hash(source),baselineSHA256:hash(baseline),limits:['Geometry probe model uses independent analytic sphere auxiliary visibility; production triangle/depth rasterization needs GPU fixtures.','No scene photorealism/FPS/driver/context acceptance.','Actual captured native RGB has no lighting decomposition; one receiver-depth incoming attenuation remains an explicit approximation.']};fs.writeFileSync(new URL('r13-refraction-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
