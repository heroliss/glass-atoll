/**
 * Real extended-range presentation for the existing WebGL2 scene.
 * WebGPU canvas HDR: https://www.w3.org/TR/webgpu/#canvas-configuration
 * https://developer.chrome.com/blog/new-in-webgpu-129
 * No WebGLTexture/GPUTexture sharing or guaranteed zero-copy is claimed.
 * Preferred: RGBA16F WebGL drawing buffer -> external-image WebGPU copy, after
 * an actual >1 retention probe. Fallback: fenced PBO readback + CPU upload.
 */

const errorText=error=>String(error?.message||error);
const mediaMatches=query=>typeof matchMedia==='function'&&matchMedia(query).matches;

export function decodeFloat16(bits){
  const sign=bits&32768?-1:1,exponent=bits>>10&31,fraction=bits&1023;
  return exponent===31?(fraction?NaN:sign*Infinity):sign*(exponent===0?fraction*2**-24:(1+fraction/1024)*2**(exponent-15));
}

async function probeFloatCanvasCopy(device){
  const result={tested:false,method:false,preserved:false};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:false});
  if(!gl){result.reason='没有 WebGL2。';return result;}
  let program=null,texture=null,buffer=null,vertex=null,fragment=null;
  try{
    result.method=typeof gl.drawingBufferStorage==='function';
    result.floatExtension=Boolean(gl.getExtension('EXT_color_buffer_float'));
    if(!result.method||!result.floatExtension){result.reason='浮点 WebGL drawing buffer 接口或扩展不可用。';return result;}
    gl.drawingBufferStorage(gl.RGBA16F,2,2);
    if(gl.getError()!==gl.NO_ERROR)throw new Error('RGBA16F drawingBufferStorage 被拒绝。');
    result.drawingBufferFormat=gl.drawingBufferFormat;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
    vertex=compile(gl.VERTEX_SHADER,'#version 300 es\nconst vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));void main(){gl_Position=vec4(p[gl_VertexID],0,1);}');
    fragment=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 colour;void main(){colour=vec4(2.,.5,.25,1.);}');
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);gl.viewport(0,0,2,2);gl.drawArrays(gl.TRIANGLES,0,3);
    const native=new Float32Array(16);gl.readPixels(0,0,2,2,gl.RGBA,gl.FLOAT,native);
    result.sourcePixel=[...native.slice(0,4)];
    device.pushErrorScope('validation');
    texture=device.createTexture({size:[2,2],format:'rgba16float',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    // Same-task copy, before the non-preserved WebGL drawing buffer can expire.
    device.queue.copyExternalImageToTexture({source:canvas},{texture,colorSpace:'srgb',premultipliedAlpha:false},[2,2]);
    buffer=device.createBuffer({size:512,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow:256},[2,2]);device.queue.submit([encoder.finish()]);
    const validation=await device.popErrorScope();if(validation)throw validation;
    await buffer.mapAsync(GPUMapMode.READ);
    result.destinationPixel=Array.from(new Uint16Array(buffer.getMappedRange(),0,4),decodeFloat16);buffer.unmap();
    result.tested=true;
    result.preserved=result.sourcePixel[0]>1.9&&Math.abs(result.destinationPixel[0]-2)<.003&&Math.abs(result.destinationPixel[1]-.5)<.003&&Math.abs(result.destinationPixel[2]-.25)<.003;
    if(!result.preserved)result.reason='浮点画布复制未保留测试颜色或超过 SDR 白点的数值。';
  }catch(error){result.error=errorText(error);}
  finally{buffer?.destroy();texture?.destroy();if(program)gl.deleteProgram(program);if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);gl.getExtension('WEBGL_lose_context')?.loseContext();}
  return result;
}

