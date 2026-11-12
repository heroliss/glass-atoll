import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {chooseEnvironmentExposure,createEnvironmentCapture} from '../environment-capture.js';

const checks=[];
function check(name,fn){try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.stack});}}

class FixtureRenderer {
  constructor(){
    this.coordinateSystem=THREE.WebGLCoordinateSystem;this.target=new THREE.WebGLRenderTarget(100,70);
    this.target.viewport.set(2,3,81,61);this.target.scissor.set(3,4,61,41);this.target.scissorTest=true;
    this.face=2;this.mip=1;this.viewport=new THREE.Vector4(8,9,80,60);this.scissor=new THREE.Vector4(4,5,50,40);
    this.actualViewport=new THREE.Vector4(7,8,71,51);this.actualScissor=new THREE.Vector4(6,7,41,31);this.actualScissorTest=true;this.scissorTest=false;
    this.autoClear=false;this.autoClearColor=false;this.autoClearDepth=true;this.autoClearStencil=false;
    this.toneMapping=THREE.ACESFilmicToneMapping;this.toneMappingExposure=.76;this.outputColorSpace=THREE.SRGBColorSpace;
    this.xr={enabled:true};this.shadowMap={enabled:true,autoUpdate:false,needsUpdate:true};this.color=new THREE.Color(.2,.3,.4);this.alpha=.3;
    this.records=[];this.failRender=false;this.textureTargets=new Map();
  }
  getRenderTarget(){return this.target;}getActiveCubeFace(){return this.face;}getActiveMipmapLevel(){return this.mip;}
  getViewport(value){return value.copy(this.viewport);}getCurrentViewport(value){return value.copy(this.actualViewport);}
  getScissor(value){return value.copy(this.scissor);}getScissorTest(){return this.scissorTest;}
  getClearColor(value){return value.copy(this.color);}getClearAlpha(){return this.alpha;}
  getContext(){return {SCISSOR_BOX:1,SCISSOR_TEST:2,getParameter:()=>this.actualScissor.toArray(),isEnabled:()=>this.actualScissorTest};}
  setViewport(value){this.viewport.copy(value);this.actualViewport.copy(value);}
  setScissor(value){this.scissor.copy(value);this.actualScissor.copy(value);}
  setScissorTest(value){this.scissorTest=value;this.actualScissorTest=value;}
  setClearColor(value,alpha){this.color.set(value);this.alpha=alpha;}
  setRenderTarget(target,face=0,mip=0){
    this.target=target;this.face=face;this.mip=mip;
    this.actualViewport.copy(target?.viewport??this.viewport);this.actualScissor.copy(target?.scissor??this.scissor);this.actualScissorTest=target?.scissorTest??this.scissorTest;
  }
  render(scene,camera){
    if(this.failRender)throw new Error('fixture render failure');
    const u=scene.children[0].material.uniforms,live=this.atmosphere.live;
    const record={face:this.face,time:live.time,utcMs:live.utcMs,weather:live.weather,captureEV:Math.log2(u.uSkyPreExposure.value),solar:u.uSolarDisk.value,
      steps:scene.children[0].material.defines.CLOUD_STEPS,position:camera.getWorldPosition(new THREE.Vector3()).toArray(),generateMipmaps:this.target.texture.generateMipmaps};
    this.target.fixtureFaces??=[];this.target.fixtureFaces[this.face]=record;this.textureTargets.set(this.target.texture,this.target);this.records.push(record);
  }
  snapshot(){return {target:this.target,face:this.face,mip:this.mip,viewport:this.viewport.toArray(),actualViewport:this.actualViewport.toArray(),scissor:this.scissor.toArray(),actualScissor:this.actualScissor.toArray(),scissorTest:this.scissorTest,actualScissorTest:this.actualScissorTest,color:this.color.toArray(),alpha:this.alpha,
    autoClear:this.autoClear,autoClearColor:this.autoClearColor,autoClearDepth:this.autoClearDepth,autoClearStencil:this.autoClearStencil,toneMapping:this.toneMapping,toneMappingExposure:this.toneMappingExposure,outputColorSpace:this.outputColorSpace,xr:this.xr.enabled,shadow:{...this.shadowMap},targetViewport:this.target?.viewport.toArray(),targetScissor:this.target?.scissor.toArray(),targetScissorTest:this.target?.scissorTest};}
}

