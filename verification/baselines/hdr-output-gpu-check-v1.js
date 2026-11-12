import {createHDROutput,createHDRReadbackBridge,hdrMapLinear,srgbEncodeExtended,decodeFloat16,HDR_UPLOAD_WGSL} from './hdr-before-nit-calibration.js';

/** Independent real WebGL/WebGPU fixture. No DOM attachment and no app mutation. */
export async function runHDROutputCheck(THREE){
  const report={startedAt:new Date().toISOString(),checks:[],support:null,errors:[],limits:[
    'Numerical HDR preservation and capability checks are not a luminance/colorimeter measurement.',
    'Synthetic fixture timings are not full-scene FPS; screenshots cannot prove HDR peak brightness.',
    'The external-image path contains no explicit CPU pixel readback in production, but zero-copy is not guaranteed.'
  ]};
  const check=(name,passed,details={})=>report.checks.push({name,passed:Boolean(passed),...details});
  let renderer=null,output=null,device=null,target=null,geometry=null,material=null,bridge=null;
  const started=performance.now();
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(2);renderer.setSize(16,16,false);renderer.toneMappingExposure=.76;
    const gl=renderer.getContext(),initialFormat=gl.drawingBufferFormat;
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{uMode:{value:0},uConstant:{value:new THREE.Vector3(1,1,1)}},
      vertexShader:'precision highp float;in vec3 position;out vec2 uv;void main(){uv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
      fragmentShader:'precision highp float;uniform float uMode;uniform vec3 uConstant;in vec2 uv;out vec4 colour;void main(){vec3 c=uConstant;if(uMode>.5){if(uv.y>.5)c=uv.x<.5?vec3(.18):vec3(2.,.5,.25);else c=uv.x<.5?vec3(.001,.0031308,.01):vec3(8.,1.,.1);}colour=vec4(c,1.);}'});
    const scene=new THREE.Scene(),mesh=new THREE.Mesh(geometry,material),camera=new THREE.Camera();mesh.frustumCulled=false;scene.add(mesh);
    target=new THREE.WebGLRenderTarget(16,16,{type:THREE.HalfFloatType,depthBuffer:false});
    const draw=(mode=0,colour=[1,1,1])=>{material.uniforms.uMode.value=mode;material.uniforms.uConstant.value.set(...colour);renderer.setRenderTarget(target);renderer.render(scene,camera);};
    // PBO path is tested even if the display has no HDR. Do not fake display support.
    draw(1);bridge=createHDRReadbackBridge(THREE,renderer,{maxBridgeWidth:64});
    const packBefore=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),targetBefore=renderer.getRenderTarget();
    bridge.enqueue(target,performance.now(),{exposure:.76});
    let readback=null;for(let attempt=0;attempt<100&&!readback;attempt++){await new Promise(resolve=>setTimeout(resolve,5));readback=bridge.poll();}
    const index=(2*16+12)*4;
    check('fenced PBO float readback keeps values above one',readback&&Math.abs(readback.data[index]-8)<.01&&Math.abs(readback.data[index+1]-1)<.01,{pixel:readback?Array.from(readback.data.slice(index,index+4)):null,state:bridge.state});
    check('PBO restores target and pixel-pack binding',renderer.getRenderTarget()===targetBefore&&gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)===packBefore);
    output=await createHDROutput(THREE,renderer,{mount:null,maxHz:60,headroom:4});report.support=output.support;
    check('HDR support does not claim display output on SDR-only environments',output.state.available===(output.support.apiAvailable&&matchMedia('(dynamic-range: high)').matches),{available:output.state.available});
    if(!output.support.available){
      const enabled=await output.setEnabled(true);check('unavailable display refuses HDR enable',enabled===false&&!output.enabled,{reasons:output.support.reasons});
      report.presentationSkipped='Real HDR display/API unavailable; no synthetic override used.';return report;
    }
    const pendingEnable=output.setEnabled(true);await output.setEnabled(false);const staleEnable=await pendingEnable;
    check('first concurrent enable then disable cannot resurrect HDR',staleEnable===false&&!output.enabled&&output.canvas.style.display==='none'&&gl.drawingBufferFormat===initialFormat,{staleEnable,enabled:output.enabled,format:gl.drawingBufferFormat});
    const enabled=await output.setEnabled(true);check('real HDR chain enables',enabled&&output.enabled,{mode:output.state.mode});
    if(!enabled)return report;
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});device=await adapter.requestDevice();
    // Exercise the exact production fallback WGSL with the real PBO pixels,
    // independently of which bridge this machine chooses for normal output.
    async function verifyUploadShader(){
      const w=32,h=32,bytesPerRow=256;
      const input=device.createTexture({size:[16,16],format:'rgba32float',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING});
      const destination=device.createTexture({size:[w,h],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
      const uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),buffer=device.createBuffer({size:bytesPerRow*h,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
      try{
        device.pushErrorScope('validation');
        device.queue.writeTexture({texture:input},readback.data,{bytesPerRow:16*16},[16,16]);device.queue.writeBuffer(uniform,0,new Float32Array([w,h,1,4]));
        const shader=device.createShaderModule({code:HDR_UPLOAD_WGSL});
        const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'unfilterable-float'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
        const pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),vertex:{module:shader,entryPoint:'vertexMain'},fragment:{module:shader,entryPoint:'fragmentMain',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'}});
        const group=device.createBindGroup({layout,entries:[{binding:0,resource:input.createView()},{binding:1,resource:{buffer:uniform}}]});
        const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:destination.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
        pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();encoder.copyTextureToBuffer({texture:destination},{buffer,bytesPerRow},[w,h]);device.queue.submit([encoder.finish()]);
        const validation=await device.popErrorScope();if(validation)throw new Error(validation.message);
        await buffer.mapAsync(GPUMapMode.READ);const data=new Uint16Array(buffer.getMappedRange());
        const points=[{x:8,y:8,source:[.18,.18,.18]},{x:24,y:8,source:[2,.5,.25]},{x:8,y:24,source:[.001,.0031308,.01]},{x:24,y:24,source:[8,1,.1]}];
        const samples=points.map(point=>({...point,pixel:Array.from(data.slice(point.y*bytesPerRow/2+point.x*4,point.y*bytesPerRow/2+point.x*4+4),decodeFloat16),expected:hdrMapLinear(point.source).map(srgbEncodeExtended)}));
        check('PBO upload WGSL preserves extended values and flips GL rows correctly',samples.every(point=>point.expected.every((value,i)=>Math.abs(point.pixel[i]-value)<.006)),{samples});
        check('PBO upload output is finite and opaque',samples.every(point=>point.pixel.every(Number.isFinite)&&point.pixel[3]===1));
      }finally{input.destroy();destination.destroy();uniform.destroy();buffer.destroy();}
    }
    await verifyUploadShader();
    async function capture(){
      const w=output.canvas.width,h=output.canvas.height,bytesPerRow=Math.ceil(w*8/256)*256;
      const texture=device.createTexture({size:[w,h],format:'rgba16float',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT});
      const buffer=device.createBuffer({size:bytesPerRow*h,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
      device.pushErrorScope('validation');
      // Capture synchronously after present, then await only after GPU submission.
      device.queue.copyExternalImageToTexture({source:output.canvas},{texture,colorSpace:'srgb',premultipliedAlpha:false},[w,h]);
      const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow},[w,h]);device.queue.submit([encoder.finish()]);
      const validation=await device.popErrorScope();if(validation)throw new Error(validation.message);
      try{await buffer.mapAsync(GPUMapMode.READ);const data=new Uint16Array(buffer.getMappedRange()).slice();return {w,h,data,pixel(x,y){return Array.from(data.slice(y*bytesPerRow/2+x*4,y*bytesPerRow/2+x*4+4),decodeFloat16);}};}
      finally{buffer.destroy();texture.destroy();}
    }
    async function presentAndCapture(mode,colour,exposure=1,time=performance.now()){
      draw(mode,colour);output.present(target,time,{exposure,force:true});return capture();
    }
    const white=await presentAndCapture(0,[1,1,1]);const whitePixel=white.pixel(8,8);
    check('SDR white remains one (no ACES or double gamma)',whitePixel.slice(0,3).every(value=>Math.abs(value-1)<.003),{pixel:whitePixel});
    const black=await presentAndCapture(0,[0,0,0]);const blackPixel=black.pixel(8,8);
    check('black remains zero and output is opaque',blackPixel.slice(0,3).every(value=>value===0)&&blackPixel[3]===1,{pixel:blackPixel});
    const mid=await presentAndCapture(0,[.18,.18,.18]);const midPixel=mid.pixel(8,8),midExpected=srgbEncodeExtended(.18);
    check('linear 18% grey is sRGB encoded exactly once',midPixel.slice(0,3).every(value=>Math.abs(value-midExpected)<.003),{pixel:midPixel,expected:midExpected});
    const hdr=await presentAndCapture(1);const quadrants=[{x:8,y:8,source:[.18,.18,.18]},{x:24,y:8,source:[2,.5,.25]},{x:8,y:24,source:[.001,.0031308,.01]},{x:24,y:24,source:[8,1,.1]}];
    const samples=quadrants.map(q=>({...q,pixel:hdr.pixel(q.x,q.y),expected:hdrMapLinear(q.source,{headroom:4}).map(srgbEncodeExtended)}));
    check('quadrant orientation and HDR transform match CPU reference',samples.every(q=>q.expected.every((value,i)=>Math.abs(value-q.pixel[i])<.006)),{samples});
    check('actual presented pixels retain extended range and finite values',samples.some(q=>q.pixel[0]>1.1)&&samples.every(q=>q.pixel.every(Number.isFinite)),{maximum:Math.max(...samples.flatMap(q=>q.pixel.slice(0,3)))});
    const exposed=await presentAndCapture(0,[.18,.18,.18],.76),exposedPixel=exposed.pixel(8,8),exposedExpected=srgbEncodeExtended(.18*.76);
    check('scene exposure is applied once',exposedPixel.slice(0,3).every(value=>Math.abs(value-exposedExpected)<.003),{pixel:exposedPixel,expected:exposedExpected});
    renderer.setViewport(1,2,10,11);renderer.setScissor(2,1,9,10);renderer.setScissorTest(true);renderer.autoClear=false;renderer.setRenderTarget(target);
    const before={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear};
    output.present(target,performance.now(),{force:true});
    const after={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear};
    check('native presentation restores renderer state at DPR=2',before.target===after.target&&JSON.stringify({...before,target:null})===JSON.stringify({...after,target:null}),{before:{...before,target:'fixture'},after:{...after,target:'fixture'}});
    const count=output.state.presentedFrames,skips=output.state.skippedFrames,last=output.state.lastPresentationTimestamp;
    const held=output.present(target,last+.1);
    check('throttled frame retains HDR routing rather than falling to SDR',held===true&&output.state.presentedFrames===count&&output.state.skippedFrames===skips+1);
    if(output.state.mode==='float-canvas-external-copy'){
      output.configure({maxHz:60});const beforeCadence=output.state.presentedFrames,base=performance.now()+100;
      output.present(target,base,{force:true});for(let frame=1;frame<=9;frame++)output.present(target,base+frame*1000/90);
      const updates=output.state.presentedFrames-beforeCadence;
      check('60Hz cap preserves fractional cadence with a 90Hz source',updates===7,{inputFrames:10,sourceHz:90,targetHz:60,durationMs:100,presentedIncludingInitial:updates,expectedIncludingInitial:7,note:'Synthetic timestamp scheduling fixture; this count is not measured scene FPS.'});
    }
    const beforeDisable=output.state;await output.setEnabled(false);
    check('disabling restores original SDR drawing-buffer format',!output.enabled&&gl.drawingBufferFormat===initialFormat&&output.canvas.style.display==='none',{initialFormat,restoredFormat:gl.drawingBufferFormat,modeBeforeDisable:beforeDisable.mode});
    check('fixture has no WebGL errors',gl.getError()===gl.NO_ERROR);
    report.presentation=beforeDisable;
  }catch(error){report.errors.push(String(error?.stack||error));}
  finally{bridge?.dispose();output?.dispose();device?.destroy();target?.dispose();geometry?.dispose();material?.dispose();renderer?.dispose();renderer?.forceContextLoss();report.wallTimeMs=performance.now()-started;report.passed=report.errors.length===0&&report.checks.length>0&&report.checks.every(value=>value.passed);report.cleanup='Own context/device/resources disposed; no page renderer used.';}
  return report;
}