/** Read-only capability probe. Does not append a canvas or change OS settings. */
export async function probeHDRSupport({powerPreference='high-performance'}={}){
  const report={userAgent:globalThis.navigator?.userAgent||'',secureContext:globalThis.isSecureContext===true,
    webgpu:Boolean(globalThis.navigator?.gpu),display:{dynamicRangeHigh:mediaMatches('(dynamic-range: high)'),
      p3:mediaMatches('(color-gamut: p3)'),rec2020:mediaMatches('(color-gamut: rec2020)')},
    canvas2d:{},adapter:null,extendedCanvas:false,apiAvailable:false,available:false,reasons:[],errors:[]};
  if(typeof document!=='undefined'){
    try{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
      const context=canvas.getContext('2d',{colorSpace:'display-p3',colorType:'float16'});
      report.canvas2d.attributes=context?.getContextAttributes?.()||null;
      try{const image=context?.getImageData(0,0,1,1,{colorSpace:'display-p3',pixelFormat:'rgba-float16'});
        report.canvas2d.float16ImageData=image?.pixelFormat==='rgba-float16'||image?.data?.constructor?.name==='Float16Array';
      }catch(error){report.canvas2d.float16ImageData=false;report.canvas2d.imageDataError=errorText(error);}
    }catch(error){report.canvas2d.error=errorText(error);}
  }
  if(!report.secureContext)report.reasons.push('需要 HTTPS 或 localhost 安全上下文。');
  if(!report.webgpu)report.reasons.push('当前浏览器未提供 WebGPU。');
  let device=null,context=null;
  if(report.webgpu&&report.secureContext){
    try{
      const adapter=await navigator.gpu.requestAdapter({powerPreference});
      if(!adapter)throw new Error('WebGPU 没有可用图形适配器。');
      const info=adapter.info||(adapter.requestAdapterInfo?await adapter.requestAdapterInfo():{});
      report.adapter={vendor:info.vendor||'',architecture:info.architecture||'',device:info.device||'',description:info.description||'',
        isFallbackAdapter:adapter.isFallbackAdapter===true,features:[...adapter.features]};
      device=await adapter.requestDevice();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
      context=canvas.getContext('webgpu');
      if(!context)throw new Error('浏览器未提供 WebGPU 画布。');
      device.pushErrorScope('validation');
      context.configure({device,format:'rgba16float',colorSpace:'srgb',toneMapping:{mode:'extended'},alphaMode:'opaque'});
      const configuration=context.getConfiguration?.();
      const texture=context.getCurrentTexture();
      const encoder=device.createCommandEncoder();
      const pass=encoder.beginRenderPass({colorAttachments:[{view:texture.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:2,g:1,b:.25,a:1}}]});pass.end();
      device.queue.submit([encoder.finish()]);
      const validation=await device.popErrorScope();
      if(validation)throw validation;
      report.configuration={format:configuration?.format,colorSpace:configuration?.colorSpace,toneMapping:configuration?.toneMapping,alphaMode:configuration?.alphaMode};
      report.extendedCanvas=configuration?.format==='rgba16float'&&configuration?.toneMapping?.mode==='extended';
      if(!report.extendedCanvas)report.reasons.push('浏览器未确认 extended 浮点 HDR 画布配置。');
      report.apiAvailable=report.extendedCanvas;
      report.floatCanvasCopy=await probeFloatCanvasCopy(device);
    }catch(error){report.errors.push(errorText(error));report.reasons.push('HDR 呈现初始化失败：'+errorText(error));}
    finally{try{context?.unconfigure();}catch{}device?.destroy();}
  }
  if(!report.display.dynamicRangeHigh)report.reasons.push('当前窗口的显示环境未报告 HDR；请在支持 HDR 的显示器和系统模式下重新检测。');
  report.available=report.apiAvailable&&report.display.dynamicRangeHigh;
  report.note='API/媒体查询只能报告浏览器显示链路能力；没有测量显示器亮度，也没有修改 Windows HDR。Canvas2D float16 存储不单独证明显示 HDR。';
  return report;
}

/** Reference display transform, in relative SDR-white units, not absolute nits. */
export function hdrMapLinear(rgb,{exposure=1,headroom=4}={}){
  const colour=rgb.map(value=>Math.max(0,Number.isFinite(value)?value*exposure:0));
  const peak=Math.max(...colour),ceiling=Math.max(1.001,headroom);
  const mapped=peak>1?1+(ceiling-1)*(-Math.expm1(-(peak-1)/(ceiling-1))):peak;
  return colour.map(value=>peak>0?value*mapped/peak:0);
}
export function srgbEncodeExtended(value){return value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055;}

