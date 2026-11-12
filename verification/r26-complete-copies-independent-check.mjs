import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createSmokeTransmissionGPU} from '../pyro-smoke-transmission-gpu.js';
import {createCompleteTransmissionCandidate} from './r26-complete-transmission-candidate.js';
import {TransmissionCPURenderer as Renderer} from './r26-transmission-cpu-renderer.js';
import {transmissionLayoutGPUFixture} from './r23-transmission-layout-gpu-check.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8').replaceAll('\r\n','\n'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,import.meta.url))).digest('hex'),words=a=>new Uint32Array(a.buffer,a.byteOffset,a.length),checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}};
check('Copied physical pack body is exactly incumbent code after the single policy-argument rename',()=>{
 const a=read('../pyro-smoke-transmission-pack.js'),b=read('./r26-transmission-pack-candidate.js').replaceAll('maxRequestPairs','maxPairs');
 assert.equal(b.slice(b.indexOf('function shape(')),a.slice(a.indexOf('function shape(')));
 return {scope:'All SPD validation, binary64 coordinates, Float32 writes, diagnostics and source ordering after shape() are exact code copies; constructor policy independently differs'};
});
check('Copied layout reverses exactly to incumbent with only enumerated policy/schema/documentation changes',()=>{
 let b=read('./r26-transmission-layout-candidate.js');
 const replacements=[
  ["from './r26-transmission-pack-candidate.js'","from './pyro-smoke-transmission-pack.js'"],
  ["'glass-atoll.r26.verification-transmission-layout.v1'","'glass-atoll.smoke-transmission-layout.v1'"],
  ['maxSources=64,maxPackets=48,maxRequestPairs=3072', 'maxSources=64,maxPackets=48,maxPairs=3072'],
  ['  const maxPairs=maxRequestPairs;\n',''],
  ['  // Same allocation proof; only the explicit verification request-policy ceiling differs.','  // Keep exactly the existing constructor limits and whole-request pair gate.'],
  ['{maxSources,maxPackets,maxRequestPairs}', '{maxSources,maxPackets,maxPairs}'],
  ['Exact numerical layout only: no packet/source reduction or frame-time admission; request allowance is explicit verification policy only.','Exact numerical layout only: no packet/source reduction, new pair allowance or frame-time admission.']
 ];
 for(const [from,to]of replacements){assert.equal(b.split(from).length,2,'Strict one-change inverse: '+from);b=b.replace(from,to);}
 assert.equal(b,read('../smoke-transmission-layout.js'));return {strictInverseChanges:replacements.length,noLayoutEquationChange:true};
});
check('129x65 actual factories have exact expanded shaders/materials/geometry and padded uploads, with complete source order',()=>{
 const value=transmissionLayoutGPUFixture(129,65,2621),before=structuredClone(value),r=new Renderer(),oldr=new Renderer(),caps={maxSources:129,maxPackets:65},f=createCompleteTransmissionCandidate(THREE,r,{...caps,maxRequestPairs:16384,maxMapPairs:16384,maxMapDraws:2}),old=createSmokeTransmissionGPU(THREE,oldr,{...caps,maxPairs:16384});let during=[];const draw=r.render.bind(r);r.render=(...args)=>{during.push(f.texture);return draw(...args);};
 try{
  const initial=r.snapshot(),result=f.prepare(value);assert.deepEqual(r.snapshot(),initial);assert.equal(result?.then,undefined);assert.equal(result.effective,true);assert.equal(result.policy.mapDraws,2);assert.equal(result.count,129);assert.equal(result.sourceVersion,2621);assert.equal(during.length,3);assert.ok(during.every(x=>x===null));old.prepare(value);assert.deepEqual(value,before);
  assert.equal(r.calls.length,3);assert.deepEqual(r.calls.map(c=>c.rect),[[0,0,256,1],[0,1,2,1],[0,0,256,1]]);
  assert.deepEqual(words(f.packed.packetData),words(old.packed.packetData));assert.deepEqual(words(f.packed.sourceData),words(old.packed.sourceData));
  for(let i=0;i<3;i++){const a=r.calls[i],b=oldr.calls[i===2?1:0];for(const key of ['vertexShader','fragmentShader','side','transparent','forceSinglePass','depthTest','depthWrite','blending','glslVersion','toneMapped'])assert.equal(a.material[key],b.material[key]);assert.equal(a.material.forceSinglePass,true);assert.deepEqual(a.geometry.getAttribute('position').array,b.geometry.getAttribute('position').array);for(const key of ['uPacketWidth','uSourceWidth','uPartialWidth','uPacketCount','uSourceCount','uSourceStride','uTileCount','uOutputWidth'])assert.equal(a.uniforms[key],b.uniforms[key]);}
  const writes=r.calls.slice(0,2).flatMap(c=>c.writes);assert.deepEqual(writes,Array.from({length:258},(_,i)=>i));assert.deepEqual(words(r.textureData.get(f.texture)).slice(0,129*4),words(oldr.textureData.get(old.texture)).slice(0,129*4));
  return {drawRectangles:r.calls.map(c=>c.rect),logicalPairs:result.pairs,conservativeMapPairs:result.policy.conservativeMapPairs,partialValidTexels:writes.length,scope:'Real Three materials/factories over disclosed shared inert CPU plumbing; numerical tags do not execute GLSL'};
 }finally{f.dispose();old.dispose();}
});
check('Map-only constructor limit is explicit; rejected first/next prepares expose no output and perform no new render/context work',()=>{
 const r=new Renderer(),f=createCompleteTransmissionCandidate(THREE,r,{maxSources:129,maxPackets:65,maxRequestPairs:16384,maxMapPairs:16384,maxMapDraws:1});
 try{const result=f.prepare(transmissionLayoutGPUFixture(129,65,2621));assert.equal(result.effective,false);assert.equal(result.reason,'map-draw-capacity');assert.equal(f.texture,null);assert.equal(f.target,null);assert.equal(r.calls.length,0);assert.equal(r.contextGets,0);
  assert.equal(f.prepare(transmissionLayoutGPUFixture(1,65,2622)).effective,true);assert.ok(f.texture);const calls=r.calls.length,gets=r.contextGets;const next=f.prepare(transmissionLayoutGPUFixture(129,65,2623));assert.equal(next.effective,false);assert.equal(f.texture,null);assert.equal(f.target,null);assert.equal(r.calls.length,calls);assert.equal(r.contextGets,gets);
  return {maxMapDraws:1,rejectedBeforeContext:true,nextRejectedAfterGoodGeneration:true};}finally{f.dispose();}
});
const report={schema:'glass-atoll.r26-complete-copies-independent-cpu.v1',dateUTC:new Date().toISOString(),actualGPU:false,productionEdited:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,pins:Object.fromEntries(['./r26-complete-transmission-candidate.js','./r26-transmission-pack-candidate.js','./r26-transmission-layout-candidate.js','./r26-transmission-rectangles.js','../pyro-smoke-transmission-gpu.js','../pyro-smoke-transmission-pack.js','../smoke-transmission-layout.js'].map(p=>[p,hash(p)])),limits:['Shared owner inert CPU renderer reused for upload/state/routing plumbing only.','Independent exact-copy transforms, expanded shader equality, ordered coverage and public-result timing do not establish hardware accuracy/timing.','129x65 is a fixed small row-straddle admission fixture; no automatic755x1734 or production/native dispatch permission.']};
fs.writeFileSync(new URL('./r26-complete-copies-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
