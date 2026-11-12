// CPU-only source and actual instrumentation-block execution. No WebGL context.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createPyroSmokeRenderer} from '../pyro-smoke-renderer.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),source=read('./r25-smoke-prefix-gpu-check.js'),vendor=read('../vendor/three.module.js').replaceAll('\r\n','\n'),main=read('../main.js'),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}};
function extract(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0);let depth=0;for(let i=source.indexOf('{',start);i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}throw Error('Missing function end');}
const attrs={aRect:4,aMean:3,aChol0:4,aChol1:2,aOptics:4,aLightIndex:1};
const vendorStart=vendor.indexOf('function WebGLAttributes( gl )'),vendorEnd=vendor.indexOf('\n}\n',vendorStart)+2,createAttributes=new Function('return ('+vendor.slice(vendorStart,vendorEnd)+');')();
const renderObject=vendor.slice(vendor.indexOf('function renderObject( object, scene, camera, geometry, material, group )'));
const faceCondition=renderObject.match(/if \( (material\.transparent === true && material\.side === DoubleSide && material\.forceSinglePass === false) \)/)?.[1];assert.ok(faceCondition);
const requiresTwoFaces=new Function('material','DoubleSide','return ('+faceCondition+');');
const instrumentation=source.slice(source.indexOf("for(const key of ['drawElementsInstanced'"),source.indexOf('normalizeUnpack();const makeTarget='));
const cleanup=source.slice(source.indexOf('for(let i=patches.length-1;i>=0;i--)'),source.indexOf("try{volume?.dispose()"));
function model({fault=null,brokenPatch=false}={}){
  let next=0,binding=null,nativeDraws=0,pendingError=false;const bytes=new Map(),program={},patches=[],handles=new Map(),trackedArrays=new WeakMap(),ownedAttributes=new Map();
  const gl=Object.create({
    createBuffer(){const b={id:++next};bytes.set(b,new Uint8Array());return b;},deleteBuffer(b){bytes.delete(b);},bindBuffer(_target,b){binding=b;},getParameter(key){if(key===this.ARRAY_BUFFER_BINDING)return binding;if(key===this.CURRENT_PROGRAM)return program;return null;},
    bufferData(_target,data){bytes.set(binding,typeof data==='number'?new Uint8Array(data):new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice());},
    bufferSubData(_target,offset,array,start=0,count=array.length-start){bytes.get(binding).set(new Uint8Array(array.buffer,array.byteOffset+start*array.BYTES_PER_ELEMENT,count*array.BYTES_PER_ELEMENT),offset);},
    drawElementsInstanced(){nativeDraws++;if(fault==='first-draw')pendingError=true;},drawArraysInstanced(){nativeDraws++;},drawElements(){nativeDraws++;},drawArrays(){nativeDraws++;},checkFramebufferStatus(){return this.FRAMEBUFFER_COMPLETE;},getProgramParameter(){return true;}
  });Object.assign(gl,{ARRAY_BUFFER:1,ARRAY_BUFFER_BINDING:2,CURRENT_PROGRAM:3,DRAW_FRAMEBUFFER:4,FRAMEBUFFER_COMPLETE:5,LINK_STATUS:6,FLOAT:7,UNSIGNED_SHORT:8});
  if(brokenPatch)Object.defineProperty(gl,'drawArraysInstanced',{configurable:false,writable:true,value:gl.drawArraysInstanced});
  const manager=createAttributes(gl),geometry=new THREE.InstancedBufferGeometry();for(const[name,size]of Object.entries(attrs))geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(8*size),size));geometry.instanceCount=3;
  // Instantiate the real ShaderMaterial subclass and clone as production does;
  // Material's base default is overridden by ShaderMaterial.forceSinglePass=true.
  const material=new THREE.RawShaderMaterial({transparent:true,side:THREE.DoubleSide}).clone();
  const scene={children:[{isMesh:true,geometry,material}]};
  const renderer={render(s){const mesh=s.children[0];for(const a of Object.values(mesh.geometry.attributes))manager.update(a,gl.ARRAY_BUFFER);const passes=requiresTwoFaces(mesh.material,THREE.DoubleSide)?2:1;for(let pass=0;pass<passes;pass++)gl.drawElementsInstanced(0,6,gl.UNSIGNED_SHORT,0,geometry.instanceCount);}};
  const objects=[...['drawElementsInstanced','drawArraysInstanced','drawElements','drawArrays','bufferData','bufferSubData'].map(key=>[gl,key]),[renderer,'render']],before=objects.map(([object,key])=>({object,key,descriptor:Object.getOwnPropertyDescriptor(object,key),value:object[key]}));
  const context={THREE,Float32Array,Uint32Array,Map,WeakMap,structuredClone,gl,renderer,ATTRIBUTES:attrs,patches,handles,trackedArrays,ownedAttributes,report:{actualDraws:0,smokeRenders:0,actualGPU:false,shaderErrors:[]},current:null,stop:false,ensureContext(){},demand(c,m){if(!c)throw Error(m);},errors(){if(pendingError){context.stop=true;pendingError=false;}},check(name,passed){assert.ok(passed,name);},descriptorEqual:(a,b)=>a===undefined?b===undefined:!!b&&['configurable','enumerable','writable','value','get','set'].every(k=>a[k]===b[k]),message:e=>String(e)};
  vm.createContext(context);vm.runInContext(extract('patch')+';'+instrumentation,context);
  function render(ordinal,instances){
    geometry.instanceCount=instances;for(const[name,size]of Object.entries(attrs)){const a=geometry.getAttribute(name);for(let i=0;i<instances*size;i++)a.array[i]=ordinal*100+i;a.clearUpdateRanges();a.addUpdateRange(0,instances*size);a.needsUpdate=true;}
    context.current={ordinal,actualDraws:0,uploads:[],expected:new Map(),instances:null};let error=null;try{renderer.render(scene,{});}catch(e){error=e;}
    return {row:context.current,error};
  }
  function unwind(){vm.runInContext(cleanup,context);for(const p of before){assert.deepEqual(Object.getOwnPropertyDescriptor(p.object,p.key),p.descriptor);assert.equal(p.object[p.key],p.value);}}
  return {gl,renderer,manager,geometry,material,bytes,handles,context,before,render,unwind,get nativeDraws(){return nativeDraws;}};
}