const HDR_FRAGMENT=/* glsl */`#version 300 es
precision highp float;
uniform highp sampler2D tLinear;
uniform float uExposure,uHeadroom;
in vec2 vUv;
out vec4 colour;
vec3 encode(vec3 c){return mix(1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,12.92*c,lessThanEqual(c,vec3(.0031308)));}
void main(){
  vec3 c=max(texture(tLinear,vUv).rgb*uExposure,vec3(0));
  float peak=max(c.r,max(c.g,c.b));
  if(peak>1.)c*=(1.+(uHeadroom-1.)*(1.-exp(-(peak-1.)/(uHeadroom-1.))))/peak;
  // rgba16float is not an -srgb attachment: encode exactly once here.
  // Opaque alpha also avoids undefined out-of-gamut premultiplied compositing.
  colour=vec4(encode(c),1.);
}`;

export const HDR_UPLOAD_WGSL=/* wgsl */`
struct Parameters { outputSize:vec2f, exposure:f32, headroom:f32 };
@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var<uniform> parameters:Parameters;
@vertex fn vertexMain(@builtin(vertex_index) index:u32)->@builtin(position) vec4f {
  let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[index],0,1);
}
fn texel(p:vec2i)->vec3f {let s=vec2i(textureDimensions(source));return textureLoad(source,clamp(p,vec2i(0),s-1),0).rgb;}
fn encode(c:vec3f)->vec3f {return select(1.055*pow(max(c,vec3f(0)),vec3f(1./2.4))-.055,12.92*c,c<=vec3f(.0031308));}
@fragment fn fragmentMain(@builtin(position) p:vec4f)->@location(0) vec4f {
  let size=vec2f(textureDimensions(source));
  // WebGL readPixels row zero is the bottom row. WebGPU row zero is the top.
  let q=vec2f(p.x/parameters.outputSize.x,1.-p.y/parameters.outputSize.y)*size-.5;
  let base=vec2i(floor(q));let f=fract(q);
  var c=max(mix(mix(texel(base),texel(base+vec2i(1,0)),f.x),mix(texel(base+vec2i(0,1)),texel(base+vec2i(1,1)),f.x),f.y)*parameters.exposure,vec3f(0));
  let peak=max(c.r,max(c.g,c.b));
  if(peak>1.){c*= (1.+(parameters.headroom-1.)*(1.-exp(-(peak-1.)/(parameters.headroom-1.))))/peak;}
  return vec4f(encode(c),1.);
}`;

