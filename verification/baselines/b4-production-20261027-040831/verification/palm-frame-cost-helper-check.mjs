// Control-flow/cleanup tests only. The synthetic query values are NOT GPU
// timings and are never persisted as a runtime performance report.
import {runPalmFrameCostGPUCheck as run} from './palm-frame-cost-gpu-check.js';
import * as THREE from '../vendor/three.module.js';
import assert from 'node:assert/strict';
globalThis.innerWidth=1209;globalThis.innerHeight=1292;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=fn=>queueMicrotask(()=>fn(0));
function fixture({disjoint=false,throwDraw=0,extension=true}={}){
  const p={paused:false,sun:{azimuth:220,elevation:12,intensity:.8},weather:{humidity:.68},qualityPreset:'medium',qualityCustom:false,graphics:{indirect:'low',hdr:false},renderSampling:{indirect:'low',cloudSteps:64},lens:{focal:28,dof:false}};
  const s={ready:true,time:12,parameters:p,camera:[-48,12,-40],target:[0,2.5,0],renderScale:1,lens:{width:1209,height:1292,outputWidth:1209,outputHeight:1292,samples:8}};
  const c={utcMs:1234,observer:{latitudeDeg:4.5,longitudeDeg:118.6,heightM:2,northYawDeg:0},rate:1,running:true,mode:'astronomical',refraction:'standard',timeZoneOffsetMinutes:480};
  let mode='legacy',lighting={mode:'night',linked:true,lamps:[{enabled:true}],flashlight:{enabled:true}},draws=0,created=0,deleted=0,active=null,disjointReads=0;
  const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2},gl={CURRENT_QUERY:3,QUERY_RESULT_AVAILABLE:4,QUERY_RESULT:5,getExtension:()=>extension?ext:null,getQuery:()=>active,getParameter:()=>++disjointReads>1&&disjoint,isContextLost:()=>false,createQuery:()=>({id:++created,value:mode==='legacy'?1e6:1.1e6}),deleteQuery:()=>{deleted++;},beginQuery:(t,q)=>{assert.equal(active,null);active=q;},endQuery:()=>{assert(active);active=null;},getQueryParameter:(q,k)=>k===4?true:q.value,flush:()=>{}};
  let target=null,face=0,mip=0,viewport=new THREE.Vector4(0,0,1209,1292),scissor=viewport.clone(),test=false,clear=new THREE.Color(.2,.3,.4),alpha=1;
  const renderer={getContext:()=>gl,getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,getViewport:v=>v.copy(viewport),getCurrentViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>test,getClearColor:v=>v.copy(clear),getClearAlpha:()=>alpha,setClearColor:(v,a)=>{clear.copy(v);alpha=a;},setViewport:v=>viewport.copy(v),setScissor:v=>scissor.copy(v),setScissorTest:v=>{test=v;},setRenderTarget:(v,f,m)=>{target=v;face=f;mip=m;},autoClear:true,autoClearColor:true,autoClearDepth:true,autoClearStencil:true,toneMapping:0,toneMappingExposure:1,shadowMap:{autoUpdate:false,needsUpdate:false},xr:{enabled:false}};
  const a={get state(){return structuredClone(s);},pause:v=>{p.paused=v;},celestial:()=>structuredClone(c),setTime:v=>{for(const[k,x]of Object.entries(v))if(!(k in c.observer))c[k]=x;},setSun:v=>{p.sun={...p.sun,...v};c.mode='artistic';},setCamera:(x,t)=>{s.camera=[...x];s.target=[...t];},setGraphics:async v=>{if(v.indirect!==undefined&&v.indirect!==p.graphics.indirect)p.qualityCustom=true;Object.assign(p.graphics,v);p.renderSampling.indirect=p.graphics.indirect;},setQuality:async v=>{p.qualityPreset=v;p.graphics.indirect='low';p.renderSampling.indirect='low';p.qualityCustom=false;},setLens:v=>{p.lens=structuredClone(v);},setLocalLights:v=>{lighting={...lighting,...v,flashlight:{...lighting.flashlight,...v.flashlight}};},localLights:()=>structuredClone(lighting),palmFrameDiagnostics:()=>({mode}),setPalmFrameMode:v=>{assert.equal(p.graphics.indirect,'off');mode=v;return{mode};},weather:()=>({current:{humidity:.68}}),photometry:()=>({storageEV:0})};
  return{renderer,a,draw:()=>{draws++;if(draws===throwDraw)throw Error('injected draw failure');},counts:()=>({draws,created,deleted,active})};
}
const checks=[];
{
  const f=fixture(),r=await run(THREE,f.renderer,f.a,f.draw);assert.equal(r.passed,true,JSON.stringify(r.checks.filter(c=>!c.passed)));assert.equal(r.results.length,3);
  for(const x of r.results){assert.equal(x.legacyGPU.count,16);assert.equal(x.transportGPU.count,16);assert.equal(x.legacyGPU.meanMs,1);assert(Math.abs(x.transportGPU.meanMs-1.1)<1e-14);assert(Math.abs(x.transportOverLegacy.mean-1.1)<1e-14);assert.deepEqual(x.blocks.map(b=>b.mode),['legacy','transport','transport','legacy']);}
  assert.deepEqual(f.counts(),{draws:144,created:96,deleted:96,active:null});assert.equal(f.a.state.parameters.paused,false);checks.push('96 query counts, alternating order, ns-to-ms conversion, full restoration');
}
{
  const f=fixture({disjoint:true}),r=await run(THREE,f.renderer,f.a,f.draw);assert.equal(r.status,'inconclusive');assert.equal(r.allTimingInvalid,true);assert.equal(f.counts().created,f.counts().deleted);assert.equal(f.a.state.parameters.paused,false);checks.push('disjoint invalidates collection and restores scene');
}
{
  const f=fixture({throwDraw:5}),r=await run(THREE,f.renderer,f.a,f.draw);assert.equal(r.status,'inconclusive');assert.equal(f.counts().active,null);assert.equal(f.counts().created,f.counts().deleted);assert.equal(f.a.state.parameters.graphics.indirect,'low');checks.push('draw exception closes own query, deletes resources, restores GI');
}
{
  const f=fixture({extension:false}),r=await run(THREE,f.renderer,f.a,f.draw);assert.equal(r.status,'unavailable');assert.equal(f.counts().draws,0);assert.equal(f.a.state.parameters.paused,false);checks.push('missing timer makes no measurement and changes no scene state');
}
console.log(JSON.stringify({scope:'CPU mock control-flow only. Synthetic query values are not hardware timing.',passed:true,passedCount:checks.length,total:checks.length,checks},null,2));