check('Exact source/factory and bounded parent entry pins match current candidate',()=>{
  const p=read('../pyro-smoke-renderer.js');assert.ok(source.includes(sha(p)));assert.ok(source.includes(sha(createPyroSmokeRenderer.toString())));assert.match(source,/maxActualDraws:2,maxSmokeRenders:2,maxReadbackBytesPerRender:4096/);assert.match(source,/maxPackets:8/);assert.match(source,/row\.actualDraws===1/);assert.match(source,/expectedIndices\)\{/);assert.ok(main.includes('parentLocked:true,createVolume:createPyroSmokeRenderer'));assert.ok(source.includes("SMOKE_PREFIX_GPU_CHECK_REVISION='r25-shader-single-pass-v2'"));return {candidateSHA256:sha(p),factorySHA256:sha(createPyroSmokeRenderer.toString()),countTransitions:[3,2],actualDrawCap:2,helperRevision:'r25-shader-single-pass-v2'};
});
check('Actual vendor ShaderMaterial override and clone select one face; explicit opt-out selects two',()=>{
  const base=new THREE.Material(),shader=new THREE.ShaderMaterial(),raw=new THREE.RawShaderMaterial({transparent:true,side:THREE.DoubleSide}),clone=raw.clone();assert.equal(base.forceSinglePass,false);assert.equal(shader.forceSinglePass,true);assert.equal(raw.forceSinglePass,true);assert.equal(clone.forceSinglePass,true);assert.equal(requiresTwoFaces(clone,THREE.DoubleSide),false);clone.forceSinglePass=false;assert.equal(requiresTwoFaces(clone,THREE.DoubleSide),true);return {baseDefault:false,shaderDefault:true,rawDefault:true,cloneRetainsTrue:true,usesExactVendoredCondition:faceCondition,oldHardcodedTwoDrawModelInvalidated:true};
});
check('Actual helper instrumentation plus vendored attribute uploader models full first allocation then exact prefix',()=>{
  const m=model(),first=m.render(1,3);assert.equal(first.error,null);assert.equal(first.row.actualDraws,1);assert.equal(first.row.uploads.length,6);const firstGPU=new Map();
  for(const[name,size]of Object.entries(attrs)){const calls=first.row.uploads.filter(x=>x.attribute===name);assert.equal(calls.length,1);assert.equal(calls[0].kind,'bufferData');assert.equal(calls[0].components,8*size);firstGPU.set(name,m.bytes.get(m.handles.get(name)).slice());}
  const second=m.render(2,2);assert.equal(second.error,null);assert.equal(second.row.actualDraws,1);assert.equal(second.row.uploads.length,6);
  for(const[name,size]of Object.entries(attrs)){const calls=second.row.uploads.filter(x=>x.attribute===name);assert.equal(calls.length,1);assert.deepEqual([calls[0].kind,calls[0].offsetBytes,calls[0].sourceOffset,calls[0].components],['bufferSubData',0,0,2*size]);const data=m.bytes.get(m.handles.get(name)),expected=new Uint8Array(m.geometry.getAttribute(name).array.buffer);assert.deepEqual(data.slice(0,2*size*4),expected.slice(0,2*size*4));assert.deepEqual(data.slice(2*size*4),firstGPU.get(name).slice(2*size*4));assert.equal(m.geometry.getAttribute(name).updateRanges.length,0);}
  assert.equal(m.nativeDraws,2);m.unwind();return {modeledUploadCalls:12,modeledDrawCalls:2,attributes:6,fullReadbackBytesPerRender:8*18*4,realContextOrGPU:false};
});
check('First modeled draw fault stops any later renderer and exact inherited descriptors unwind',()=>{
  const m=model({fault:'first-draw'}),result=m.render(1,3);assert.ok(result.error);assert.equal(m.nativeDraws,1);assert.equal(m.context.report.actualDraws,1);assert.equal(m.context.stop,true);assert.ok(m.render(2,2).error);assert.equal(m.nativeDraws,1);m.unwind();return {modeledDrawCallsBeforeStop:1,prototypeMethodsHaveNoOwnPropertyLeftovers:true};
});
check('Draw cap, unexpected primitive and first-fault restrictions execute before extra modeled native draws',()=>{
  const m=model();m.render(1,3);m.render(2,2);assert.throws(()=>m.gl.drawElementsInstanced(0,6,m.gl.UNSIGNED_SHORT,0,2),/draw budget/);assert.equal(m.nativeDraws,2);m.unwind();const a=model();assert.throws(()=>a.gl.drawArrays(0,0,3),/phase/);assert.equal(a.nativeDraws,0);a.unwind();return {extraNativeCalls:0};
});
check('Timer result is retained before rejection and no second renderer is entered before first timer acceptance',()=>{
  const timer=source.indexOf('row.gpuRenderIntervalMs=gpuMs'),receipt=source.indexOf('report.timedIntervals.push(',timer),guard=source.indexOf('demand(ready&&!disjoint&&Number.isFinite(gpuMs)&&gpuMs<=25',timer),countAssert=source.indexOf('demand(row.actualDraws===1');assert.ok(timer>=0&&receipt>timer&&guard>receipt&&countAssert>receipt);assert.ok(source.includes('performance.now()+1500'));assert.ok(source.includes('i<60&&performance.now()<deadline'));assert.ok(source.includes('await new Promise(requestAnimationFrame)'));
  const first=source.indexOf("await renderOne({camera:main"),second=source.indexOf("await renderOne({camera:mirror");assert.ok(first>=0&&second>first);assert.ok(source.includes("gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)"));assert.ok(source.includes('queries.delete(query);query=null'));return {slowThresholdMs:25,maxPolls:60,deadlineMs:1500,timingScope:'one pinned single-pass render; retrospective stop before next render',timingReceiptBeforeCountAssertions:true};
});
check('UNPACK/PBO/COPY_READ guard and controlled VBO readback do not rely on unsupported viewport-cache desync',()=>{
  for(const token of ['PIXEL_UNPACK_BUFFER_BINDING','COPY_READ_BUFFER_BINDING','UNPACK_IMAGE_HEIGHT','UNPACK_SKIP_IMAGES','UNPACK_COLORSPACE_CONVERSION_WEBGL','gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null)','g.bindBuffer(g.COPY_READ_BUFFER,p.copyReadBuffer)','gl.getBufferSubData(gl.COPY_READ_BUFFER,0,array)','trackedArrays.get(array)','handles.get(name)===buffer','firstGPU.get(name),row.instances*size,array.length'])assert.ok(source.includes(token),token);
  assert.ok(source.includes('drawSentinel.viewport.set(1,0,2,1)'));assert.ok(source.includes('Sentinel physical/current viewport/scissor metadata mismatch'));assert.ok(!source.includes('renderer.state.viewport(new THREE.Vector4(1,0,2,1))'));assert.ok(!/new\s+THREE\.WebGLRenderer|OffscreenCanvas|readPixels\(/.test(source));return {sixOwnedAttributeArrays:true,VBOReadbackBytesPerRender:576,guardScope:'supported Three target rectangles plus explicit COPY_READ/PACK/UNPACK/PBO/FBO/renderer state'};
});
const owner=JSON.parse(read('./r25-smoke-prefix-gpu-preflight.json'));check('Owner CPU preflight uses final helper pin; no hardware result is conflated with this model',()=>{assert.ok(owner.passed);assert.deepEqual(owner.counts,{passed:7,total:7});assert.equal(owner.actualGPU,false);assert.equal(owner.helperSHA256,sha(source));return {ownerCPU:'7/7',helperSHA256:sha(source),hardwareDispatches:0,modelReportsAreNotGPUReceipts:true};});
const report={schema:'glass-atoll.r25-smoke-prefix-independent-pre-GPU.v2',passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},actualGPU:false,browserActions:0,productionEdits:0,checks,helperSHA256:sha(source),candidateSHA256:sha(read('../pyro-smoke-renderer.js')),testsSHA256:sha(read('./r25-smoke-prefix-independent-preflight.mjs')),chronology:'First actual GPU render disproved our original hardcoded-two-pass CPU model. The old independent preflight is archived; this revision instantiates the actual RawShaderMaterial clone and evaluates the exact vendored forceSinglePass branch.',limits:['CPU source/guard review and actual instrumentation-block execution with a mocked GL byte store, vendored attribute updater and synthetic draw calls only','No real WebGLRenderer/context, shader/FBO/driver/timer/native descriptor admission follows; root explicit two-render/two-draw repeat remains gated','The helper nominal actualGPU flag inside the CPU model denotes instrumented fake calls only and is not saved as a hardware receipt']};
fs.writeFileSync(new URL('./r25-smoke-prefix-independent-preflight.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed),helperSHA256:report.helperSHA256},null,2));if(!report.passed)process.exitCode=1;