function fullscreenTriangle(THREE,fragmentShader,uniforms){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const material=new THREE.RawShaderMaterial({name:'Extended-range HDR output',glslVersion:THREE.GLSL3,uniforms,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
    vertexShader:'precision highp float;in vec3 position;out vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
    fragmentShader:fragmentShader.replace(/^#version 300 es\n/,'')});
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
  return {scene,camera:new THREE.Camera(),material,dispose(){geometry.dispose();material.dispose();}};
}

/**
 * Fallback/readback verification utility. No waiting for pending fences, and a
 * bounded three-slot queue. FLOAT is guaranteed here by EXT_color_buffer_float;
 * HALF_FLOAT readPixels is intentionally not assumed to be supported.
 */
export function createHDRReadbackBridge(THREE,renderer,{maxBridgeWidth=1440}={}){
  const gl=renderer.getContext(),slots=[],extension=gl.getExtension('EXT_color_buffer_float');
  if(!renderer.capabilities.isWebGL2||!extension)throw new Error('HDR readback requires WebGL2 + EXT_color_buffer_float.');
  let width=0,height=0,disposed=false,stage=null;
  const copy=fullscreenTriangle(THREE,'precision highp float;uniform highp sampler2D tLinear;in vec2 vUv;out vec4 colour;void main(){colour=vec4(texture(tLinear,vUv).rgb,1.);}',{tLinear:{value:null}});
  const statistics={submitted:0,completed:0,dropped:0,lastEnqueueCpuMs:0,lastCopyCpuMs:0,lastLatencyMs:0,bytesPerFrame:0};
  function clearSlots(){for(const slot of slots){if(slot.sync)gl.deleteSync(slot.sync);gl.deleteBuffer(slot.buffer);}slots.length=0;}
  function resize(w,h){if(width===w&&height===h)return;clearSlots();width=w;height=h;stage?.dispose();stage=null;
    for(let i=0;i<3;i++)slots.push({buffer:gl.createBuffer(),sync:null,data:new Float32Array(w*h*4),submittedAt:0,settings:null});
    statistics.bytesPerFrame=w*h*16;}
  function enqueue(target,now=performance.now(),settings={}){
    if(disposed)return false;
    if(!target?.isWebGLRenderTarget||![THREE.HalfFloatType,THREE.FloatType].includes(target.texture?.type))throw new Error('HDR bridge input must be a pre-tonemap floating-point render target.');
    const scale=Math.min(1,Math.max(16,maxBridgeWidth)/target.width),w=Math.max(1,Math.round(target.width*scale)),h=Math.max(1,Math.round(target.height*scale));resize(w,h);
    const slot=slots.find(value=>!value.sync);if(!slot){statistics.dropped++;return false;}
    const started=performance.now(),previous={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),pack:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),
      alignment:gl.getParameter(gl.PACK_ALIGNMENT),rowLength:gl.getParameter(gl.PACK_ROW_LENGTH),skipPixels:gl.getParameter(gl.PACK_SKIP_PIXELS),skipRows:gl.getParameter(gl.PACK_SKIP_ROWS)};
    try{
      let source=target;
      if(target.width!==w||target.height!==h||target.samples>0){
        if(!stage)stage=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,depthBuffer:false});
        copy.material.uniforms.tLinear.value=target.texture;renderer.setRenderTarget(stage);renderer.render(copy.scene,copy.camera);source=stage;
      }
      renderer.setRenderTarget(source);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,slot.buffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,slot.data.byteLength,gl.STREAM_READ);
      gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);
      gl.readPixels(0,0,w,h,gl.RGBA,gl.FLOAT,0);slot.sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
      if(!slot.sync)throw new Error('Cannot create HDR readback fence.');
      slot.submittedAt=now;slot.settings={...settings};statistics.submitted++;return true;
    }finally{
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,previous.pack);gl.pixelStorei(gl.PACK_ALIGNMENT,previous.alignment);gl.pixelStorei(gl.PACK_ROW_LENGTH,previous.rowLength);gl.pixelStorei(gl.PACK_SKIP_PIXELS,previous.skipPixels);gl.pixelStorei(gl.PACK_SKIP_ROWS,previous.skipRows);
      renderer.setRenderTarget(previous.target,previous.face,previous.mip);statistics.lastEnqueueCpuMs=performance.now()-started;
    }
  }
  function poll(now=performance.now()){
    if(disposed)return null;
    const ready=[];
    for(const slot of slots)if(slot.sync){const status=gl.clientWaitSync(slot.sync,0,0);if(status===gl.WAIT_FAILED)throw new Error('HDR readback fence failed.');if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)ready.push(slot);}
    if(!ready.length)return null;ready.sort((a,b)=>b.submittedAt-a.submittedAt);const newest=ready[0],previous=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),started=performance.now();
    try{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,newest.buffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,newest.data);}
    finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,previous);statistics.lastCopyCpuMs=performance.now()-started;}
    for(const slot of ready){gl.deleteSync(slot.sync);slot.sync=null;}statistics.completed++;statistics.dropped+=ready.length-1;statistics.lastLatencyMs=now-newest.submittedAt;
    return {data:newest.data,width,height,submittedAt:newest.submittedAt,settings:newest.settings,latencyMs:statistics.lastLatencyMs};
  }
  return {enqueue,poll,get state(){return {...statistics,width,height,pending:slots.filter(slot=>slot.sync).length,format:'RGBA/FLOAT',queueLimit:3};},dispose(){if(disposed)return;disposed=true;clearSlots();stage?.dispose();copy.dispose();}};
}

/**
 * Caller mounts returned .canvas over renderer.domElement, below its controls.
 * Input MUST be the floating-point, linear-sRGB target after lens/SMAA but before
 * OutputPass/ACES/sRGB/FSR1. Continue the existing SDR path whenever .enabled is
 * false. Toggle/resize must invalidate any paused-frame cache and redraw once.
 */