function fixture(options={}){
  let wall=0;const renderer=new FixtureRenderer(),published=[];
  const uniforms={uSolarDisk:{value:1},uSkyPreExposure:{value:1},sunPosition:{value:new THREE.Vector3(0,1,0)}};
  const material=new THREE.ShaderMaterial({uniforms,defines:{CLOUD_STEPS:64}}),mesh=new THREE.Mesh(new THREE.SphereGeometry(2,4,2),material);
  const atmosphere={mesh,uniforms,live:{time:0,utcMs:1700000000000,recommendedEV:21,maxRGB:.00001,weather:.3,physicalRevision:0},prepared:[],failPrepare:false,
    captureSnapshot(){return {time:this.live.time,utcMs:this.live.utcMs,physicalSkyRevision:this.live.physicalRevision,uniforms:{uSolarDisk:uniforms.uSolarDisk.value,uSkyPreExposure:uniforms.uSkyPreExposure.value,sunPosition:uniforms.sunPosition.value.clone()},live:{...this.live}};},
    withSnapshot(snapshot,fn){const saved=this.captureSnapshot();const apply=value=>{this.live={...value.live};uniforms.uSolarDisk.value=value.uniforms.uSolarDisk;uniforms.uSkyPreExposure.value=value.uniforms.uSkyPreExposure;uniforms.sunPosition.value.copy(value.uniforms.sunPosition);};try{apply(snapshot);return fn();}finally{apply(saved);}},
    setStorageExposureEV(value){uniforms.uSkyPreExposure.value=2**value;},
    lighting(){return {recommendedExposureEV:this.live.recommendedEV};},getRadianceBound(){return {maxRGB:this.live.maxRGB};},
    prepareStarView(r,camera,options){if(this.failPrepare)throw new Error('fixture prepare failure');this.prepared.push({utcMs:this.live.utcMs,time:this.live.time,storageEV:options.storageEV,frame:{...options.frame}});},
  };
  renderer.atmosphere=atmosphere;
  const pmrem={calls:[],fail:false,disposed:false,
    fromCubemap(texture,target){if(this.fail)throw new Error('fixture PMREM failure');const source=renderer.textureTargets.get(texture);assert.equal(source.fixtureFaces.filter(Boolean).length,6);target??=new THREE.WebGLRenderTarget(16,16);
      target.fixtureFaces=source.fixtureFaces.map(face=>({...face}));this.calls.push({source,target,faces:target.fixtureFaces});renderer.autoClear=false;renderer.setRenderTarget(target);return target;},
    dispose(){this.disposed=true;},
  };
  const capture=createEnvironmentCapture(THREE,renderer,{atmosphere,cubeSize:16,pmremGenerator:pmrem,now:()=>wall,onPublish:value=>published.push(value),...options});
  const args=patch=>({time:atmosphere.live.time,utcMs:atmosphere.live.utcMs,storageEV:0,physicalRevision:atmosphere.live.physicalRevision,sunDirection:uniforms.sunPosition.value.toArray(),...patch});
  function tick(value,patch={}){wall=value;atmosphere.live.time=value;atmosphere.live.utcMs=1700000000000+value*1000;return capture.update(args(patch));}
  return {renderer,atmosphere,pmrem,capture,published,args,tick,setWall:value=>{wall=value;}};
}

