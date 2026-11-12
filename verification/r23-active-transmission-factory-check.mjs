// Actual GPU factory with real Three objects and a non-GPU renderer/GL fixture.
// Synthetic tau tags prove row/tile addressing, not physical GPU arithmetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createSmokeTransmissionGPU} from '../pyro-smoke-transmission-gpu.js';
import {planSmokeTransmissionLayout} from '../smoke-transmission-layout.js';
import {planSmokeTransmission,smokeTransmissionWorldSources} from '../pyro-smoke-transmission-pack.js';
const source=fs.readFileSync(new URL('../pyro-smoke-transmission-gpu.js',import.meta.url),'utf8'),baseline=fs.readFileSync(new URL('./baselines/r23-before-active-transmission-layout/pyro-smoke-transmission-gpu.js',import.meta.url),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(baseline),'2a35974fac7f6d75d6fa128fa04e869160d0ca40c9671569fe356bfef03ee294');
const oldCode=baseline.replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL('../'+p,import.meta.url).href)),oldFactory=(await import('data:text/javascript;base64,'+Buffer.from(oldCode).toString('base64'))).createSmokeTransmissionGPU;
const caps={maxSources:18000,maxPackets:4096,maxPairs:1048576},checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}};
class Renderer {
  constructor(maximumTexture=16384){
    this.target=null;this.face=0;this.mip=0;this.viewport=new THREE.Vector4(3,4,19,11);this.scissor=new THREE.Vector4(1,2,8,6);this.scissorTest=true;this.actualViewport=this.viewport.clone();this.actualScissor=this.scissor.clone();this.actualTest=true;this.read={read:'separate'};this.draw={draw:'separate'};this.readBuffer=100;this.drawBuffers=[100,101,0,0];this.autoClear=true;this.xr={enabled:true};this.shadowMap={autoUpdate:true,needsUpdate:true};this.calls=[];this.partial=new WeakMap();this.outputs=new WeakMap();this.properties={get:material=>({currentProgram:{program:{material}}})};this.contextLost=false;this.fault={};this.validation={fbo:[],link:[]};this.lastMaterialName='';
    const gl=this.gl={MAX_VERTEX_TEXTURE_IMAGE_UNITS:1,MAX_TEXTURE_SIZE:2,MAX_DRAW_BUFFERS:3,SCISSOR_BOX:4,SCISSOR_TEST:5,READ_FRAMEBUFFER_BINDING:6,DRAW_FRAMEBUFFER_BINDING:7,READ_BUFFER:8,DRAW_BUFFER0:20,DRAW_FRAMEBUFFER:30,READ_FRAMEBUFFER:31,NONE:0,FRAMEBUFFER_COMPLETE:40,LINK_STATUS:41};
    Object.assign(gl,{getExtension:()=>({}),isContextLost:()=>this.contextLost,getParameter:k=>k===1?16:k===2?maximumTexture:k===3?4:k===4?this.actualScissor.toArray():k===6?this.read:k===7?this.draw:k===8?this.readBuffer:k>=20&&k<24?this.drawBuffers[k-20]:null,isEnabled:k=>k===5&&this.actualTest,bindFramebuffer:(t,f)=>{if(t===30)this.draw=f;else if(t===31)this.read=f;},drawBuffers:a=>{this.drawBuffers=Array.from(a);while(this.drawBuffers.length<4)this.drawBuffers.push(0);},readBuffer:x=>this.readBuffer=x,checkFramebufferStatus:()=>{const phase=this.lastMaterialName.includes('/64packet')?'partial':'output';this.validation.fbo.push(phase);return this.fault[phase+'FBO']?0:40;},getProgramParameter:p=>{const phase=p.material.name.includes('/64packet')?'partial':'output';this.validation.link.push(phase);return !this.fault[phase+'Link'];}});
    this.state={bindFramebuffer:(t,f)=>gl.bindFramebuffer(t,f),viewport:v=>this.actualViewport.copy(v),scissor:v=>this.actualScissor.copy(v),setScissorTest:v=>this.actualTest=v};
  }
  getContext(){return this.gl;}getRenderTarget(){return this.target;}getActiveCubeFace(){return this.face;}getActiveMipmapLevel(){return this.mip;}
  getViewport(v){return v.copy(this.viewport);}getScissor(v){return v.copy(this.scissor);}getScissorTest(){return this.scissorTest;}getCurrentViewport(v){return v.copy(this.actualViewport);}
  setViewport(v){this.viewport.copy(v);this.actualViewport.copy(v);}setScissor(v){this.scissor.copy(v);this.actualScissor.copy(v);}setScissorTest(v){this.scissorTest=v;this.actualTest=v;}
  setRenderTarget(t,face=0,mip=0){this.target=t;this.face=face;this.mip=mip;if(t){this.actualViewport.copy(t.viewport);this.actualScissor.copy(t.scissor);this.actualTest=t.scissorTest;}this.read=t;this.draw=t;this.readBuffer=t?100:1029;this.drawBuffers=[t?100:1029,0,0,0];}
  snapshot(){return{target:this.target,face:this.face,mip:this.mip,viewport:this.viewport.toArray(),scissor:this.scissor.toArray(),test:this.scissorTest,actualViewport:this.actualViewport.toArray(),actualScissor:this.actualScissor.toArray(),actualTest:this.actualTest,read:this.read,draw:this.draw,readBuffer:this.readBuffer,drawBuffers:[...this.drawBuffers],autoClear:this.autoClear,xr:this.xr.enabled,shadow:{...this.shadowMap}};}
  render(scene){
    const m=scene.children[0].material,u=Object.fromEntries(Object.entries(m.uniforms).map(([k,v])=>[k,v.value])),target=this.target,rect=target.viewport.toArray(),stride=u.uSourceStride??caps.maxSources;this.lastMaterialName=m.name;
    assert.equal(rect[0],0);assert.equal(rect[1],0);assert(rect[2]<=target.width&&rect[3]<=target.height);assert.equal(this.actualTest,false);
    const call={name:m.name,target:[target.width,target.height],rect,uniforms:Object.fromEntries(Object.entries(u).filter(([,v])=>typeof v==='number')),fragment:m.fragmentShader,paddingWrites:0,validWrites:0,reads:0};this.calls.push(call);
    if(m.name.includes('/64packet')){
      const writes=new Map(),src=u.uSources.image.data;
      for(let y=0;y<rect[3];y++)for(let x=0;x<rect[2];x++){
        const index=x+y*u.uPartialWidth,s=index%stride,tile=Math.floor(index/stride);let tau=0;
        if(s<u.uSourceCount&&tile*64<u.uPacketCount){call.validWrites++;if(src[s*12+7]>.5&&src[s*12+3]>0){const from=tile*64,n=Math.min(64,u.uPacketCount-from);tau=n*(s+1)*1e-6+(n*from+n*(n+1)/2)*1e-8;}}else call.paddingWrites++;
        writes.set(index,tau);
      }
      this.partial.set(target.texture,writes);
    }else{
      const writes=this.partial.get(u.uPartial),out=this.outputs.get(target.texture)??new Float64Array(target.width*target.height*4).fill(NaN);this.outputs.set(target.texture,out);
      for(let y=0;y<rect[3];y++)for(let x=0;x<rect[2];x++){
        const s=x+y*u.uOutputWidth;let tau=0;
        if(s<u.uSourceCount){call.validWrites++;for(let tile=0;tile<u.uTileCount;tile++){const index=tile*stride+s;assert(writes?.has(index),'Reduction fetched an unwritten/stale partial texel');tau+=writes.get(index);call.reads++;}}else call.paddingWrites++;
        out.set([Math.exp(-Math.max(0,tau)),Math.exp(-Math.max(0,tau*2)),Math.exp(-Math.max(0,tau*3)),1],s*4);
      }
    }
  }
}
function input(count,packets,version=1,{inactive=false}={}){
  const snapshot={revision:version,profiles:[{id:'r',extinctionPerMassRGB:[.7,1,.4]}],packets:Array.from({length:packets},(_,i)=>({id:i,profileId:'r',mass:.01,mean:[(i%7)*.01,1,-3-i*.001],covariance:[1,.1,0,.1,1,0,0,0,1]}))};
  const sources=smokeTransmissionWorldSources(Array.from({length:count},(_,i)=>({position:[(i%23)*.01,2,-10]})),{eye:[0,1,2]});if(inactive&&count){sources.active[0]=0;if(count>1)sources.endpoints64.set([0,1,2],3);}return{snapshot,...sources,sourceVersion:version};
}
function run(field,renderer,value){const before=renderer.snapshot(),begin=renderer.calls.length,result=field.prepare(value);assert.deepEqual(renderer.snapshot(),before);return{result,calls:renderer.calls.slice(begin),pixels:result.texture?renderer.outputs.get(result.texture):null,diagnostics:field.diagnostics()};}
check('Baseline frozen and finite-column arithmetic, packing and context preservation text remain exact',()=>{
  const kernel=s=>s.slice(s.indexOf('      float stableErfDifference'),s.indexOf('      void main(){int index='));assert.equal(kernel(source),kernel(baseline));assert.equal(source.slice(source.indexOf('  function preserve('),source.indexOf('  const api={')),baseline.slice(baseline.indexOf('  function preserve('),baseline.indexOf('  const api={')));assert.match(source,/source=index%uSourceStride,tile=index\/uSourceStride/);assert.match(source,/int index=tile\*uSourceStride\+source/);assert.match(source,/source<uSourceCount&&tile<uTileCount/);return{baselineSHA256:sha(baseline),scope:'Unchanged finite-column arithmetic and renderer-state preservation; no GPU compilation implied'};
});
check('Actual active factory maps every supported ordered source/tile and neutralizes drawn output padding at boundary counts',()=>{
  const r=new Renderer(),field=createSmokeTransmissionGPU(THREE,r,{...caps,layoutMode:'active-count'}),rows=[];let version=1,totalReads=0;
  try{for(const count of [0,1,63,64,65,255,256,257,18000])for(const packets of [...new Set([0,1,63,64,65,Math.min(caps.maxPackets,count?Math.floor(caps.maxPairs/count):caps.maxPackets)])]){
    if(!planSmokeTransmission(count,packets,caps).supported)continue;
    const value=input(count,packets,version++),p=planSmokeTransmissionLayout(count,packets,{...caps,layoutMode:'active-count'}),out=run(field,r,value);assert(out.result.effective);assert.equal(out.result.count,count);assert.equal(out.result.sourceVersion,value.sourceVersion);assert.equal(out.result.densityRevision,value.snapshot.revision);assert.equal(out.result.width,p.allocation.output.width);assert.equal(out.result.height,p.allocation.output.height);assert.equal(out.calls.length,p.mapRequired?2:1);
    if(p.mapRequired){assert.deepEqual(out.calls[0].rect,[0,0,p.mapDraw.width,p.mapDraw.height]);assert.equal(out.calls[0].uniforms.uSourceStride,Math.max(1,count));assert.equal(out.calls[0].validWrites,count*Math.ceil(packets/64));assert.equal(out.calls[0].validWrites+out.calls[0].paddingWrites,p.mapDraw.rasterTexels);assert.equal(out.calls[1].reads,count*Math.ceil(packets/64));totalReads+=out.calls[1].reads;}
    else{assert.equal(out.calls[0].uniforms.uTileCount,0);assert.equal(out.calls[0].reads,0);assert(out.pixels.every(v=>v===1));}
    const reduce=out.calls.at(-1);assert.deepEqual(reduce.rect,[0,0,p.outputDraw.width,p.outputDraw.height]);assert.equal(reduce.validWrites+reduce.paddingWrites,p.outputDraw.rasterTexels);
    for(let i=count;i<p.outputDraw.rasterTexels;i++)assert.deepEqual(Array.from(out.pixels.slice(i*4,i*4+4)),[1,1,1,1]);
    for(const i of new Set([0,Math.max(0,count-1),Math.floor(count/2)])){if(i>=count)continue;let tau=0;for(let tile=0;tile<Math.ceil(packets/64);tile++){const from=tile*64,n=Math.min(64,packets-from);tau+=n*(i+1)*1e-6+(n*from+n*(n+1)/2)*1e-8;}assert.equal(out.pixels[i*4],Math.exp(-tau));assert.equal(out.pixels[i*4+3],1);}
    rows.push({count,packets,mapRaster:p.mapDraw.rasterTexels,outputRaster:p.outputDraw.rasterTexels,draws:out.calls.length});
  }}finally{field.dispose();}return{cases:rows.length,totalReductionReads:totalReads,rows,scope:'Real factory captured uniforms/rectangles with synthetic tau addressing; output padding outside the drawn rectangle is not a valid read'};
});
check('Active and legacy layouts retain all ordered input bytes and same synthetic outputs including inactive and zero-length rows',()=>{
  const ar=new Renderer(),br=new Renderer(),a=createSmokeTransmissionGPU(THREE,ar,{...caps,layoutMode:'active-count'}),b=oldFactory(THREE,br,caps);let comparisons=0;
  try{for(const [count,packets]of [[1,65],[63,65],[64,64],[65,65],[257,65],[1740,515],[18000,58]]){const value=input(count,packets,42,{inactive:true}),A=run(a,ar,value),B=run(b,br,value);assert(A.result.effective&&B.result.effective);assert.deepEqual(a.packed.packetData,b.packed.packetData);assert.deepEqual(a.packed.sourceData,b.packed.sourceData);assert.deepEqual(Array.from(A.pixels.slice(0,count*4)),Array.from(B.pixels.slice(0,count*4)));assert.deepEqual(Array.from(A.pixels.slice(0,Math.min(count,2)*4)),new Array(Math.min(count,2)*4).fill(1));comparisons+=count;}}finally{a.dispose();b.dispose();}return{orderedRowsCompared:comparisons,scope:'No source compaction/reordering or ray-metadata change; inactive rows keep their original indices'};
});
check('Neutral generations are freshly drawn after nonempty work; rejection retires texture without draw or partial publication',()=>{
  const r=new Renderer(),f=createSmokeTransmissionGPU(THREE,r,{...caps,layoutMode:'active-count'});try{run(f,r,input(65,65,1));for(const [count,packets]of [[0,65],[65,0],[0,0]]){const out=run(f,r,input(count,packets,2+count+packets));assert(out.result.effective);assert.equal(out.calls.length,1);assert(out.pixels.every(v=>v===1));}for(const [count,packets,reason]of [[18001,0,'source-capacity'],[0,4097,'packet-capacity'],[18000,59,'pair-work-capacity'],[257,4081,'pair-work-capacity']]){const before=r.calls.length,out=f.prepare(input(count,packets,99));assert.equal(out.effective,false);assert.equal(out.reason,reason);assert.equal(f.texture,null);assert.equal(f.target,null);assert.equal(r.calls.length,before);}}finally{f.dispose();}
});
check('Allocation bytes and fixed texture eligibility match the compact capacity proof without expanding constructor caps',()=>{
  const r=new Renderer(),f=createSmokeTransmissionGPU(THREE,r,{...caps,layoutMode:'active-count'});try{const out=run(f,r,input(256,4096));assert.equal(out.result.pairs,1048576);const p=f.diagnostics().allocationPlan;assert.equal(p.partialCapacityTexels,34384);assert.deepEqual([p.allocation.partial.width,p.allocation.partial.height],[256,135]);assert.equal(f.diagnostics().bytes.partialTarget,256*135*16);assert.equal(f.diagnostics().caps.maxPairs,1048576);assert.equal(f.diagnostics().caps.maxSources,18000);assert.equal(f.diagnostics().caps.maxPackets,4096);}finally{f.dispose();}
  const small=new Renderer(128),g=createSmokeTransmissionGPU(THREE,small,{...caps,layoutMode:'active-count'});try{const out=g.prepare(input(1,1));assert.equal(out.effective,false);assert.equal(out.reason,'texture-size-capacity');assert.equal(g.diagnostics().allocated,false);assert.equal(small.calls.length,0);}finally{g.dispose();}return{partialTexture:[256,135],oldPartialTexture:[256,4500],partialBytes:552960,oldPartialBytes:18432000,domain:'Fixed constructor textures still must fit actual MAX_TEXTURE_SIZE, independent of current count'};
});
check('Captured native mid workload has a reduced raster bound but unchanged admitted pair work and unsupported cutoff',()=>{
  const legacy=planSmokeTransmissionLayout(1740,515,{...caps,layoutMode:'legacy-max'}),active=planSmokeTransmissionLayout(1740,515,{...caps,layoutMode:'active-count'}),cutoff=planSmokeTransmissionLayout(1734,755,{...caps,layoutMode:'active-count'});assert.equal(active.pairs,legacy.pairs);assert.equal(active.pairs,896100);assert.equal(cutoff.supported,false);assert.equal(cutoff.reason,'pair-work-capacity');assert(active.mapDraw.rasterTexels<legacy.mapDraw.rasterTexels);assert(active.outputDraw.rasterTexels<legacy.outputDraw.rasterTexels);return{mid:{pairs:active.pairs,legacyMap:legacy.mapDraw.rasterTexels,activeMap:active.mapDraw.rasterTexels,legacyOutput:legacy.outputDraw.rasterTexels,activeOutput:active.outputDraw.rasterTexels},cutoff:{pairs:cutoff.pairs,reason:cutoff.reason},scope:'Saved native workload dimensions provide a deterministic work bound, not measured GPU speedup or60fps admission'};
});
check('Neutral-first target validation is independent; injected first-map/output FBO/link faults retire publication and are rechecked on retry',()=>{
  const count=(r,kind,phase)=>r.validation[kind].filter(x=>x===phase).length,summary=[];
  const neutralRenderer=new Renderer(),neutral=createSmokeTransmissionGPU(THREE,neutralRenderer,{...caps,layoutMode:'active-count'});
  try{run(neutral,neutralRenderer,input(0,65,1));assert.deepEqual(neutralRenderer.validation,{fbo:['output'],link:['output']});run(neutral,neutralRenderer,input(65,65,2));assert.deepEqual(neutralRenderer.validation,{fbo:['output','partial'],link:['output','partial']});}finally{neutral.dispose();}
  for(const [phase,kind]of [['partial','FBO'],['partial','Link'],['output','FBO'],['output','Link']]){
    const r=new Renderer(),f=createSmokeTransmissionGPU(THREE,r,{...caps,layoutMode:'active-count'});try{
      if(phase==='partial')run(f,r,input(0,65,1));
      const before=r.snapshot();r.fault[phase+kind]=true;assert.throws(()=>f.prepare(input(65,65,2)),kind==='FBO'?/framebuffer incomplete/:/program failed to link/);assert.deepEqual(r.snapshot(),before);assert.equal(f.texture,null);assert.equal(f.target,null);assert.equal(f.diagnostics().effective,false);assert.equal(f.diagnostics().reason,'render-failed');assert.equal(count(r,'fbo',phase),1);if(kind==='Link')assert.equal(count(r,'link',phase),1);
      r.fault[phase+kind]=false;const out=run(f,r,input(65,65,3));assert(out.result.effective);assert.equal(out.result.sourceVersion,3);assert.equal(count(r,'fbo',phase),2);assert.equal(count(r,'link',phase),kind==='FBO'?1:2);
      const validation={fbo:[...r.validation.fbo],link:[...r.validation.link]};run(f,r,input(65,65,4));assert.deepEqual(r.validation,validation);summary.push({phase,kind,validation,retryEffective:true});
    }finally{f.dispose();}
  }return{neutralFirstChecks:'output first; partial separately on first nonempty map',faults:summary,scope:'Fake GL branch/control/publication verification; no real FBO/link or GPU acceptance'};
});
const report={schema:'glass-atoll.r23-active-transmission-factory-cpu.v1',dateUTC:new Date().toISOString(),actualGPU:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,sourceSHA256:sha(source),baselineSHA256:sha(baseline),limits:['Actual real-Three factory with fake GL/renderer and synthetic tau tags; no GPU/FBO compilation or numerical optics acceptance.','Ordered input packing, map/reduce addressing and output write extents are checked; full native runtime and optical readback remain root-owned.','No pair-cap raise, chunking, source reduction, density approximation or frame-rate claim.']};fs.writeFileSync(new URL('./r23-active-transmission-factory-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),sourceSHA256:report.sourceSHA256},null,2));if(!report.passed)process.exitCode=1;