export async function createHDROutput(THREE,renderer,{canvas:providedCanvas,mount=renderer.domElement.parentElement,maxHz=60,maxBridgeWidth=1440,headroom=4,onStateChange=()=>{}}={}){
  const support=await probeHDRSupport(),gl=renderer.getContext(),canvas=providedCanvas||document.createElement('canvas');
  canvas.classList.add('hdr-output-canvas');canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',display:'none'});
  if(mount&&canvas.parentElement!==mount)mount.appendChild(canvas);
  const initialFormat=gl.drawingBufferFormat||gl.RGBA8;
  const initialColorSpace=gl.drawingBufferColorSpace;
  gl.getExtension('EXT_color_buffer_float');
  let device=null,context=null,adapter=null,enabled=false,disposed=false,mode='disabled',lastSubmitted=-Infinity,nextSubmission=-Infinity,readback=null,uploadTexture=null,pipeline=null,parameters=null,bindGroup=null,initializing=null,activationEpoch=0;
  let uploadWidth=0,uploadHeight=0,outputWidth=renderer.domElement.width,outputHeight=renderer.domElement.height,nativeFloatActive=false,pendingFrame=0;
  let settings={maxHz:Math.max(1,Math.min(120,maxHz)),maxBridgeWidth:Math.max(16,maxBridgeWidth),headroom:Math.max(1.001,Math.min(16,headroom))};
  const statistics={presentedFrames:0,skippedFrames:0,lastPresentCpuMs:0,lastUploadCpuMs:0,lastPresentationTimestamp:null,errors:[],requiresRedraw:false};
  const output=fullscreenTriangle(THREE,HDR_FRAGMENT,{tLinear:{value:null},uExposure:{value:1},uHeadroom:{value:settings.headroom}});
  function notify(){try{onStateChange(api.state);}catch{}}
  function restoreDrawingBuffer(){
    if(nativeFloatActive){gl.drawingBufferStorage(initialFormat,renderer.domElement.width,renderer.domElement.height);nativeFloatActive=false;statistics.requiresRedraw=true;}
    if(initialColorSpace&&gl.drawingBufferColorSpace!==initialColorSpace)gl.drawingBufferColorSpace=initialColorSpace;
  }
  function stop(reason){activationEpoch++;enabled=false;if(pendingFrame)cancelAnimationFrame(pendingFrame);pendingFrame=0;canvas.style.display='none';try{restoreDrawingBuffer();}catch(error){statistics.errors.push('恢复 SDR：'+errorText(error));}mode='disabled';lastSubmitted=nextSubmission=-Infinity;
    if(reason)statistics.errors.push(reason);statistics.errors=statistics.errors.slice(-8);statistics.requiresRedraw=true;notify();}
  function currentDisplayHDR(){return mediaMatches('(dynamic-range: high)');}
  function submitted(now,force){
    const interval=1000/settings.maxHz;
    // Carry fractional scheduling phase: a 90Hz source and 60Hz cap must not
    // accidentally turn into 45Hz by resetting the deadline to every arrival.
    nextSubmission=force||!Number.isFinite(nextSubmission)||now-nextSubmission>interval*2?now+interval:nextSubmission+interval;
    lastSubmitted=now;
  }
  async function initializeDevice(){
    if(device)return;
    adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('WebGPU 适配器不可用。');
    device=await adapter.requestDevice();context=canvas.getContext('webgpu');if(!context)throw new Error('WebGPU 画布不可用。');
    device.addEventListener('uncapturederror',event=>stop('WebGPU：'+errorText(event.error)));
    const createdDevice=device;device.lost.then(info=>{if(!disposed&&device===createdDevice)stop('WebGPU 设备丢失：'+info.message);});
    device.pushErrorScope('validation');
    context.configure({device,format:'rgba16float',colorSpace:'srgb',toneMapping:{mode:'extended'},alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC});
    const configuration=context.getConfiguration?.();
    if(configuration?.toneMapping?.mode!=='extended')throw new Error('未确认 extended HDR 画布。');
    const validation=await device.popErrorScope();if(validation)throw validation;
    parameters=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const module=device.createShaderModule({label:'Linear HDR PBO fallback presentation',code:HDR_UPLOAD_WGSL});
    const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'unfilterable-float'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
    pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),vertex:{module,entryPoint:'vertexMain'},fragment:{module,entryPoint:'fragmentMain',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'}});
  }
  function initialize(){
    if(!initializing)initializing=initializeDevice().catch(error=>{const failed=device;device=null;try{context?.unconfigure();}catch{}parameters?.destroy();parameters=null;failed?.destroy();initializing=null;throw error;});
    return initializing;
  }
  function ensureNativeFloat(){
    if(gl.drawingBufferColorSpace!=='srgb')gl.drawingBufferColorSpace='srgb';
    if(!nativeFloatActive||gl.drawingBufferFormat!==gl.RGBA16F){
      gl.drawingBufferStorage(gl.RGBA16F,renderer.domElement.width,renderer.domElement.height);
      if(gl.drawingBufferFormat!==gl.RGBA16F)throw new Error('主 WebGL 浮点 drawing buffer 未生效。');nativeFloatActive=true;
    }
  }
  function resizeCanvas(w,h){if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;outputWidth=w;outputHeight=h;}
  function nativePresent(target,exposure){
    ensureNativeFloat();resizeCanvas(renderer.domElement.width,renderer.domElement.height);
    const previous={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear};
    try{
      output.material.uniforms.tLinear.value=target.texture;output.material.uniforms.uExposure.value=exposure;output.material.uniforms.uHeadroom.value=settings.headroom;
      renderer.autoClear=false;renderer.setRenderTarget(null);renderer.setScissorTest(false);
      const ratio=renderer.getPixelRatio();renderer.setViewport(0,0,renderer.domElement.width/ratio,renderer.domElement.height/ratio);
      renderer.render(output.scene,output.camera);
      // Mandatory same-task copy: do not await between drawing and capture.
      // The source is float storage and not the SDR OutputPass result.
      device.queue.copyExternalImageToTexture({source:renderer.domElement},{texture:context.getCurrentTexture(),colorSpace:'srgb',premultipliedAlpha:false},[outputWidth,outputHeight]);
    }finally{
      renderer.autoClear=previous.autoClear;renderer.setViewport(previous.viewport);renderer.setScissorTest(previous.scissorTest);renderer.setRenderTarget(previous.target,previous.face,previous.mip);
    }
  }
  function uploadPresent(frame){
    const started=performance.now();
    if(uploadWidth!==frame.width||uploadHeight!==frame.height||!uploadTexture){
      uploadTexture?.destroy();uploadWidth=frame.width;uploadHeight=frame.height;
      uploadTexture=device.createTexture({size:[uploadWidth,uploadHeight],format:'rgba32float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
      bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:uploadTexture.createView()},{binding:1,resource:{buffer:parameters}}]});
    }
    device.queue.writeTexture({texture:uploadTexture},frame.data,{bytesPerRow:uploadWidth*16},[uploadWidth,uploadHeight]);statistics.lastUploadCpuMs=performance.now()-started;
    device.queue.writeBuffer(parameters,0,new Float32Array([outputWidth,outputHeight,frame.settings.exposure??1,frame.settings.headroom??settings.headroom]));
    const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
    pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);
  }
  // A paused app may only submit one scene frame. Finish its asynchronous PBO
  // upload without requiring the app to keep re-rendering a frozen scene.
  function finishPending(){
    pendingFrame=0;if(!enabled||disposed||mode!=='async-pbo-upload')return;
    try{
      const now=performance.now(),frame=readback.poll(now);
      if(frame){uploadPresent(frame);statistics.presentedFrames++;canvas.style.display='block';statistics.lastPresentationTimestamp=now;}
      if(readback.state.pending>0)pendingFrame=requestAnimationFrame(finishPending);
    }catch(error){stop(errorText(error));}
  }
  const displayQuery=typeof matchMedia==='function'?matchMedia('(dynamic-range: high)'):null;
  const displayChanged=()=>{if(enabled&&!currentDisplayHDR())stop('窗口的显示环境已不再报告 HDR，已返回 SDR。');else notify();};displayQuery?.addEventListener('change',displayChanged);
  const api={
    canvas,support,
    get enabled(){return enabled;},
    async setEnabled(value){
      const request=++activationEpoch;if(disposed)return false;if(!value){stop();return true;}
      if(!support.apiAvailable||!currentDisplayHDR()){stop(support.reasons.join(' ')||'当前显示环境未报告 HDR。');return false;}
      try{
        await initialize();
        if(disposed||request!==activationEpoch)return false;
        if(!currentDisplayHDR()){stop('窗口的显示环境已不再报告 HDR。');return false;}
        const native=support.floatCanvasCopy?.preserved&&typeof gl.drawingBufferStorage==='function'&&gl.getContextAttributes()?.alpha===true;
        mode=native?'float-canvas-external-copy':'async-pbo-upload';
        if(!native&&!readback)readback=createHDRReadbackBridge(THREE,renderer,{maxBridgeWidth:settings.maxBridgeWidth});
        if(native)ensureNativeFloat();enabled=true;lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;notify();return true;
      }catch(error){stop(errorText(error));return false;}
    },
    configure(options={}){
      if(options.maxHz!==undefined){settings.maxHz=Math.max(1,Math.min(120,options.maxHz));nextSubmission=-Infinity;}
      if(options.headroom!==undefined)settings.headroom=Math.max(1.001,Math.min(16,options.headroom));
      if(options.maxBridgeWidth!==undefined&&options.maxBridgeWidth!==settings.maxBridgeWidth){settings.maxBridgeWidth=Math.max(16,options.maxBridgeWidth);readback?.dispose();readback=null;}
      if(enabled&&mode==='async-pbo-upload'&&!readback)readback=createHDRReadbackBridge(THREE,renderer,{maxBridgeWidth:settings.maxBridgeWidth});
      statistics.requiresRedraw=true;notify();
    },
    setSize(w,h){resizeCanvas(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));if(enabled&&mode==='float-canvas-external-copy')ensureNativeFloat();lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;},
    present(target,now=performance.now(),{exposure=renderer.toneMappingExposure,force=false}={}){
      if(!enabled||disposed)return false;
      if(!target?.isWebGLRenderTarget||![THREE.HalfFloatType,THREE.FloatType].includes(target.texture?.type)){stop('HDR 输入须为色调映射前的浮点线性目标。');return false;}
      const started=performance.now();
      try{
        if(mode==='async-pbo-upload'){
          const frame=readback.poll(now);if(frame){resizeCanvas(outputWidth,outputHeight);uploadPresent(frame);statistics.presentedFrames++;canvas.style.display='block';statistics.lastPresentationTimestamp=now;}
          if(force||now>=nextSubmission-.1){if(readback.enqueue(target,now,{exposure,headroom:settings.headroom})){submitted(now,force);if(!pendingFrame)pendingFrame=requestAnimationFrame(finishPending);}}
          else statistics.skippedFrames++;
        }else{
          if(!force&&now<nextSubmission-.1){statistics.skippedFrames++;return true;}
          nativePresent(target,exposure);submitted(now,force);statistics.presentedFrames++;canvas.style.display='block';statistics.lastPresentationTimestamp=now;
        }
        statistics.requiresRedraw=false;return true;
      }catch(error){stop(errorText(error));return false;}
      finally{statistics.lastPresentCpuMs=performance.now()-started;}
    },
    get state(){return {enabled,available:support.apiAvailable&&currentDisplayHDR(),apiAvailable:support.apiAvailable,displayHDR:currentDisplayHDR(),mode,
      width:outputWidth,height:outputHeight,...settings,...statistics,errors:[...statistics.errors],readback:readback?.state||null,
      source:'pre-OutputPass, scene-linear sRGB floating-point target',output:'sRGB-encoded rgba16float, extended, opaque',
      noExplicitCPUReadback:mode==='float-canvas-external-copy',absoluteNitsCalibrated:false,shoulder:'linear through SDR white, hue-preserving exponential shoulder above white',
      limits:'Browser/display HDR capability is not a photometric measurement. External-image copy is not guaranteed zero-copy. PBO mode copies float pixels through CPU; throttling may add a frame of latency. HDR uses linear spatial enlargement, not SDR FSR1.'};},
    dispose(){if(disposed)return;activationEpoch++;stop();disposed=true;displayQuery?.removeEventListener('change',displayChanged);readback?.dispose();uploadTexture?.destroy();parameters?.destroy();output.dispose();try{context?.unconfigure();}catch{}device?.destroy();if(!providedCanvas)canvas.remove();}
  };
  return api;
}