check('safe daylight exposure chosen from independent source bound',()=>{
  const e=chooseEnvironmentExposure({recommendedEV:0,maxRGB:32000});assert.equal(e.captureEV,-1);assert(e.storedBound<=65504/4);assert(32000*2**(e.captureEV+1)>65504/4);
});
check('weak night source retains recommended 21 EV',()=>{
  const e=chooseEnvironmentExposure({recommendedEV:21,maxRGB:1e-5});assert.equal(e.captureEV,21);assert(e.storedBound<=65504/4);
});
check('weak-source storage precision independent of disabled camera auto exposure',()=>{
  const e=chooseEnvironmentExposure({recommendedEV:0,maxRGB:1e-8});assert.equal(e.captureEV,21);assert.equal(e.recommendedEV,0);assert.equal(e.preferredEV,21);
});
check('bad source bound rejected before rendering',()=>{
  for(const maxRGB of [-1,NaN,Infinity])assert.throws(()=>chooseEnvironmentExposure({maxRGB}),RangeError);
});
check('initial complete capture, stars each face and solar disk suppressed',()=>{
  const f=fixture();try{f.capture.initialize(f.args());assert.equal(f.published.length,1);assert.equal(f.renderer.records.length,6);assert.equal(f.pmrem.calls.length,1);
    assert(f.renderer.records.every(r=>r.solar===0&&r.captureEV===21));assert.deepEqual(f.renderer.records.map(r=>r.generateMipmaps),[false,false,false,false,false,true]);
    assert.equal(f.atmosphere.prepared.length,6);assert.equal(f.atmosphere.uniforms.uSolarDisk.value,1);
  }finally{f.capture.dispose();}
});
check('renderer target/face/mip/global and actual viewport/scissor all restored',()=>{
  const f=fixture();try{const before=f.renderer.snapshot();f.capture.initialize(f.args());assert.deepEqual(f.renderer.snapshot(),before);}finally{f.capture.dispose();}
});
check('initial publication includes coherent cube/PMREM EV and age tags',()=>{
  const f=fixture();try{const p=f.capture.initialize(f.args({storageEV:-10}));assert.equal(p.cubeCaptureEV,21);assert.equal(p.environmentCaptureEV,21);assert.equal(p.cubeRatio,2**-31);assert.equal(p.environmentRatio,2**-31);assert.equal(p.cubeTag.utcMs,p.environmentTag.utcMs);}finally{f.capture.dispose();}
});
check('scene P-only changes do not render or change captured source exposure',()=>{
  const f=fixture();try{f.capture.initialize(f.args());const initial=f.renderer.records.length;assert.deepEqual(f.capture.setSceneExposure(-20),{cubeRatio:2**-41,environmentRatio:2**-41});
    f.setWall(.2);f.capture.update(f.args({storageEV:10}));assert.equal(f.renderer.records.length,initial);assert.equal(f.capture.state.cubeCaptureEV,21);
  }finally{f.capture.dispose();}
});
check('six scheduled faces freeze UTC/weather/EV/shader sampling while live values evolve',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.atmosphere.live.recommendedEV=20;f.atmosphere.live.maxRGB=.01;
    for(let i=1;i<=6;i++){
      f.atmosphere.live.weather=.3+i*.04;f.tick(i*.1,{storageEV:-i});if(i===1)f.atmosphere.mesh.material.defines.CLOUD_STEPS=128;
      if(i<6)assert.equal(f.published.length,1);
    }
    assert.equal(f.published.length,2);const faces=f.capture.cubeTarget.fixtureFaces;
    assert(faces.every(r=>r.time===.1&&r.weather===.3+.04&&r.captureEV===20&&r.steps===64),JSON.stringify(faces));
    assert(f.atmosphere.prepared.slice(6).every(r=>r.utcMs===1700000000100&&r.frame.utcMs===r.utcMs));
    assert.equal(f.atmosphere.live.time,6*.1);assert.equal(f.atmosphere.live.weather,.3+6*.04);assert.equal(f.atmosphere.uniforms.uSkyPreExposure.value,1);
  }finally{f.capture.dispose();}
});
check('cube publish never exposes partially rendered back target',()=>{
  const f=fixture();try{f.capture.initialize(f.args());const front=f.capture.cubeTarget;f.tick(.1);f.tick(.2);assert.equal(f.capture.cubeTarget,front);assert.equal(f.capture.state.job.face,2);assert.equal(f.capture.state.revision,1);}finally{f.capture.dispose();}
});
check('cube and slower PMREM carry independent exposure ratios',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.atmosphere.live.recommendedEV=20;f.atmosphere.live.maxRGB=.01;for(let i=1;i<=6;i++)f.tick(i*.1);
    assert.equal(f.capture.state.cubeCaptureEV,20);assert.equal(f.capture.state.environmentCaptureEV,21);assert.equal(f.capture.state.pmremRevision,1);
    assert.deepEqual(f.capture.setSceneExposure(0),{cubeRatio:2**-20,environmentRatio:2**-21});
  }finally{f.capture.dispose();}
});
check('discrete explicit refresh forces both paths to same new snapshot',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.setWall(.2);Object.assign(f.atmosphere.live,{recommendedEV:0,maxRGB:32000,physicalRevision:1,time:.2});
    const p=f.capture.refresh(f.args());assert.equal(p.cubeCaptureEV,-1);assert.equal(p.environmentCaptureEV,-1);assert.equal(p.pmremUpdated,true);assert.equal(f.pmrem.calls.length,2);
  }finally{f.capture.dispose();}
});
check('scheduled physical revision refresh is budgeted, works while paused',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.atmosphere.live.physicalRevision=1;f.tick(.1,{paused:true});assert.equal(f.published.length,1);assert.equal(f.capture.state.pendingReason,'physical revision');
    f.tick(.5,{paused:true});assert.equal(f.published.length,2);assert.equal(f.capture.state.fullRefreshes,2);assert.equal(f.capture.state.totalFaces,12);
  }finally{f.capture.dispose();}
});
check('continuous accelerated UTC does not cancel an in-flight capture each tick',()=>{
  const f=fixture();try{f.capture.initialize(f.args());for(let i=1;i<=6;i++){
    f.setWall(i*.1);f.atmosphere.live.time=i*.1;f.atmosphere.live.utcMs=1700000000000+i*60000;
    f.atmosphere.uniforms.sunPosition.value.set(Math.sin(i*.03),Math.cos(i*.03),0);f.capture.update(f.args());
  }
  assert.equal(f.capture.state.cancelledJobs,0);assert.equal(f.published.length,2);assert.equal(f.capture.state.totalFaces,12);
  f.tick(.7);assert.equal(f.capture.state.pendingReason,'sun-angle threshold');
  }finally{f.capture.dispose();}
});
check('missed/slow frames do not catch up many scheduled faces in one call',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.tick(10);assert.equal(f.renderer.records.length,7);}finally{f.capture.dispose();}
});
check('scheduled face rate bounded across 600 ordinary calls',()=>{
  const f=fixture();try{f.capture.initialize(f.args());for(let i=1;i<=600;i++){const before=f.renderer.records.length;f.tick(i/60);assert(f.renderer.records.length-before<=1);}
    assert(f.capture.state.totalFaces-6<=120);assert(f.capture.state.totalFaces-6>=119);
  }finally{f.capture.dispose();}
});
check('global pause does not complete stale in-flight job on wall-clock deadline',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.tick(.1);const front=f.capture.cubeTarget;f.setWall(4);f.capture.update(f.args({paused:true}));
    assert.equal(f.renderer.records.length,7);assert.equal(f.capture.cubeTarget,front);assert.equal(f.capture.state.pendingReason,null);
  }finally{f.capture.dispose();}
});
check('slow in-flight job deadline performs complete current refresh',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.tick(.1);const p=f.tick(4);assert.equal(p.reason,'capture deadline');assert.equal(p.pmremUpdated,true);assert.equal(f.capture.state.job,null);}finally{f.capture.dispose();}
});
check('large explicit UTC jump queues bounded whole refresh',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.setWall(.6);f.atmosphere.live.utcMs+=3600000;const p=f.capture.update(f.args());assert.equal(p.reason,'UTC discontinuity');assert.equal(p.pmremUpdated,true);}finally{f.capture.dispose();}
});
check('PMREM targets reused rather than allocated every publication',()=>{
  const f=fixture({pmremInterval:0});try{f.capture.initialize(f.args());for(let i=1;i<=18;i++)f.tick(i*.1);assert.equal(f.pmrem.calls.length,4);assert.equal(new Set(f.pmrem.calls.map(c=>c.target)).size,2);assert.equal(new Set(f.pmrem.calls.map(c=>c.source)).size,2);}finally{f.capture.dispose();}
});
check('render exception restores renderer/sky and keeps old public front',()=>{
  const f=fixture();try{f.capture.initialize(f.args());const front=f.capture.cubeTarget,before=f.renderer.snapshot(),solar=f.atmosphere.uniforms.uSolarDisk.value;
    f.renderer.failRender=true;assert.throws(()=>f.capture.refresh(f.args()),/fixture render failure/);assert.equal(f.capture.cubeTarget,front);assert.deepEqual(f.renderer.snapshot(),before);assert.equal(f.atmosphere.uniforms.uSolarDisk.value,solar);assert.equal(f.capture.state.job,null);
  }finally{f.capture.dispose();}
});
check('prepareStarView exception restores sky and does not publish half job',()=>{
  const f=fixture();try{f.capture.initialize(f.args());const before=f.renderer.snapshot();f.atmosphere.failPrepare=true;assert.throws(()=>f.capture.refresh(f.args()),/prepare failure/);assert.equal(f.published.length,1);assert.deepEqual(f.renderer.snapshot(),before);assert.equal(f.atmosphere.uniforms.uSolarDisk.value,1);}finally{f.capture.dispose();}
});
check('PMREM failure cannot publish new cube with failed environment',()=>{
  const f=fixture();try{f.capture.initialize(f.args());const front=f.capture.cubeTarget,env=f.capture.environmentTexture,before=f.renderer.snapshot();f.pmrem.fail=true;
    assert.throws(()=>f.capture.refresh(f.args()),/PMREM failure/);assert.equal(f.capture.cubeTarget,front);assert.equal(f.capture.environmentTexture,env);assert.equal(f.capture.state.revision,1);assert.deepEqual(f.renderer.snapshot(),before);
  }finally{f.capture.dispose();}
});
check('observer position frozen per round; moving camera does not move captured faces',()=>{
  const f=fixture();try{f.capture.initialize(f.args({position:[10,30,20]}));assert(f.renderer.records.every(r=>r.position.every((v,i)=>Math.abs(v-[10,30,20][i])<1e-12)));}finally{f.capture.dispose();}
});
check('age diagnostics distinguish physical phase and astronomical UTC age',()=>{
  const f=fixture();try{f.capture.initialize(f.args());f.setWall(.01);f.atmosphere.live.time=1;f.atmosphere.live.utcMs+=60000;f.capture.update(f.args({paused:true}));assert.equal(f.capture.state.cube.captureAge,1);assert.equal(f.capture.state.cube.utcSecondsAge,60);}finally{f.capture.dispose();}
});
check('dispose idempotent, does not dispose shared source material/geometry or supplied PMREM',()=>{
  const f=fixture();let sourceDisposed=0;f.atmosphere.mesh.material.addEventListener('dispose',()=>sourceDisposed++);f.atmosphere.mesh.geometry.addEventListener('dispose',()=>sourceDisposed++);
  f.capture.dispose();f.capture.dispose();assert.equal(sourceDisposed,0);assert.equal(f.pmrem.disposed,false);assert.throws(()=>f.capture.update(f.args()),/disposed/);
});

const report={date:new Date().toISOString(),scope:'Actual module scheduling/snapshot/state restoration with real Three scene/target classes and injected non-GPU renderer/PMREM. No GPU pixel, shader, driver mip or performance claim.',passed:checks.every(c=>c.passed),count:checks.length,checks};
writeFileSync(new URL('environment-capture-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
